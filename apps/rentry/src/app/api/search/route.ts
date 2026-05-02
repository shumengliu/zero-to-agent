import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { searchWorkflow } from "@/workflows/search";

export const runtime = "nodejs";
export const maxDuration = 60;

// Kicks off the search workflow. The frontend then opens
// /api/search/[runId]/stream to consume reasoning trace + result events.
export async function POST(req: Request) {
  const { username, prompt } = (await req.json()) as {
    username?: string;
    prompt?: string;
  };
  if (!username?.trim() || !prompt?.trim()) {
    return NextResponse.json(
      { error: "username and prompt required" },
      { status: 400 },
    );
  }
  const run = await start(searchWorkflow, [
    { username: username.trim(), prompt: prompt.trim() },
  ]);
  return NextResponse.json({ runId: run.runId });
}
