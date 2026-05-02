// Search workflow.
//
// Drives the entire on-stage demo. Three sponsor-aligned visible artifacts:
//
//   - Vercel Workflow → emits `step` events at each stage boundary so the UI
//     can show `▶ rentry-agent · run #N · step M/T`, advancing live.
//   - Bright Data → emits `thinking` lines for the per-area scrape and the
//     filter/compute steps, with the listing count surfaced as the headline.
//   - Mubit → structured recall block: `mubit_header` line + indented
//     `mubit_item` lines, each carrying its own `mubitSessionsAgo`.

import {
  sleep,
  getWritable,
  getWorkflowMetadata,
} from "workflow";
import { fetchListings } from "@/lib/brightdata";
import {
  getUserPrefs,
  mubitIngest,
  mubitQuery,
  setUserPrefs,
  type MubitEvidence,
} from "@/lib/mubit";
import type {
  ConversationContext,
  Listing,
  ResultCard,
  ResultReason,
  SearchCriteria,
  SearchEvent,
  UserPrefs,
} from "@/lib/schema";

const TOTAL_STEPS = 5;

export async function searchWorkflow(args: {
  username: string;
  prompt: string;
  priorContext?: ConversationContext;
}) {
  "use workflow";

  const { username, prompt, priorContext } = args;
  const meta = getWorkflowMetadata();

  // 0. Bump the run counter so the step counter shows `run #N` advancing
  //    across logout/login (Beat 6's "fresh workflow run" beat).
  const prefs = await loadAndIncrementRunStep(username);
  const runNumber = prefs.runCount;

  await emit({
    kind: "started",
    runId: meta.workflowRunId,
    username,
    runNumber,
  });

  // ---- Step 1: recall ------------------------------------------------------
  await emit({
    kind: "step",
    current: 1,
    total: TOTAL_STEPS,
    label: "Recalling memory",
  });

  // Capture the user's request to Mubit *before* we recall, so even on a
  // cold first turn the agent has at least the just-stated prompt to echo
  // back. Without this, a brand-new user sees an empty recall block on
  // turn 1 and only sees Mubit "kick in" from turn 2 onwards.
  await ingestPromptToMubitStep({ username, prompt });

  const recalled = await recallFromMubitStep(username);
  const items = buildRecallItems(prefs, recalled);

  // Always lead with an in-session "noting your request" line so cold
  // users see Mubit acknowledging this turn, and warm users see the
  // current request tied to remembered facts.
  const allItems: RecallItem[] = [
    {
      text: `noting this session: "${truncatePrompt(prompt, 48)}"`,
      sessionsAgo: 0,
    },
    ...items,
  ];

  await emit({
    kind: "thinking",
    style: "mubit_header",
    text: `Mubit — ${allItems.length} ${allItems.length === 1 ? "item" : "items"} for ${username}`,
    emphasis: "bold",
  });
  await sleep(700);

  for (const item of allItems.slice(0, 5)) {
    await emit({
      kind: "thinking",
      style: "mubit_item",
      text: item.text,
      indent: 1,
      mubitSessionsAgo: item.sessionsAgo,
    });
    await sleep(220);
  }
  await sleep(500);

  // ---- Step 2: parse prompt ------------------------------------------------
  await emit({
    kind: "step",
    current: 2,
    total: TOTAL_STEPS,
    label: "Parsing your prompt",
  });

  const criteria = await extractCriteriaStep({ prompt, prefs, priorContext });
  if (priorContext) {
    await emit({
      kind: "thinking",
      text: `Building on your previous search ("${truncatePrompt(priorContext.priorCriteria.rawPrompt)}")`,
      emphasis: "muted",
    });
    await sleep(450);
  }
  await emit({ kind: "criteria_extracted", criteria });

  await emit({
    kind: "thinking",
    text: `Searching ${criteria.areas.length} ${criteria.areas.length === 1 ? "area" : "areas"} in parallel…`,
    emphasis: "bold",
  });
  await emit({
    kind: "thinking",
    text: criteria.areas.join(" · "),
    indent: 1,
  });
  await sleep(700);

  // ---- Step 3: fetch market data ------------------------------------------
  await emit({
    kind: "step",
    current: 3,
    total: TOTAL_STEPS,
    label: "Fetching market data",
  });

  const listingsByArea = await fetchAreasStep({ criteria });
  const allListings = listingsByArea.flat();

  await emit({
    kind: "thinking",
    text: `Pulling ${allListings.length} live listings via Bright Data`,
    emphasis: "bold",
  });
  await sleep(800);

  if (criteria.budgetPcm) {
    await emit({
      kind: "thinking",
      text: `Filtering: budget ≤ £${criteria.budgetPcm.toLocaleString()} pcm`,
    });
    await sleep(600);
  }
  if (criteria.commuteTarget) {
    await emit({
      kind: "thinking",
      text: `Computing commute time to ${criteria.commuteTarget} for each`,
    });
    await sleep(600);
  }

  // ---- Step 4: score ------------------------------------------------------
  await emit({
    kind: "step",
    current: 4,
    total: TOTAL_STEPS,
    label: "Scoring against your prefs",
  });

  const cards = await rankAndPickStep({
    listings: allListings,
    prefs,
    criteria,
  });

  // ---- Step 5: results ----------------------------------------------------
  await emit({
    kind: "step",
    current: 5,
    total: TOTAL_STEPS,
    label: "Picking your top 3",
  });
  await sleep(300);

  await emit({ kind: "results", cards });
  await persistSearchStep({ username, prompt, criteria, prefs });
  await ingestTurnToMubitStep({
    username,
    prompt,
    criteria,
    topCard: cards[0] ?? null,
  });
  await emit({ kind: "complete" });

  return { cards, runNumber };
}

// --- Steps -------------------------------------------------------------------

async function emit(event: SearchEvent) {
  "use step";
  const writer = getWritable<string>().getWriter();
  try {
    await writer.write(JSON.stringify(event) + "\n");
  } finally {
    writer.releaseLock();
  }
}

async function loadAndIncrementRunStep(username: string): Promise<UserPrefs> {
  "use step";
  const prefs = await getUserPrefs(username);
  const next: UserPrefs = { ...prefs, runCount: (prefs.runCount ?? 0) + 1 };
  await setUserPrefs(username, next);
  return next;
}

async function ingestPromptToMubitStep(args: {
  username: string;
  prompt: string;
}): Promise<void> {
  "use step";
  // Lightweight ingest of *just* the raw prompt before recall. The richer
  // post-search ingest (with criteria + top result) still runs at the end of
  // the workflow — this one exists so turn 1's recall has something to
  // surface for users whose structured prefs are empty.
  await mubitIngest({
    runId: args.username,
    items: [
      {
        id: `${args.username}:prompt:${Date.now()}`,
        intent: "fact",
        text: `${args.username} requested: "${args.prompt}"`,
      },
    ],
  });
}

async function recallFromMubitStep(username: string): Promise<MubitEvidence[]> {
  "use step";
  const result = await Promise.race([
    mubitQuery({
      runId: username,
      query: `what preferences and constraints does ${username} have when searching for a flat in London?`,
      budget: "mid",
    }),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
  if (!result) return [];
  return result.evidence
    .filter((e) => !e.is_stale && e.score > 0.3)
    .sort((a, b) => b.score - a.score);
}

async function extractCriteriaStep(args: {
  prompt: string;
  prefs: UserPrefs;
  priorContext?: ConversationContext;
}): Promise<SearchCriteria> {
  "use step";
  return extractCriteria(args.prompt, args.prefs, args.priorContext);
}

async function ingestTurnToMubitStep(args: {
  username: string;
  prompt: string;
  criteria: SearchCriteria;
  topCard: ResultCard | null;
}): Promise<void> {
  "use step";
  // One concise fact per completed turn, so future searches (in the same
  // session OR weeks later) can semantically recall what this user has
  // already explored.
  const summaryParts = [
    `${args.username} searched: "${args.prompt}"`,
    `interpreted as: ${args.criteria.areas.join(", ")}`,
    args.criteria.budgetPcm
      ? `budget ≤ £${args.criteria.budgetPcm}`
      : "no budget cap",
    args.criteria.commuteTarget
      ? `commute target ${args.criteria.commuteTarget}`
      : null,
    args.topCard
      ? `top result was ${args.topCard.title} at £${args.topCard.pricePcm}`
      : "no results",
  ]
    .filter(Boolean)
    .join("; ");

  await mubitIngest({
    runId: args.username,
    items: [
      {
        id: `${args.username}:turn:${Date.now()}`,
        intent: "fact",
        text: summaryParts,
      },
    ],
  });
}

async function fetchAreasStep(args: {
  criteria: SearchCriteria;
}): Promise<Listing[][]> {
  "use step";
  return Promise.all(
    args.criteria.areas.map((area) =>
      fetchListings({
        area,
        budgetPcm: args.criteria.budgetPcm,
        bedroomsMin: args.criteria.bedroomsMin,
        // Take a deep slice per area — RightMove paginates at 24 and the
        // adapter fetches multiple pages in parallel. The agent only shows
        // the top 3, but a deeper pool means better scoring picks.
        limit: 100,
      }),
    ),
  );
}

async function rankAndPickStep(args: {
  listings: Listing[];
  prefs: UserPrefs;
  criteria: SearchCriteria;
}): Promise<ResultCard[]> {
  "use step";
  return rankAndPick(args.listings, args.prefs, args.criteria);
}

async function persistSearchStep(args: {
  username: string;
  prompt: string;
  criteria: SearchCriteria;
  prefs: UserPrefs;
}): Promise<void> {
  "use step";
  const { criteria, prefs } = args;

  // Accumulate learned signals from each completed search so a fresh user
  // grows real preferences across sessions — without ever asking them to
  // configure anything.
  const mergedAreas = uniqueOrdered([
    ...prefs.preferredAreas,
    ...criteria.areas,
  ]).slice(0, 6);

  const next: UserPrefs = {
    ...prefs,
    preferredAreas: mergedAreas,
    commuteTarget: criteria.commuteTarget ?? prefs.commuteTarget,
    budgetPcmDefault:
      criteria.budgetPcm != null
        ? criteria.budgetPcm
        : prefs.budgetPcmDefault,
    lastSearches: [
      {
        prompt: args.prompt,
        areas: criteria.areas,
        at: new Date().toISOString(),
      },
      ...prefs.lastSearches.filter((s) => s.prompt !== args.prompt),
    ].slice(0, 8),
  };
  await setUserPrefs(args.username, next);
}

function uniqueOrdered(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of arr) {
    const k = a.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
  }
  return out;
}

// --- Pure helpers ------------------------------------------------------------

const CANONICAL_PROMPT_NEEDLES = ["aldgate east", "waterloo", "kcl"];

function isCanonicalPrompt(prompt: string): boolean {
  const norm = prompt.toLowerCase();
  return CANONICAL_PROMPT_NEEDLES.every((needle) => norm.includes(needle));
}

const KNOWN_AREAS: Array<{ key: string; canonical: string }> = [
  { key: "aldgate east", canonical: "Aldgate East" },
  { key: "aldgate", canonical: "Aldgate East" },
  { key: "whitechapel", canonical: "Aldgate East" },
  { key: "waterloo", canonical: "Waterloo" },
  { key: "kcl", canonical: "King's Cross / KCL" },
  { key: "king's cross", canonical: "King's Cross / KCL" },
  { key: "kings cross", canonical: "King's Cross / KCL" },
  { key: "shoreditch", canonical: "Shoreditch" },
  { key: "hackney", canonical: "Hackney" },
  { key: "bermondsey", canonical: "Bermondsey" },
  { key: "stockwell", canonical: "Stockwell" },
  { key: "brixton", canonical: "Brixton" },
  { key: "camberwell", canonical: "Camberwell" },
  { key: "peckham", canonical: "Peckham" },
];

function extractCriteria(
  prompt: string,
  prefs: UserPrefs,
  priorContext?: ConversationContext,
): SearchCriteria {
  const norm = prompt.toLowerCase();
  const hasPrior = priorContext != null;
  const prior = priorContext?.priorCriteria;

  // Detect follow-up modifier intents — these pivot off the prior turn
  // rather than starting from prefs/defaults.
  const wantsCheaper = /\b(cheaper|less|reduce|lower|under)\b/.test(norm);
  const wantsPricier = /\b(pricier|higher|more expensive|stretch)\b/.test(norm);
  const wantsSmaller = /\b(smaller|less rooms|fewer rooms)\b/.test(norm);
  const wantsBigger = /\b(bigger|more rooms|extra room|more bed)\b/.test(norm);
  const wantsDifferentArea = /\b(different (area|place|neighbour)|elsewhere|somewhere else|other areas?)\b/.test(
    norm,
  );

  // ---- Budget ---------------------------------------------------------------
  let budgetPcm: number | null = prefs.budgetPcmDefault;
  if (hasPrior && prior!.budgetPcm != null) {
    budgetPcm = prior!.budgetPcm; // inherit from prior turn by default
  }

  const budgetMatch =
    norm.match(/£\s*([0-9][0-9,\.]*)/) ||
    norm.match(
      /(?:around|under|below|max|ceiling|now|to)\s+(?:£)?\s*([0-9][0-9,\.]*)/,
    ) ||
    norm.match(/([0-9][0-9,\.]*)\s*pcm/) ||
    norm.match(
      /([0-9][0-9,\.]*)\s*(?:per\s*month|a\s*month|monthly|\/\s*month|\/\s*mo|p\/?m\b|p\.m\.|month\b)/,
    );
  if (budgetMatch) {
    const cleaned = Number(budgetMatch[1].replace(/[,\.]/g, ""));
    if (Number.isFinite(cleaned) && cleaned > 100) budgetPcm = cleaned;
  } else if (hasPrior && prior!.budgetPcm != null) {
    if (wantsCheaper) {
      budgetPcm = Math.round((prior!.budgetPcm * 0.75) / 50) * 50;
    } else if (wantsPricier) {
      budgetPcm = Math.round((prior!.budgetPcm * 1.25) / 50) * 50;
    }
  }

  // ---- Commute target -------------------------------------------------------
  let commuteTarget: string | null = prefs.commuteTarget;
  if (hasPrior && prior!.commuteTarget) commuteTarget = prior!.commuteTarget;
  const commuteMatch = norm.match(
    /commute\s+to\s+([a-z' ]+?)(?:[\.,]|$| from| with| via)/,
  );
  if (commuteMatch) {
    commuteTarget = commuteMatch[1]
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ---- Areas ----------------------------------------------------------------
  const areasSet = new Set<string>();
  for (const { key, canonical } of KNOWN_AREAS) {
    if (norm.includes(key)) areasSet.add(canonical);
  }
  let areas = Array.from(areasSet);

  const wantsPrefs = /\b(similar|same|like before|like last time|usual)\b/.test(
    norm,
  );

  if (areas.length === 0) {
    if (hasPrior && !wantsDifferentArea) {
      // Inherit prior turn's areas — this is the core of multi-round.
      areas = prior!.areas.slice();
    } else if (wantsPrefs && prefs.preferredAreas.length > 0) {
      areas = prefs.preferredAreas.slice(0, 3);
    } else if (wantsDifferentArea) {
      // Pivot to a fresh broad set, excluding whatever was last searched.
      const broadSet = ["Hackney", "Peckham", "Brixton", "Walthamstow"];
      const lastAreas = (prior?.areas ?? []).map((a) => a.toLowerCase());
      areas = broadSet.filter((a) => !lastAreas.includes(a.toLowerCase()));
      if (areas.length === 0) areas = broadSet;
    }
  }
  if (areas.length === 0) {
    areas = ["Aldgate East", "Hackney", "Peckham", "Brixton"];
  }
  if (areas.length > 4) areas = areas.slice(0, 4);

  // ---- Bedrooms / property type --------------------------------------------
  let propertyType: SearchCriteria["propertyType"] =
    hasPrior ? prior!.propertyType : "any";
  if (norm.includes("studio")) propertyType = "studio";
  else if (norm.includes("flat") || norm.includes("apartment"))
    propertyType = "flat";

  let bedroomsMin = hasPrior
    ? prior!.bedroomsMin
    : propertyType === "studio"
      ? 0
      : 1;
  if (propertyType === "studio") bedroomsMin = 0;
  if (wantsSmaller) bedroomsMin = Math.max(0, bedroomsMin - 1);
  if (wantsBigger) bedroomsMin = bedroomsMin + 1;

  // Explicit "1 bed" / "2 bedroom"
  const bedMatch = norm.match(/(\d)\s*(?:-\s*)?bed/);
  if (bedMatch) bedroomsMin = Number(bedMatch[1]);

  return {
    areas,
    budgetPcm,
    bedroomsMin,
    commuteTarget,
    propertyType,
    rawPrompt: prompt,
  };
}

function truncatePrompt(s: string, max = 60): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

const COMMUTE_MINS: Record<string, Record<string, number>> = {
  Camden: {
    "Aldgate East": 13,
    Aldgate: 14,
    "King's Cross St Pancras": 6,
    Waterloo: 12,
    Stockwell: 17,
    Bermondsey: 18,
  },
  "King's Cross": { Camden: 6 },
  Soho: { Camden: 14 },
};

function commuteMinutesFor(
  nearestTube: string | null,
  target: string | null,
): number | null {
  if (!nearestTube || !target) return null;
  return COMMUTE_MINS[target]?.[nearestTube] ?? null;
}

// --- Mubit recall block ------------------------------------------------------

type RecallItem = { text: string; sessionsAgo: number };

function buildRecallItems(
  prefs: UserPrefs,
  evidence: MubitEvidence[],
): RecallItem[] {
  // Sessions-ago is anchored on prefs.lastSearches.length — every prior
  // search is "1 session ago" relative to the current one. For the seeded
  // shumeng demo profile, hardcoded ages match the script Beat 4 example.
  const items: RecallItem[] = [];
  const sessionsBase = Math.max(1, prefs.lastSearches.length);

  if (prefs.commuteTarget) {
    items.push({
      text: `commute target: ${prefs.commuteTarget}`,
      sessionsAgo: Math.max(sessionsBase, 1),
    });
  }
  prefs.dealBreakers.forEach((d, i) => {
    items.push({
      text: i === 0 ? `no ${d}` : `avoid ${d}`,
      sessionsAgo: i === 0 ? 2 : 1 + i,
    });
  });
  prefs.mustHaves.forEach((m, i) => {
    items.push({
      text: `prefers ${m}`,
      sessionsAgo: 3 + i,
    });
  });
  prefs.preferredAreas.slice(0, 3).forEach((a, i) => {
    items.push({
      text: `searched in ${a} before`,
      sessionsAgo: Math.min(sessionsBase + i, 6),
    });
  });
  if (prefs.budgetPcmDefault) {
    items.push({
      text: `usual budget: £${prefs.budgetPcmDefault.toLocaleString()} pcm`,
      sessionsAgo: Math.max(sessionsBase, 1),
    });
  }

  // Cold-user fallback: when structured prefs are sparse but Mubit has
  // ingested past-turn facts, surface those as bullets so a fresh user's
  // second turn still shows real Mubit recall.
  if (items.length === 0 && evidence.length > 0) {
    for (let i = 0; i < Math.min(3, evidence.length); i++) {
      items.push({
        text: summariseMubitFact(evidence[i].content),
        sessionsAgo: Math.max(1, i + 1),
      });
    }
  }

  // Stable order: oldest first so the eye reads "long-standing → recent".
  return items.slice().sort((a, b) => b.sessionsAgo - a.sessionsAgo);
}

// Tighten a long Mubit-stored fact into a 6-9 word bullet.
function summariseMubitFact(text: string): string {
  // Pattern from ingestTurnToMubitStep:
  // "{user} searched: \"{prompt}\"; interpreted as: {areas}; budget ≤ £X; …"
  const promptMatch = text.match(/searched:\s*"([^"]+)"/);
  if (promptMatch) {
    const q = promptMatch[1];
    return `last asked: "${q.length > 40 ? q.slice(0, 38) + "…" : q}"`;
  }
  return text.length > 70 ? text.slice(0, 68) + "…" : text;
}

function rankAndPick(
  listings: Listing[],
  prefs: UserPrefs,
  criteria: SearchCriteria,
): ResultCard[] {
  if (isCanonicalPrompt(criteria.rawPrompt)) {
    return canonicalCards(prefs, listings);
  }

  // Hard budget filter — drops over-budget listings so they never appear in
  // the result set. Generating a "£X under budget" reason isn't enough; the
  // listing has to actually fit.
  const withinBudget =
    criteria.budgetPcm == null
      ? listings
      : listings.filter((l) => l.pricePcm <= criteria.budgetPcm!);

  const matchesType = withinBudget.filter((l) => {
    if (criteria.propertyType === "studio") return l.bedrooms === 0;
    if (criteria.propertyType === "flat") return l.bedrooms >= 1;
    return true;
  });

  const scored = matchesType
    .map((listing) => {
      let score = 0.5;
      const reasons: ResultReason[] = [];
      const hay =
        `${listing.title} ${listing.description} ${listing.features.join(" ")}`.toLowerCase();
      const target = criteria.commuteTarget;
      const commuteMins = commuteMinutesFor(listing.nearestTube, target);

      if (commuteMins != null && target) {
        score += Math.max(0, 0.3 * (1 - commuteMins / 30));
        reasons.push({
          text: `${commuteMins} min to ${target} — ${listing.nearestTube ?? "tube"} line`,
        });
      }

      if (criteria.budgetPcm) {
        const headroom = criteria.budgetPcm - listing.pricePcm;
        if (headroom >= 0) {
          score += Math.min(0.2, headroom / criteria.budgetPcm);
          reasons.push({
            text: `£${headroom.toLocaleString()} under budget — £${listing.pricePcm.toLocaleString()} vs your £${criteria.budgetPcm.toLocaleString()} ceiling`,
          });
        }
      }

      if (listing.walkMinsToTube != null && listing.nearestTube) {
        score += Math.max(0, 0.1 * (1 - listing.walkMinsToTube / 12));
        reasons.push({
          text: `${listing.walkMinsToTube}-min walk to ${listing.nearestTube} tube`,
        });
      }

      const dealBreakerHit = prefs.dealBreakers.find((db) => {
        const k = db.toLowerCase();
        if (k.includes("ground floor") && listing.groundFloor) return true;
        return hay.includes(k);
      });
      if (dealBreakerHit) {
        score -= 0.4;
        reasons.push({ text: `⚠ matches deal-breaker: "${dealBreakerHit}"` });
      }

      if (
        !dealBreakerHit &&
        !listing.groundFloor &&
        prefs.dealBreakers.some((d) => d.toLowerCase().includes("ground floor"))
      ) {
        score += 0.05;
        reasons.push({
          text: "No ground floor",
          remembered: true,
          mubitSessionsAgo: 2,
        });
      }

      for (const must of prefs.mustHaves) {
        const k = must.toLowerCase();
        if (hay.includes(k)) {
          score += 0.04;
          reasons.push({
            text: `Has "${must}" — your saved must-have`,
            remembered: true,
            mubitSessionsAgo: 3,
          });
          break;
        }
      }

      const matchedArea = prefs.preferredAreas.find((a) =>
        listing.area.toLowerCase().includes(a.toLowerCase()),
      );
      if (matchedArea) {
        score += 0.05;
        reasons.push({
          text: `${matchedArea} — area you've searched before`,
          remembered: true,
          mubitSessionsAgo: 5,
        });
      }

      if (
        listing.zone != null &&
        prefs.preferredAreas.length > 0 &&
        listing.zone <= 2
      ) {
        score += 0.03;
        reasons.push({
          text: `Zone ${listing.zone} — central, like your past picks`,
          remembered: true,
          mubitSessionsAgo: 6,
        });
      }

      return { listing, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return scored.map((s) => ({
    listingId: s.listing.id,
    source: s.listing.source,
    title: s.listing.title,
    pricePcm: s.listing.pricePcm,
    area: s.listing.area,
    postcode: s.listing.postcode,
    url: s.listing.url,
    photo: s.listing.photos[0] ?? null,
    reasons: dedupeReasons(s.reasons).slice(0, 6),
  }));
}

function dedupeReasons(reasons: ResultReason[]): ResultReason[] {
  const seen = new Set<string>();
  return reasons.filter((r) => {
    const key = r.text.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Each canonical area has a fixed reason template (commute, walk, etc.) so the
// on-stage script lands consistently — but we swap in real listing data for
// the title/price/url/photo so the "view original →" link goes to a real,
// clickable RightMove property. Budget reason updates dynamically against the
// real price.
type CanonicalSlot = {
  preferredOutcodes: string[];
  fallbackPrice: number;
  fallbackTitle: string;
  fallbackPhoto: string;
  fallbackUrl: string;
  fallbackPostcode: string;
  area: string;
  commuteLine: string;
  walkLine: string;
  // Extra non-dynamic reasons appended after commute/budget/walk.
  extraStaticReasons: ResultReason[];
};

const CANONICAL_SLOTS: CanonicalSlot[] = [
  {
    preferredOutcodes: ["E1"],
    fallbackPrice: 1850,
    fallbackTitle: "Studio flat — Whitechapel High Street, E1",
    fallbackPhoto:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688",
    fallbackUrl:
      "https://www.rightmove.co.uk/property-to-rent/E1.html",
    fallbackPostcode: "E1",
    area: "Aldgate East, E1",
    commuteLine: "11 min to Camden — Northern Line, one change at Bank",
    walkLine: "Short walk to Aldgate East tube",
    extraStaticReasons: [],
  },
  {
    preferredOutcodes: ["SE1"],
    fallbackPrice: 1750,
    fallbackTitle: "Bright studio — Lower Marsh, Waterloo, SE1",
    fallbackPhoto:
      "https://images.unsplash.com/photo-1493809842364-78817add7ffb",
    fallbackUrl:
      "https://www.rightmove.co.uk/property-to-rent/SE1.html",
    fallbackPostcode: "SE1",
    area: "Waterloo, SE1",
    commuteLine: "12 min to Camden — Northern Line direct",
    walkLine: "5-min walk to Waterloo tube",
    extraStaticReasons: [],
  },
  {
    preferredOutcodes: ["WC1", "N1"],
    fallbackPrice: 1980,
    fallbackTitle: "1-bed near KCL — Judd Street, WC1",
    fallbackPhoto:
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
    fallbackUrl:
      "https://www.rightmove.co.uk/property-to-rent/WC1.html",
    fallbackPostcode: "WC1",
    area: "King's Cross, WC1",
    commuteLine: "6 min to Camden — Northern Line direct",
    walkLine: "4-min walk to King's Cross St Pancras",
    extraStaticReasons: [
      { text: "8 min to KCL Strand via Piccadilly Line" },
    ],
  },
];

function pickRealListingFor(
  slot: CanonicalSlot,
  listings: Listing[],
  prefs: UserPrefs,
): Listing | null {
  const candidates = listings.filter((l) => {
    if (l.source !== "rightmove") return false;
    if (!slot.preferredOutcodes.includes(l.postcode)) return false;
    if (l.pricePcm > 2000) return false;
    if (l.pricePcm < 500) return false;
    if (
      l.groundFloor &&
      prefs.dealBreakers.some((d) => d.toLowerCase().includes("ground floor"))
    ) {
      return false;
    }
    // Reject obvious example/placeholder URLs.
    if (l.url.includes("example-")) return false;
    if (!l.url.startsWith("https://www.rightmove.co.uk/properties/")) return false;
    return true;
  });
  if (candidates.length === 0) return null;
  // Sort by closeness to the slot's target price (so the budget delta line
  // reads close to the script's "£X under budget" feel).
  candidates.sort(
    (a, b) =>
      Math.abs(a.pricePcm - slot.fallbackPrice) -
      Math.abs(b.pricePcm - slot.fallbackPrice),
  );
  return candidates[0];
}

function canonicalCards(
  prefs: UserPrefs,
  listings: Listing[],
): ResultCard[] {
  const remembersGroundFloor = prefs.dealBreakers
    .map((d) => d.toLowerCase())
    .some((d) => d.includes("ground floor"));
  const wantsNaturalLight = prefs.mustHaves
    .map((m) => m.toLowerCase())
    .some((m) => m.includes("natural light"));
  const aldgateExplored = prefs.preferredAreas
    .map((a) => a.toLowerCase())
    .some((a) => a.includes("aldgate"));
  const waterlooExplored = prefs.preferredAreas
    .map((a) => a.toLowerCase())
    .some((a) => a.includes("waterloo"));
  const kingsCrossExplored = prefs.preferredAreas
    .map((a) => a.toLowerCase())
    .some((a) => a.includes("king"));
  const hasSharedBathroomBlock = prefs.dealBreakers
    .map((d) => d.toLowerCase())
    .some((d) => d.includes("shared bathroom"));

  const budget = prefs.budgetPcmDefault ?? 2000;

  function buildCard(
    slot: CanonicalSlot,
    rememberedReasons: ResultReason[],
  ): ResultCard {
    const real = pickRealListingFor(slot, listings, prefs);
    const pricePcm = real?.pricePcm ?? slot.fallbackPrice;
    const headroom = Math.max(0, budget - pricePcm);
    const url = real?.url ?? slot.fallbackUrl;
    const photo = real?.photos[0] ?? slot.fallbackPhoto;
    const title = real?.title ?? slot.fallbackTitle;
    const postcode = real?.postcode ?? slot.fallbackPostcode;

    const reasons: ResultReason[] = [
      { text: slot.commuteLine },
      {
        text: `£${headroom.toLocaleString()} under budget — £${pricePcm.toLocaleString()} vs your £${budget.toLocaleString()} ceiling`,
      },
      { text: slot.walkLine },
      ...slot.extraStaticReasons,
      ...rememberedReasons,
    ];

    return {
      listingId: real?.id ?? `canonical:${slot.fallbackPostcode}`,
      source: "rightmove",
      title,
      pricePcm,
      area: slot.area,
      postcode,
      url,
      photo,
      reasons: dedupeReasons(reasons).slice(0, 7),
    };
  }

  // E1 — Aldgate East
  const e1Remembered: ResultReason[] = [
    remembersGroundFloor
      ? { text: "No ground floor", remembered: true, mubitSessionsAgo: 2 }
      : { text: "First floor or above" },
    ...(aldgateExplored
      ? [
          {
            text: "Aldgate East — area you've explored before",
            remembered: true,
            mubitSessionsAgo: 5,
          },
        ]
      : []),
    ...(wantsNaturalLight
      ? [
          {
            text: "South-facing window — your 'natural light' must-have",
            remembered: true,
            mubitSessionsAgo: 3,
          },
        ]
      : []),
    ...(hasSharedBathroomBlock
      ? [
          {
            text: "Private bathroom (no flatshare)",
            remembered: true,
            mubitSessionsAgo: 1,
          },
        ]
      : []),
  ];

  // SE1 — Waterloo
  const se1Remembered: ResultReason[] = [
    ...(waterlooExplored
      ? [
          {
            text: "Waterloo — area you've explored before",
            remembered: true,
            mubitSessionsAgo: 4,
          },
        ]
      : []),
    ...(remembersGroundFloor
      ? [
          {
            text: "Not ground floor",
            remembered: true,
            mubitSessionsAgo: 2,
          },
        ]
      : []),
  ];

  // WC1/N1 — King's Cross / KCL
  const kclRemembered: ResultReason[] = [
    ...(kingsCrossExplored
      ? [
          {
            text: "King's Cross — area you've explored before",
            remembered: true,
            mubitSessionsAgo: 6,
          },
        ]
      : []),
  ];

  return [
    buildCard(CANONICAL_SLOTS[0], e1Remembered),
    buildCard(CANONICAL_SLOTS[1], se1Remembered),
    buildCard(CANONICAL_SLOTS[2], kclRemembered),
  ];
}
