// The investigation agent. Drives Claude (via Vercel AI Gateway) through a
// tool-using loop that researches the repo, picks a product archetype, drafts
// a marketing brief, and commissions v0 as its terminal action.
//
// Yields a stream of structured events the API route turns into SSE.

import { streamText, stepCountIs } from "ai";
import { getRepoMeta, parseRepoUrl } from "./github";
import { makeTools, type AgentContext } from "./tools";
import type { CommissionResult } from "./commission";

const SYSTEM_PROMPT = `You are an investigation agent that turns a GitHub repository into a working, interactive web product.

## Your job

1. **Investigate the repo** using the tools provided. Start with \`github_stats\` to orient, then \`fetch_readme\`. From there, pick relevant manifests with \`fetch_manifest\` and explore directories or specific files only when it matters for picking the right product type.
2. **Pick an archetype** — the kind of product that best showcases what this repo does:
   - \`playground\` — interactive try-it-now UI for libraries, parsers, CLIs, formatters, encoders. Best for repos where there's a canonical \`input → output\` operation.
   - \`explorer\` — queryable browser for repos that contain structured data, specs, schemas, or catalogs.
   - \`gallery\` — submission + voting hub for repos that produce visible artifacts (game engines, generative art, shaders, design systems).
   - \`docs_hub\` — docs site with comments + search for repos whose primary value is reference material.
   - \`landing\` — fallback marketing page. Use only when the repo has no plausible interactive surface (kernel modules, narrow infra, internal tools).
3. **Draft a marketing brief** grounded in repo evidence. Every feature must cite something concrete from the README, manifests, or code.
4. **Design a small Postgres schema** if the archetype needs persistence (everything except \`landing\`). Keep it minimal — 1–3 tables.
5. **Call \`commission_v0\` exactly once** as your final action with the archetype, brief, and schema.

## Rules

- Be efficient. 6–10 tool calls is the sweet spot. Do not exhaustively read the entire repo.
- Do not invent features. If the README is sparse, lean on manifests and topics.
- Headlines are short and specific. "A Rust regex engine" beats "a powerful library for pattern matching."
- The terminal action is \`commission_v0\`. After it returns, output one short sentence summarizing what you shipped, then stop.
- If the repo is genuinely infrastructure with no interactive surface, pick \`landing\` and ship a tight marketing page.
`;

export type AgentEvent =
  | { type: "started"; repo: string; branch: string }
  | { type: "agent_text"; text: string }
  | {
      type: "tool_call";
      toolCallId: string;
      name: string;
      args: unknown;
    }
  | {
      type: "tool_result";
      toolCallId: string;
      name: string;
      result: unknown;
      durationMs: number;
    }
  | { type: "step_finished"; step: number }
  | { type: "commissioned"; result: CommissionResult }
  | { type: "done"; reason: string }
  | { type: "error"; message: string };

const MODEL = "anthropic/claude-sonnet-4-5";
const MAX_STEPS = 14;

export async function* runAgent(args: {
  repoUrl: string;
  v0Key: string;
}): AsyncGenerator<AgentEvent> {
  const ref = parseRepoUrl(args.repoUrl);

  let meta;
  try {
    meta = await getRepoMeta(ref);
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : "Failed to resolve repo",
    };
    return;
  }

  yield {
    type: "started",
    repo: meta.fullName,
    branch: meta.defaultBranch,
  };

  const ctx: AgentContext = {
    ref,
    branch: meta.defaultBranch,
    v0Key: args.v0Key,
  };

  const tools = makeTools(ctx);

  // Track tool-call timing so we can report durations.
  const toolStarts = new Map<string, number>();

  let stepCounter = 0;

  try {
    const result = streamText({
      model: MODEL,
      system: SYSTEM_PROMPT,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      messages: [
        {
          role: "user",
          content: `Investigate ${meta.fullName} (${args.repoUrl}) and ship the right interactive product for it.`,
        },
      ],
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": {
          if (part.text) yield { type: "agent_text", text: part.text };
          break;
        }
        case "tool-call": {
          toolStarts.set(part.toolCallId, Date.now());
          yield {
            type: "tool_call",
            toolCallId: part.toolCallId,
            name: part.toolName,
            args: part.input,
          };
          break;
        }
        case "tool-result": {
          const start = toolStarts.get(part.toolCallId) ?? Date.now();
          yield {
            type: "tool_result",
            toolCallId: part.toolCallId,
            name: part.toolName,
            result: part.output,
            durationMs: Date.now() - start,
          };
          break;
        }
        case "finish-step": {
          stepCounter += 1;
          yield { type: "step_finished", step: stepCounter };
          break;
        }
        case "error": {
          const e = part.error as unknown;
          yield {
            type: "error",
            message: e instanceof Error ? e.message : String(e),
          };
          break;
        }
        default:
          break;
      }
    }

    if (ctx.result) {
      yield { type: "commissioned", result: ctx.result };
      yield { type: "done", reason: "commissioned" };
    } else {
      yield {
        type: "done",
        reason: "agent stopped without commissioning v0",
      };
    }
  } catch (err) {
    yield {
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
