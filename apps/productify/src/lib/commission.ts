// Final terminal step: turn the agent's brief + archetype into a v0 chat.
// Polls briefly so the UI gets a demoUrl whenever possible.

import { v0, createClient, type ChatDetail } from "v0-sdk";
import type { AgentBrief, Archetype, TableSchema } from "./schema";
import type { RepoRef } from "./github";

export type CommissionResult = {
  chatId: string;
  versionId: string | null;
  webUrl: string | null;
  demoUrl: string | null;
  status: "pending" | "completed" | "failed" | "unknown";
  archetype: Archetype;
  prompt: string;
};

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 90_000;

export async function commissionV0(args: {
  ref: RepoRef;
  v0Key: string;
  archetype: Archetype;
  brief: AgentBrief;
  schema?: TableSchema[];
}): Promise<CommissionResult> {
  const prompt = buildCommissionPrompt(args);

  const client = args.v0Key ? createClient({ apiKey: args.v0Key }) : v0;

  const created = await client.chats.create({
    message: prompt,
    responseMode: "sync",
    chatPrivacy: "unlisted",
  });

  if (created instanceof ReadableStream) {
    throw new Error("Unexpected streaming response from v0.chats.create");
  }

  let chat: ChatDetail = created;
  const start = Date.now();
  while (
    chat.latestVersion?.status === "pending" &&
    !chat.latestVersion.demoUrl &&
    Date.now() - start < POLL_TIMEOUT_MS
  ) {
    await sleep(POLL_INTERVAL_MS);
    chat = await client.chats.getById({ chatId: chat.id });
  }

  return {
    chatId: chat.id,
    versionId: chat.latestVersion?.id ?? null,
    webUrl: chat.webUrl,
    demoUrl: chat.latestVersion?.demoUrl ?? null,
    status: chat.latestVersion?.status ?? "unknown",
    archetype: args.archetype,
    prompt,
  };
}

function buildCommissionPrompt(args: {
  ref: RepoRef;
  archetype: Archetype;
  brief: AgentBrief;
  schema?: TableSchema[];
}): string {
  const { ref, archetype, brief, schema } = args;
  const archetypeBlock = archetypeInstructions(archetype);
  const repoUrl = `https://github.com/${ref.owner}/${ref.name}`;
  const featureList = brief.features
    .map((f, i) => `${i + 1}. **${f.title}** — ${f.evidence}`)
    .join("\n");
  const schemaBlock =
    schema && schema.length
      ? schema
          .map(
            (t) =>
              `- \`${t.table}(${t.columns.join(", ")})\` — ${t.purpose}`,
          )
          .join("\n")
      : "(no persistent state)";

  return [
    `Build a polished, production-feeling Next.js + Tailwind app that turns the GitHub project below into a working, interactive web product. This is not a marketing page — it is an actual app that lives.`,
    ``,
    `# Source repo`,
    `- ${ref.owner}/${ref.name}`,
    `- ${repoUrl}`,
    ``,
    `# Output archetype: ${archetype}`,
    archetypeBlock,
    ``,
    `# Marketing brief (use this verbatim where the UI calls for copy)`,
    `- Audience: ${brief.audience}`,
    `- Problem: ${brief.problem}`,
    `- Value prop: ${brief.valueProp}`,
    `- Hero eyebrow: ${brief.heroCopy.eyebrow}`,
    `- Hero headline: ${brief.heroCopy.headline}`,
    `- Hero subhead: ${brief.heroCopy.subhead}`,
    `- Social proof: ${brief.socialProof}`,
    ``,
    `# Features (each backed by repo evidence)`,
    featureList,
    ``,
    `# Persistent state (Postgres / Vercel Postgres)`,
    schemaBlock,
    ``,
    `# Design direction`,
    `- Editorial dark aesthetic. Background near-black (#07070a). Foreground near-white.`,
    `- Sans: Geist. Headline accents in Instrument Serif italic.`,
    `- Subtle warm/cool radial gradients in the background. Tasteful grain texture.`,
    `- No stock photography. Real code snippets and typography for visual interest.`,
    `- Smooth-scroll anchors are fine; no client-side router.`,
    ``,
    `# Constraints`,
    `- Do not invent features. Stick to the brief above.`,
    `- All external links to the project go to ${repoUrl}.`,
    `- If a database is specified, wire it with Vercel Postgres + server actions. Show real CRUD, not fake state.`,
    `- Sticky top nav with the project name and a "View on GitHub" link to ${repoUrl}.`,
    `- Footer mentions: source repo, license, primary language, "Built with v0 by productify".`,
  ].join("\n");
}

function archetypeInstructions(a: Archetype): string {
  switch (a) {
    case "playground":
      return `Build a hosted playground for the library/CLI. The user pastes input, sees output. Save runs to Postgres so they can be revisited and shared via permalink. Include 3 pre-loaded example inputs the user can click. Feature the most-used / canonical operation of the project.`;
    case "explorer":
      return `Build a queryable explorer for the repo's data, spec, or schema. Searchable index, detail pages per item, ability to bookmark items in Postgres. Filters and a clean table view. Real data — extract from the repo's own data files where possible.`;
    case "gallery":
      return `Build a submission gallery + leaderboard. Users can submit creations made with the project, vote, and browse top entries. Postgres stores submissions and votes. Include a few seed entries that look real.`;
    case "docs_hub":
      return `Build a docs hub: structured documentation pulled from the README and repo, with a per-page comment thread (Postgres) and a search bar. Treat docs as the primary surface, comments as secondary.`;
    case "landing":
      return `Build a single-page editorial landing page: hero, "what it is", quickstart, features, how it works, footer. No persistence. Use this only when the repo has no obvious interactive surface (kernel modules, internal infra, etc.).`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
