import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { searchWorkflow } from "@/workflows/search";
import type { ConversationContext } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

// Kicks off the search workflow. The frontend may include the previous turn's
// `priorContext` so follow-ups like "cheaper" / "smaller" / "different area"
// build on the prior turn instead of starting cold.
export async function POST(req: Request) {
  const { username, prompt, priorContext } = (await req.json()) as {
    username?: string;
    prompt?: string;
    priorContext?: ConversationContext;
  };
  if (!username?.trim() || !prompt?.trim()) {
    return NextResponse.json(
      { error: "username and prompt required" },
      { status: 400 },
    );
  }
  const run = await start(searchWorkflow, [
    {
      username: username.trim(),
      prompt: prompt.trim(),
      priorContext,
    },
  ]);
  return NextResponse.json({ runId: run.runId });
}
