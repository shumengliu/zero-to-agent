// Agent tools. Each tool wraps a GitHub primitive (lib/github.ts) or the v0
// commission (lib/commission.ts) and exposes it to the AI SDK loop.
//
// The agent is expected to:
//   1. Call github_stats once to orient.
//   2. Call fetch_readme + fetch_manifest as needed.
//   3. Drill into specific files with read_file / list_dir / search_code.
//   4. Pick an archetype + draft a marketing brief.
//   5. Call commission_v0 exactly once as the terminal action.

import { tool } from "ai";
import { z } from "zod";
import {
  getFile,
  getLanguages,
  getReadme,
  getRepoMeta,
  listDir,
  searchCode,
  truncate,
  type RepoRef,
} from "./github";
import { commissionV0, type CommissionResult } from "./commission";
import { archetypeEnum, briefSchema, tableSchema } from "./schema";

export type AgentContext = {
  ref: RepoRef;
  branch: string;
  v0Key: string;
  // Filled in by commission_v0.
  result?: CommissionResult;
};

const FILE_BUDGET = 20_000;

export function makeTools(ctx: AgentContext) {
  return {
    github_stats: tool({
      description:
        "Fetch high-level repo metadata: stars, forks, primary language, language breakdown, topics, license, default branch, last push.",
      inputSchema: z.object({}),
      execute: async () => {
        const [meta, langs] = await Promise.all([
          getRepoMeta(ctx.ref),
          getLanguages(ctx.ref),
        ]);
        return { ...meta, languages: langs };
      },
    }),

    fetch_readme: tool({
      description:
        "Fetch the repo's README. Use this first to understand what the project is.",
      inputSchema: z.object({}),
      execute: async () => {
        const readme = await getReadme(ctx.ref);
        if (!readme) return { found: false, content: null };
        return { found: true, content: truncate(readme, 8000) };
      },
    }),

    fetch_manifest: tool({
      description:
        "Fetch a single dependency manifest (package.json, Cargo.toml, pyproject.toml, go.mod, Dockerfile, etc.) to learn the project's stack.",
      inputSchema: z.object({
        name: z
          .string()
          .describe(
            "Manifest filename, e.g. 'package.json' or 'Cargo.toml'. Must be a top-level path.",
          ),
      }),
      execute: async ({ name }) => {
        const text = await getFile(ctx.ref, name, ctx.branch);
        if (!text) return { found: false, content: null };
        return { found: true, content: truncate(text, 4000) };
      },
    }),

    list_dir: tool({
      description:
        "List files and subdirectories at a given path inside the repo. Use '' or '/' for the repo root.",
      inputSchema: z.object({
        path: z.string().describe("Directory path. Use '' for the root."),
      }),
      execute: async ({ path }) => {
        const entries = await listDir(ctx.ref, path, ctx.branch);
        return { entries: entries.slice(0, 80) };
      },
    }),

    read_file: tool({
      description:
        "Read the contents of a specific file in the repo. Use sparingly — prefer manifests and the README first.",
      inputSchema: z.object({
        path: z.string().describe("File path relative to repo root."),
      }),
      execute: async ({ path }) => {
        const text = await getFile(ctx.ref, path, ctx.branch);
        if (!text) return { found: false, content: null };
        return { found: true, content: truncate(text, FILE_BUDGET) };
      },
    }),

    search_code: tool({
      description:
        "Search the repo for a code pattern (GitHub code search). Returns up to 10 file paths with matching fragments.",
      inputSchema: z.object({
        query: z.string().describe("Search query — keyword or symbol."),
      }),
      execute: async ({ query }) => {
        const hits = await searchCode(ctx.ref, query);
        return { hits };
      },
    }),

    commission_v0: tool({
      description:
        "Terminal action. Call this exactly once after you've gathered enough context. Generates the final v0 chat with the chosen archetype and brief.",
      inputSchema: z.object({
        archetype: archetypeEnum.describe(
          "What kind of product to ship: 'playground' (interactive try-it-now for a library/CLI), 'explorer' (queryable UI for data/spec repos), 'gallery' (submission + voting hub), 'docs_hub' (docs site with comments/Q&A), or 'landing' (marketing page — fallback for infra repos with no obvious interactive surface).",
        ),
        brief: briefSchema.describe(
          "Structured marketing brief filled from your investigation.",
        ),
        schema: z
          .array(tableSchema)
          .optional()
          .describe(
            "Postgres schema for archetypes that need persistence (playground, explorer, gallery, docs_hub). Omit for landing pages.",
          ),
      }),
      execute: async (args) => {
        const result = await commissionV0({
          ref: ctx.ref,
          v0Key: ctx.v0Key,
          archetype: args.archetype,
          brief: args.brief,
          schema: args.schema,
        });
        ctx.result = result;
        return {
          chatId: result.chatId,
          webUrl: result.webUrl,
          demoUrl: result.demoUrl,
          status: result.status,
        };
      },
    }),
  };
}

export type AgentTools = ReturnType<typeof makeTools>;
