# PITCH.md — Rentry live demo script

This document is the canonical demo script for the Zero-to-Agent London live demo (top 6 → top 3). Every engineering decision in `apps/rentry` should make this flow unbreakable on stage. If a feature isn't on this page, it isn't shipping.

The deployed-URL flow and the on-stage demo flow are **the same flow** — don't build two paths.

---

## Strategic frame

- **Two-stage judging.** Repo + deployed URL → top 6. Top 6 demo live → 3 winners. Stage performance decides who wins.
- **All 3 sponsors judge a single track.** Each sponsor must have a visible "show, don't tell" moment in the demo. If a sponsor's contribution is invisible on stage, that sponsor's judge has nothing to vote for.
- **Three-verb framework — keep these distinct, never let them blur:**
  - **Bright Data SEES** — the market right now. Owns: listings, prices, availability. Visible artifact: results panel + "47 live listings" count.
  - **Vercel Workflow RUNS** — the agent itself. Owns: this-run's durable execution, multi-step orchestration, resumability. Visible artifact: **step counter** alongside the reasoning trace (`step N/M`). *Note: Vercel's visible role is the Workflow engine, not just the auth screen — auth alone is just session storage.*
  - **Mubit REMEMBERS** — *who you are.* Owns: cross-session preferences, learned over months. Visible artifact: "Mubit recall" block in the reasoning trace + `Mubit · N sessions ago` attribution badges on remembered checkmarks.
- **Why this carve-out matters:** Without the three verbs, Vercel and Mubit blur (both feel like "the thing that remembers"). With the verbs, each sponsor owns a non-overlapping role and has a unique visible artifact. The rent-hike beat (Beat 6) makes the boundary tangible — *new* workflow run on logout/login, but Mubit persists *across* the run boundary.
- Mubit's job is to be **loud about being silent.** Memory is invisible by design, so the demo must deliberately surface it — UI badges + 3 verbal namedrops across the demo (not 1).
- **Demo length:** ~105 seconds in full (90s demo + ~15s live invite at the end). Forward-vision is held for Q&A. 60-second cutdown defined below.
- **The closing live invite ("$100 of Bright Data credits — pull out your phones") is the most ambitious bet in this script.** It's strong on both axes (room *and* judges, especially the Bright Data judge watching their dashboard light up) — but only if the app holds under live load. See "Load-handling requirements" in the build spec. If load-test fails, cut the invite and end on the sponsor recap.

### Data strategy — hybrid, not binary

**Mock the path that's already won. Live for the path that earns the win.**

| Path | Strategy | Why |
|---|---|---|
| Scripted demo prompt (Aldgate East / Waterloo / KCL · £2000 · Camden) | **Pre-cached server-side**, returns instantly | Live data adds zero value here; failure undoes everything |
| Top ~20 likely London prompts (popular postcodes + round budgets) | **Pre-warmed cache** | Stage-1 judges typing common queries hit cached real data |
| Random / cache-miss prompts (Stage 1 judges, Beat 7 audience) | **Live Bright Data**, with curated-real-listings fallback on rate-limit | Sponsor signal *requires* real API usage; Bright Data judge can see their dashboard |

Full-mock optimizes for an event you didn't reach (Stage 1 cuts you for a fake URL). Full-live takes risk for no reward on the scripted demo prompt. The hybrid wins all three judging surfaces: deployed URL, scripted demo, and live invite.

---

## Pre-stage setup

- App pre-loaded on the auth screen, big monitor mirror confirmed.
- **Demo persona is a returning user.** The scripted demo runs on a pre-seeded `shumeng` account with ~6 months of fake history — this is what makes Mubit's recall block fire and the rent-hike callback work. New-user demo is rejected because it deletes Mubit's primary visible artifact. Pre-seeded demo personas are industry-standard; no honesty issue.
- **Mubit pre-seeded with one prior session for the demo username** (so the second-pass moment lands).
- **Bright Data results pre-cached** for the scripted prompt (server-side fallback if API is slow — judges don't know).
- Pre-recorded screen capture queued on a phone. If anything dies, cut to it mid-sentence and keep talking.
- Demo prompt copied to clipboard.

### Two doors: scripted demo (returning user) vs. live invite (new users)

These are different audiences and need different setups — same app, two doors:

| Surface | Audience | User type | Mubit fires? |
|---|---|---|---|
| **Scripted demo (Beats 1–7)** | Stage judges, room | Returning user (`shumeng`, pre-seeded) | Yes — full recall + rent-hike callback |
| **Live invite (Beat 7+)** | Audience on phones, Stage 1 deployed-URL judges | New users (their own usernames) | No — empty memory on first run |
| **Optional** | Audience curious about the demo | Logs in as `shumeng` to replicate the on-stage experience | Yes |

The first-time-user banner ("Log in as `shumeng` to see the personalized version from the demo") makes both doors discoverable from the same UI.

---

## The 90-second script

### Beat 1 — Crowd hook (0:00 – 0:10)

> "Quick — hands up, who's renting in London in the next six months?"
>
> *[wait, scan room]*
>
> "And who wishes that didn't completely suck?"
>
> *[more hands]*
>
> "Right. So we built rentry."

**On screen:** Auth screen, idle. (Eye contact with crowd, not screen.)

### Beat 2 — One-line pitch + login (0:10 – 0:20)

> "Rentry's an agent that finds you a flat in London the way a friend with insider knowledge would. Watch."
>
> *[type username, hit enter — fast, don't dwell]*

**On screen:** Auth → main screen. Empty prompt input, cursor blinking.

**Sponsor signal:** Vercel (auth + persistence) — payoff lands later, don't name it yet.

### Beat 3 — The prompt (0:20 – 0:30)

> "I'm telling it what I actually want, the way I'd say it to a mate."
>
> *[paste prompt — single keystroke]*

**Scripted demo prompt** — the literal text you paste from clipboard during this beat. The whole demo is engineered around this exact string; it must be on clipboard, character-for-character:

> *"I want to live in Aldgate East, Waterloo, or near KCL. Budget around £2000 pcm. I need an easy commute to Camden."*

(Distinct from the empty-input-box placeholder text, which should be a generic hint like *"e.g. studio in Hackney under £1500"* to guide first-time users on the deployed URL.)

> "Hit go."
>
> *[click, lean back]*

### Beat 4 — Agent thinks out loud (0:30 – 0:50) — THE MONEY MOMENT

Big-text reasoning trace appears live. **Large, animated, one line at a time.** This is the moment that reads as "agentic" rather than "search."

The screen has **three visually distinct zones**, one per sponsor — the eye registers three systems doing three jobs:

**(top-left, small) Vercel Workflow step counter:**
```
▶ rentry-agent · run #847
  step 3/5 — fetching market data
```

**(center, big) Reasoning trace:**
```
Searching three areas in parallel…
  → Aldgate East · Waterloo · KCL

Pulling 47 live listings via Bright Data
Filtering: budget ≤ £2,000 pcm
Computing commute time to Camden for each

🧠  Mubit recall — 14 preferences for shumeng
    • commute to Camden < 20 min      learned 4 sessions ago
    • no ground floor                 learned 2 sessions ago
    • avoid shared bathrooms          learned 1 session ago
```

The **Vercel step counter advances live** as the reasoning trace progresses (3/5 → 4/5 → 5/5). It's the visible heartbeat of the workflow.

> *(narrate casually):* "Bright Data's pulling 47 live listings — properties on the market right now. Mubit's loading the 14 things I cared about last time — no ground floor, no shared bathrooms. And the whole thing's running on Vercel Workflow — every step durable, retryable, resumable."

**Sponsor signal:**
- **Bright Data SEES** — named verbally + on screen, listing count visible.
- **Mubit REMEMBERS** — explicit "Mubit recall" block with `learned N sessions ago` metadata. Named verbally (namedrop #1).
- **Vercel Workflow RUNS** — visible step counter (`step N/M`, run number), advances live. Named verbally as "Vercel Workflow" — this is the moment Vercel stops being implicit and gets equal airtime. Workflow's distinctive value (durable, multi-step) is *shown,* not just claimed.

**Pacing:** ~15–20 seconds. Don't rush. The three zones animate in their own rhythm so the eye separates the sponsors:
1. Workflow run number appears first (Vercel claims the frame).
2. Bright Data fetch lines stream in (eyes go center).
3. Mubit recall block animates in last (the punch).
4. Workflow step counter advances throughout, peripheral but always alive.

### Beat 5 — Results land (0:50 – 1:05)

Three property cards animate in. Top one is highlighted. Each has 4 green-check reasons.

**Top card content (must look exactly like this on stage):**

> **Studio flat — Whitechapel High Street, E1**
> £1,850 pcm
>
> ✅ **11 min to Camden** — Northern Line, one change at Bank
> ✅ **£150 under budget** — £1,850 vs your £2,000 ceiling
> ✅ **3-min walk to Aldgate East tube**
> ✅ **No ground floor** — `Mubit · 2 sessions ago`

> *(point to the bottom checkmark):* "Look at the bottom one. I never told it that this time. It learned it two sessions ago and remembered. **That's Mubit — the agent's long-term memory.**"

**Sponsor signal:** Mubit, named verbally (namedrop #2), with a visible attribution badge. The `Mubit · 2 sessions ago` pill is doing 80% of the work — it must be typographically distinct from the other checkmarks (monospace pill, lighter weight, or branded badge). **Every other "remembered" detail in the UI gets the same treatment** — every act of remembering is branded.

### Beat 6 — The rent-hike callback (1:05 – 1:20)

This is the persistence demo dressed up in a story every Londoner has lived. The "because of course they did" line gets a knowing laugh — that laugh is gold, it signals the team understands the audience.

> "And here's the thing —"
>
> *[logout, log back in as same username — fast]*
>
> "Six months later. My landlord just put the rent up — because of course they did. New budget, same me."
>
> *[paste second prompt: "Need a new place. Similar areas. Budget now £2,200."]*

Reasoning trace appears again. **The Vercel Workflow step counter starts fresh** (`run #848 · step 1/5`) — visibly demonstrating that this is a *new* run. **The Mubit recall block carries 6 months of history across the run boundary** — visibly demonstrating that memory persists across runs.

```
▶ rentry-agent · run #848 · step 1/5

Welcome back, shumeng.

🧠  Mubit recall — 14 preferences, 6 months of history
    • commute to Camden — must stay under 20 min
    • no ground floor
    • avoid shared bathrooms
Applying new budget: £2,200
```

> "Fresh workflow run — Vercel kicks off a clean agent session. But **Mubit doesn't forget — not in six weeks, not in six months**. Six months of me, still here. The agent that helped me last year still has my back. **That's the whole product.**"

**Why this is the cleanest sponsor carve-out in the whole demo:**
- New `run #848` on the workflow indicator = Vercel's *runs* verb made literal.
- Same Mubit recall block carrying history = Mubit's *remembers* verb made literal.
- The boundary between them is on screen at the same time. No conflation possible.

(Verbal namedrop #3 for Mubit. Three across the demo: Beat 4 narration, Beat 5 callout, Beat 6 close.)

**Why this beat hits harder than the generic version:**
- **Universal pain.** Every renter in the room has been through a rent hike. They feel it before you finish the sentence.
- **Reframes persistence as protection, not convenience.** "It saved me when life happened" beats "it remembered my preferences" every time.
- **The knowing laugh on "of course they did"** is rapport currency — the room is on your side for the rest of the demo.
- **Implicitly says "rentry is something you keep around for years"** — retention story baked into the demo without saying it.

**Sponsor signal:** Vercel persistence (auth → state across sessions) + Mubit (prefs persisted across sessions). Same as before — story does the lifting.

### Beat 7 — Close + live invite (1:20 – 1:45)

Sponsor recap first (the killshot), then a live invitation that turns the room into Bright Data traffic. Order matters — recap *first* so it lands clean, invite *second* so the room is engaging with the app while judges are deciding.

> "Bright Data **sees** the market. Mubit **remembers** what makes me, me. Vercel Workflow **runs** the whole agent — every step, durable. Rentry's the friend in London you wish you had."
>
> *[beat — let the recap land]*
>
> "One more thing. It's live right now at **rentry.app**. We've got $100 of Bright Data credits to burn before the night's out — pull out your phones, type a postcode and a budget, see what it finds you."
>
> *[hold for 3–5 seconds, URL stays up, scan the room as people start typing]*
>
> "Thanks."

**On screen:** Big readable URL frame appears at the start of the invite line and **stays up** through applause, Q&A, and the next team walking on. Format suggestion: full-screen URL in display-size type, faintly animated, no other UI to distract.

**Why this works:**
- **Sponsor recap stays the killshot.** The invite comes after — it doesn't compete with the close, it extends it.
- **Naming "$100 of Bright Data credits" on stage is a wink the Bright Data judge cannot miss.** It's a third Bright Data namedrop and it frames burned credits as a flex, not a cost.
- **The room is on phones engaging with the app *while judges are forming their verdict.*** That's the strongest possible signal — they watch the product working in 50+ hands.
- **Asynchronous load.** People type at different speeds. Traffic spreads over 1–3 minutes, not a single instant. Easier to handle than a coordinated stampede.

**Critical: this beat is conditional on the app holding under load.** See "Load-handling requirements" below. If load-test fails, **drop this beat** and end on the sponsor recap alone — a polished demo that ends clean is still a top-3 contender; a public failure during the invite is not.

---

## 60-second cutdown

Drop **Beat 6** entirely. Trim **Beat 4** to 10s. The "*remembered from last session*" checkmark in Beat 5 still carries the Mubit moment on its own.

Do **not** cut Beat 1 — the hook makes you memorable.

---

## Q&A prep — the multi-agent forward-vision

Future-vision is **not in the demo.** The 90s ends on Beat 7's sponsor-recap killshot. Forward-vision is reserved for Q&A, where it lands more authentically and lets you read the judge asking. Rehearse this so you can deliver it crisply when prompted.

### Likely Q&A trigger questions
- "What's next for rentry?"
- "How does this scale beyond one user?"
- "Where does this go in 6 months?"
- "How would you turn this into a real product?"
- **"Where does your agent take real-world action?"** ← high-probability question, see dedicated answer below

### Critical Q&A answer — the "real-world action" question

Sponsors explicitly said they want agents that *take real-world actions that complete something otherwise annoying.* The current rentry demo stops at recommendations, not actions. **This question will get asked. Have the answer locked in.**

> "Two-part answer.
>
> First — the agent already automates the action that takes a Londoner an entire Saturday: trawling Rightmove, normalizing budgets, calculating commute times, remembering what you cared about last time. We compressed six hours of manual work into thirty seconds. That's the action it takes today.
>
> Second — and this is what we're shipping next — the liaising agent. Calendar via MCP, email via MCP. Sunday at 11pm, three letting agents have replied — the agent reads them, slots viewings around your week, replies in your voice. That's the next agent in the roadmap. The architecture is ready for it; the demo just doesn't include it yet.
>
> One agent finds the flat. The next gets you in the door."

**Why this answer works:**
- **Reframes search-and-decide as itself an action.** Compressing 6 hours of human work into 30 seconds *is* completing something otherwise annoying — that meets the brief on a defensible reading, even if it's not transactional.
- **Doesn't deflect.** Acknowledges the gap implicitly ("the demo just doesn't include it yet") instead of dodging.
- **Bridges to the roadmap naturally.** Lets you deliver the multi-agent vision that was already prepped for Q&A — now it's the *answer*, not just future-vision.
- **Specific MCP namedrops** signal architectural credibility to the dev judges.

**Delivery rules:**
- Don't sound defensive. The reframe ("it already takes the most painful action") has to land confident, not apologetic.
- Don't volunteer "we ran out of time." Frame the liaising agent as *next on the roadmap*, not *missing from this build*.
- This answer is ~30 seconds. Deliver it once, cleanly. Don't elaborate unless they push.

### The answer — multi-agent roadmap (deliver in ~25–35 seconds)

Lead with the distinctive sponsor-deepening agent (Bright Data → market intelligence). It surprises the room and reinforces your strongest sponsor story. Mention the calendar/email liaising agent as the second beat — it's the user-pain answer that resonates.

> "Today we shipped the sourcing agent. The next two are obvious."
>
> *[1] Negotiation agent — deepens Bright Data*
> "First, a negotiation agent. It tells you that listing's been online 47 days, and the asking price is 8% above what comparable flats actually rented for last quarter. So you walk in with leverage instead of going in blind. That's Bright Data going from search into negotiation."
>
> *[2] Liaising agent — calendar + email via MCP*
> "Then a liaising agent. It's 11pm Sunday, three letting agents have replied to your inquiries — the agent reads them, slots viewings around your week via your calendar, replies in your voice via your inbox. Plugged in over MCP. You wake up Monday to a calendar full of viewings."
>
> *[Closer]*
> "One agent finds the flat. The next gets you a fair deal. The third gets you in the door."

### Why this answer is strong
- **Negotiation agent is differentiated.** Most teams say "calendar + email" for their what's-next. Almost none say "we'd use Bright Data to give the user negotiating leverage." It surprises.
- **Sponsor reinforcement, not dilution.** Both follow-ups extend existing sponsor stories (Bright Data deeper; Mubit "in your voice" callback) — you're not pivoting to capabilities outside the sponsor track.
- **MCP gets named once, with concrete attachment points (calendar, email).** Reads as architectural taste, not buzzword.
- **Three-agent closer is sticky.** "Finds the flat / fair deal / in the door" is memorable and frames a clear product roadmap.

### Q&A delivery rules
- Keep the answer to ~30 seconds even if they don't time you. Long answers feel like rambling.
- If asked specifically about MCP or the agent architecture, expand on the liaising agent. If asked about scaling or business model, expand on the negotiation agent (market intelligence is closer to a paid feature).
- Don't volunteer this if not asked. Wait for the trigger. Volunteering future-vision in Q&A you weren't asked about reads as defensive.

---

## What the app must support to make this script land

This is the build target. Anything outside this list is out of scope.

### Auth screen
- Username-only gate (no password, no OAuth — keep it instant).
- On submit, route to main screen with persistent state keyed on username.
- Logout button visible (used in Beat 6).

### Main screen
- Single large prompt input. Free-form text. Submit on Enter or button click.
- After submit, prompt input collapses or fades; reasoning trace takes over.

### Reasoning trace component (Beat 4 — must be excellent)
- Large typography (visible from back of room — minimum ~32px, ideally larger).
- Lines reveal one at a time with a subtle animation (typewriter or fade-in-up).
- **Three visually distinct zones**, one per sponsor:
  - **Vercel Workflow step counter** (top-left, smaller) — shows `▶ rentry-agent · run #N · step M/T` and **advances live** as the workflow progresses. Resets to `step 1/T` after logout/login. This is Vercel's primary visible artifact in the whole demo — without it, Workflow is invisible.
  - **Bright Data fetch lines** (center) — listing count + filter/compute steps.
  - **Mubit recall block** (center, below Bright Data) — header `🧠 Mubit recall — N preferences for {user}` + 3 individual prefs each with `learned N sessions ago` metadata. Animates in *after* Bright Data so the eye registers two distinct systems.
- Speed must feel deliberate — ~700–1200ms per line. Too fast reads as fake.

### Mubit attribution rules (apply everywhere)
Memory is invisible by design — the demo must deliberately make it visible:
- Every UI element that surfaces a remembered preference gets a `Mubit · N sessions ago` badge or pill, typographically distinct from non-remembered content (monospace, branded color, or small icon).
- The reasoning-trace recall block uses the 🧠 sigil + "Mubit recall" header.
- Optional dev-judge wink: a small log strip somewhere on the page showing actual API calls, e.g. `mubit.recall("shumeng") → 14 prefs · 240ms`. Low cost, high credibility with the technical judges.
- Verbal: Mubit is named on stage **3 times** (Beat 4 narration, Beat 5 checkmark callout, Beat 6 close). This matches the airtime Bright Data gets.

### Property cards (Beat 5)
- Three cards, top one visually elevated (size, glow, or position).
- Each card: address + price + 4 green-checkmark reasons.
- Checkmarks must be **specific** — exact commute times, exact budget delta, exact walk distance, named tube line.
- The "remembered from last session" checkmark must be **typographically distinct** (italic, lighter weight, or a small Mubit attribution badge).

### Backend behavior
- Bright Data integration with **server-side cached fallback** for the scripted demo prompt. Failure of live API must not break the demo.
- Mubit pre-seeded with the demo username's prefs. The "no ground floor" preference must be retrievable and visibly applied to the top card.
- Vercel Postgres (or equivalent) persistence so `(username) → (saved prefs, past sessions)` survives logout/login.

### Hardcoded fallbacks (do these — do not let live calls decide whether the demo lands)
- The top result card's content for the scripted prompt should be a hardcoded fallback if scoring is flaky.
- The "remembered from last session" line on the top card must be hardcoded for the demo profile. **It is the Mubit money line.** Don't let it depend on a live call.
- Have an offline-mode toggle for emergency.

### Load-handling requirements (Beat 7 invite — non-negotiable if shipping the live invite)
The "100 people in the room" close only works if the deployed URL survives ~30+ concurrent users with random prompts. If any of these aren't in place, **cut the live invite from Beat 7.**

- **Bright Data caching layer.** Server-side cache keyed by `(area, budget, commute target)` with a generous TTL. The 20 most likely London prompts (popular postcodes + round-number budgets) should be pre-warmed before stage. Random postcodes hit live API; popular ones never do.
- **Rate-limit handling.** When Bright Data returns 429, fall back to a curated London listings set (still real, just not freshly scraped). User gets results either way.
- **Mubit signup is non-blocking.** Account creation must not block the search flow. If Mubit is slow, skip preference loading and proceed — the user still sees results, just without personalization on this run.
- **Vercel functions pre-warmed.** Hit the deploy URL ~30 times in the 10 minutes before stage to warm cold starts. Configure max concurrency on the relevant routes.
- **Branded rate-limit page.** If anything *does* 429 publicly, the page says something like "100 people just hit this. Give it 30 seconds." Funny, on-brand, not a generic 500.
- **First-time user UX.** A subtle banner for fresh users: "First time? You'll see live listings. Log in as `shumeng` to see the personalized version from the demo." Manages expectations so random users aren't disappointed when their results lack the seeded magic.
- **Load test before stage.** Minimum: 30 concurrent users × 3 random London prompts each. If p95 latency goes above 8s or any request 500s, **do not ship the live invite.**

---

## Failure-mode recovery

| If… | Do |
|---|---|
| Bright Data hangs > 8s | "While that loads — *[fill with one extra sentence about the problem]*". If still hanging at 12s, cut to pre-recorded video. |
| Listings come back empty | Hardcoded fallback set keyed off the scripted prompt. Server-side. Judges never see it. |
| Mubit recall fails | "*remembered from last session*" line on the top card is hardcoded for the demo profile. |
| Wifi dies | Pre-recorded video on phone, HDMI in. |

---

## Practice protocol

- Run the demo end-to-end **10 times** before stage. Time it.
- Most demos blow up because the presenter rushes the reasoning trace. Let it breathe.
- Rehearse the "look at the bottom one" beat — gesture + pause + line. That's the Mubit moment.
- Eye contact during Beat 1 and Beat 7. Screen-pointing in the middle.
- Skip TTS. The pasted prompt is faster and more reliable.
