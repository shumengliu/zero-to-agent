// Domain types for rentry.
//
// Flow:
//   1. User types a prompt ("places near KCL under 2k, easy commute to Camden").
//   2. Workflow loads UserPrefs from Mubit, keyed by username.
//   3. extractCriteria() turns the prompt + prefs into a SearchCriteria.
//   4. Bright Data is queried per area (RightMove + OpenRent), in parallel.
//   5. Listings get scored, top 3 turn into ResultCards with structured reasons.
//   6. Reasons that originate from saved prefs get marked `remembered: true`.
//
// On a *return* visit by the same username, the agent's reasoning trace
// surfaces the saved preferences by name — that's the Mubit money moment.

export type ListingSource = "rightmove" | "openrent";

export type Furnished = "furnished" | "unfurnished" | "part";

export type Listing = {
  id: string;
  source: ListingSource;
  url: string;
  title: string;
  description: string;
  pricePcm: number;
  bedrooms: number;
  bathrooms: number;
  postcode: string;
  area: string;
  zone: number | null;
  furnished: Furnished | null;
  availableFrom: string | null;
  letAgreed: boolean;
  photos: string[];
  features: string[];
  groundFloor: boolean;
  walkMinsToTube: number | null;
  nearestTube: string | null;
  scrapedAt: string;
};

// Long-term, username-keyed preferences. Stored in Mubit. Built up incrementally
// across sessions: every search adds to lastSearches; explicit dealbreakers and
// must-haves accumulate. The pre-seeded demo profile (`shumeng`) starts with
// realistic content so the second-pass demo moment lands without warmup.
export type UserPrefs = {
  username: string;
  signature: string;
  budgetPcmDefault: number | null;
  commuteTarget: string | null;
  commuteWeight: number; // 0-1 vs size weight
  mustHaves: string[];
  dealBreakers: string[];
  preferredAreas: string[];
  lastSearches: Array<{ prompt: string; areas: string[]; at: string }>;
  seenListingIds: string[];
  // Cumulative run counter, displayed in the step counter as `run #N`.
  // Increments per search. Seeded high (e.g. 846) for the demo username so
  // the first scripted demo run shows `run #847`.
  runCount: number;
};

export type SearchCriteria = {
  areas: string[];
  budgetPcm: number | null;
  bedroomsMin: number;
  commuteTarget: string | null;
  propertyType: "studio" | "flat" | "any";
  rawPrompt: string;
};

// Compact summary of the previous turn's criteria + top result, passed back
// into the next workflow run so a follow-up like "cheaper" / "smaller" /
// "different area" can build on the prior turn instead of starting cold.
export type ConversationContext = {
  priorCriteria: SearchCriteria;
  priorTopTitle: string | null;
  priorTopPricePcm: number | null;
};

// One reason in a result card. `remembered: true` means this reason came from
// the user's saved Mubit prefs, not from the current prompt. Rendered with a
// `Mubit · N sessions ago` attribution pill in the UI.
export type ResultReason = {
  text: string;
  remembered?: boolean;
  mubitSessionsAgo?: number;
};

export type ResultCard = {
  listingId: string;
  source: ListingSource;
  title: string;
  pricePcm: number;
  area: string;
  postcode: string;
  url: string;
  photo: string | null;
  reasons: ResultReason[];
};

// Streamed events emitted by the search workflow. The UI consumes ndjson and
// reduces these into UI state. Three visible-artifact zones, one per sponsor:
//   - "step" → Vercel Workflow step counter (top-left, advances live)
//   - "thinking" with style: "mubit_header"/"mubit_item" → Mubit recall block
//   - everything else → Bright Data fetch lines (centre)
export type SearchEvent =
  | { kind: "started"; runId: string; username: string; runNumber: number }
  | {
      kind: "step";
      current: number;
      total: number;
      label: string;
    }
  | {
      kind: "thinking";
      text: string;
      indent?: number;
      emphasis?: "bold" | "muted";
      style?: "default" | "mubit_header" | "mubit_item";
      mubitSessionsAgo?: number;
    }
  | { kind: "criteria_extracted"; criteria: SearchCriteria }
  | { kind: "results"; cards: ResultCard[] }
  | { kind: "complete" }
  | { kind: "error"; message: string };
