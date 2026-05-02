// Shared zod schemas + types used by both the agent tools and the v0
// commission. Extracted to break a circular import between tools.ts and
// commission.ts.

import { z } from "zod";

export const archetypeEnum = z.enum([
  "playground",
  "explorer",
  "gallery",
  "docs_hub",
  "landing",
]);

export type Archetype = z.infer<typeof archetypeEnum>;

export const briefSchema = z.object({
  audience: z.string(),
  problem: z.string(),
  valueProp: z
    .string()
    .describe("One-sentence value prop. Must be specific."),
  features: z
    .array(z.object({ title: z.string(), evidence: z.string() }))
    .min(3)
    .max(6),
  heroCopy: z.object({
    eyebrow: z.string(),
    headline: z.string(),
    subhead: z.string(),
  }),
  socialProof: z
    .string()
    .describe(
      "Stars, contributor count, notable users, recent activity — anything credible.",
    ),
});

export type AgentBrief = z.infer<typeof briefSchema>;

export const tableSchema = z.object({
  table: z.string(),
  columns: z.array(z.string()),
  purpose: z.string(),
});

export type TableSchema = z.infer<typeof tableSchema>;
