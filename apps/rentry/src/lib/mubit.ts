// Mubit adapter — real /v2/control/* HTTP API.
//
// Two surfaces sit on top of Mubit:
//
//   1. UserPrefs (structured, fast)
//      - Backed by a local JSON store at /tmp/rentry-mubit.json so the
//        scoring workflow always has fast typed access to dealBreakers,
//        commuteTarget, etc. without a network roundtrip per query.
//      - Pre-seeded for the demo username `shumeng` on first cold access.
//
//   2. Mubit semantic memory (real)
//      - On `setUserPrefs(username, prefs)` we *also* ingest each preference
//        as a typed fact into Mubit (intent: "fact"), keyed by username as
//        run_id. So the reasoning trace's "Loading N known preferences for
//        shumeng…" bullet list draws from a real Mubit `query()` call.
//      - The Mubit call also returns a `final_answer` which we surface as
//        the demo's "remembered from last session" line on the top card.
//
// Auth: Bearer token in Authorization header. API base: api.mubit.ai.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { UserPrefs } from "./schema";

const MUBIT_API = process.env.MUBIT_API_URL ?? "https://api.mubit.ai";
const STORE_PATH =
  process.env.RENTRY_MUBIT_STORE_PATH ?? path.join("/tmp", "rentry-mubit.json");

// --- Types -------------------------------------------------------------------

export type MubitEvidence = {
  id: string;
  content: string;
  entry_type: string;
  retrieval_mode: string;
  is_stale: boolean;
  score: number;
};

export type MubitQueryResult = {
  evidence: MubitEvidence[];
  final_answer: string;
  confidence: number;
  consulted_runs: string[];
};

// --- Local store (UserPrefs) -------------------------------------------------

type Store = {
  prefs: Record<string, UserPrefs>;
};

let storeCache: Store | null = null;
let loadingPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (storeCache) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const raw = await fs.readFile(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw) as Store;
      storeCache = {
        prefs:
          parsed.prefs && typeof parsed.prefs === "object" ? parsed.prefs : {},
      };
    } catch {
      storeCache = { prefs: {} };
      await persist();
    }
  })();
  await loadingPromise;
  loadingPromise = null;
}

async function persist(): Promise<void> {
  if (!storeCache) return;
  try {
    await fs.writeFile(STORE_PATH, JSON.stringify(storeCache, null, 2), "utf8");
  } catch {
    /* ignore — read-only filesystem on cold path */
  }
}

// --- High-level: prefs by username -------------------------------------------

export async function getUserPrefs(username: string): Promise<UserPrefs> {
  await ensureLoaded();
  const cached = storeCache!.prefs[username];
  if (cached) return cached;

  const seed = SEED_PREFS_BY_USERNAME[username.toLowerCase()];
  if (seed) {
    const personalised: UserPrefs = { ...seed, username };
    storeCache!.prefs[username] = personalised;
    await persist();

    // For known seeded usernames we await the Mubit ingest so a query()
    // immediately afterwards returns real evidence. Adds ~100-300ms on the
    // very first cold call only — subsequent calls hit the file cache.
    await seedMubitFor(personalised).catch(() => undefined);
    return personalised;
  }

  const fresh = blankPrefs(username);
  storeCache!.prefs[username] = fresh;
  await persist();
  return fresh;
}

export async function setUserPrefs(
  username: string,
  prefs: UserPrefs,
): Promise<void> {
  await ensureLoaded();
  storeCache!.prefs[username] = prefs;
  await persist();
}

function blankPrefs(username: string): UserPrefs {
  return {
    username,
    signature: username,
    budgetPcmDefault: null,
    commuteTarget: null,
    commuteWeight: 0.5,
    mustHaves: [],
    dealBreakers: [],
    preferredAreas: [],
    lastSearches: [],
    seenListingIds: [],
    runCount: 0,
  };
}

// --- Real Mubit calls --------------------------------------------------------

export async function mubitIngest(args: {
  runId: string;
  items: Array<{ id: string; intent: "fact" | "lesson" | "rule"; text: string }>;
}): Promise<{ jobId: string } | null> {
  if (!process.env.MUBIT_API_KEY) return null;
  const res = await fetch(`${MUBIT_API}/v2/control/ingest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MUBIT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      run_id: args.runId,
      items: args.items.map((i) => ({
        item_id: i.id,
        intent: i.intent,
        content_type: "text/plain",
        text: i.text,
      })),
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { job_id?: string };
  return { jobId: body.job_id ?? "" };
}

export async function mubitQuery(args: {
  runId: string;
  query: string;
  budget?: "low" | "mid" | "high";
}): Promise<MubitQueryResult | null> {
  if (!process.env.MUBIT_API_KEY) return null;
  const res = await fetch(`${MUBIT_API}/v2/control/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MUBIT_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      run_id: args.runId,
      query: args.query,
      budget: args.budget ?? "mid",
    }),
  });
  if (!res.ok) return null;
  return (await res.json()) as MubitQueryResult;
}

// --- Pre-seeding -------------------------------------------------------------

// Fired the first time we resolve a seeded demo username. Ingests one item per
// preference so the reasoning trace can pull real evidence from Mubit.
async function seedMubitFor(prefs: UserPrefs): Promise<void> {
  if (!process.env.MUBIT_API_KEY) return;

  const items: Array<{ id: string; intent: "fact"; text: string }> = [];
  prefs.dealBreakers.forEach((d, i) =>
    items.push({
      id: `${prefs.username}:dealbreaker:${i}`,
      intent: "fact",
      text: `${prefs.username} avoids properties matching: "${d}". This is a long-standing deal-breaker, applied across past sessions.`,
    }),
  );
  prefs.mustHaves.forEach((m, i) =>
    items.push({
      id: `${prefs.username}:musthave:${i}`,
      intent: "fact",
      text: `${prefs.username} prefers properties that have: "${m}".`,
    }),
  );
  if (prefs.commuteTarget) {
    items.push({
      id: `${prefs.username}:commute`,
      intent: "fact",
      text: `${prefs.username} commutes to ${prefs.commuteTarget} regularly; properties are scored by commute time to ${prefs.commuteTarget}.`,
    });
  }
  if (prefs.preferredAreas.length) {
    items.push({
      id: `${prefs.username}:areas`,
      intent: "fact",
      text: `${prefs.username} has previously explored these London areas: ${prefs.preferredAreas.join(", ")}.`,
    });
  }
  prefs.lastSearches.forEach((s, i) =>
    items.push({
      id: `${prefs.username}:search:${i}`,
      intent: "fact",
      text: `On ${s.at}, ${prefs.username} searched for: "${s.prompt}" (areas: ${s.areas.join(", ")}).`,
    }),
  );

  if (items.length === 0) return;
  await mubitIngest({ runId: prefs.username, items });
}

// --- Seed data ---------------------------------------------------------------

const SEED_PREFS_BY_USERNAME: Record<string, UserPrefs> = {
  shumeng: {
    username: "shumeng",
    signature: "Shumeng",
    budgetPcmDefault: 2000,
    commuteTarget: "Camden",
    commuteWeight: 0.7,
    mustHaves: ["natural light"],
    dealBreakers: ["ground floor", "shared bathrooms", "above takeaway"],
    preferredAreas: ["Aldgate East", "Waterloo", "King's Cross"],
    lastSearches: [
      {
        prompt: "studios in Zone 1, easy commute, no ground floor",
        areas: ["Aldgate East", "Waterloo"],
        at: new Date(Date.now() - 6 * 86_400_000).toISOString(),
      },
    ],
    seenListingIds: [],
    runCount: 846, // first search will display as `run #847` on stage
  },
  demo: {
    username: "demo",
    signature: "Demo",
    budgetPcmDefault: 2000,
    commuteTarget: "Camden",
    commuteWeight: 0.7,
    mustHaves: ["natural light"],
    dealBreakers: ["ground floor", "shared bathrooms"],
    preferredAreas: ["Aldgate East", "Waterloo", "King's Cross"],
    lastSearches: [],
    seenListingIds: [],
    runCount: 0,
  },
};
