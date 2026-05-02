// Streaming endpoint that drives the investigation agent. Accepts a repo URL
// and a v0 API key (judges paste their own), streams SSE events back to the
// browser as the agent reasons + calls tools.

import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  repoUrl?: string;
  v0Key?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const repoUrl = body.repoUrl?.trim();
  const v0Key = body.v0Key?.trim();

  if (!repoUrl) {
    return new Response("Missing repoUrl", { status: 400 });
  }
  if (!v0Key) {
    return new Response("Missing v0Key", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Heartbeat so proxies don't kill the stream during long v0 polls.
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15_000);

      try {
        for await (const ev of runAgent({ repoUrl, v0Key })) {
          send(ev);
          if (ev.type === "done" || ev.type === "error") break;
        }
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
