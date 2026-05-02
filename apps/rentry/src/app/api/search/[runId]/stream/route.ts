import { getRun } from "workflow/api";

export const runtime = "nodejs";
export const maxDuration = 120;

// Streams the workflow's ndjson event log. Each line is a SearchEvent.
// `getReadable()` replays from index 0 on every connection, so a refresh
// re-renders the trace cleanly.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;
  const run = getRun(runId);

  if (!(await run.exists)) {
    return new Response("not found", { status: 404 });
  }

  const stream = run.getReadable();
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
