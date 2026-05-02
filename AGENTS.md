# AGENTS.md

Operating manual for AI agents and humans working in this repository.

## Project context

This is a hackathon monorepo. The bias is toward **simple, direct, demoable** choices over architectural purity.
Decisions made for this reason are not technical debt — they are scope.

## Judging format (Zero-to-Agent London)

Two-stage judging:

1. **Initial cut — repo + deployed URL.** Judges browse the GitHub repo and click the live URL.
   README must hero-pitch in 30 seconds; deployed URL must work first-click.
2. **Top 6 → live demo on stage.** The top 6 entries demo live; **3 winners are picked from
   that 6**. To win, the live demo has to land — repo polish gets you to top 6, stage performance
   picks the winner.

All three sponsors (Vercel, Bright Data, Mubit) judge a single combined track, so projects that
use all three meaningfully are strictly stronger than projects that use one deeply.

Implication for engineering decisions: optimize for **(a)** a deployed URL that works first-click
every time, and **(b)** a 60–90 second demo path that visibly exercises all three sponsor tools.
Hidden cleverness that doesn't show on stage is wasted effort right now.

## Hard rules

These are non-negotiable:

1. **TypeScript everywhere.** Frontend and backend. React + the latest Next.js for apps; Server
   Actions, Route Handlers, and Vercel Functions for server logic. No Rust, Go, Python, or other
   backend languages. No Vue, Svelte, plain JS, or alternative React metaframeworks. Apps live
   in `apps/<name>/`.
2. **Frontend styling: use the `impeccable` skill suite.** When building or editing UI, invoke the
   relevant `impeccable:*` skill (`craft`, `polish`, `typeset`, `layout`, `delight`, etc.). Default
   aesthetic is editorial dark — see `apps/nextjs-explorer` for the established baseline (Geist sans,
   Instrument Serif italic accents, dark zinc surfaces, subtle grain, gradient warm/cool wash).
3. **Hackathon priority: ship over polish-the-edges.** When stuck between a clever abstraction and
   three duplicated lines, choose the duplication. Premature DRY is rejected.

## Repository layout

```
zero-to-agent/
├── apps/                 # Next.js apps
│   ├── rentry/           # ★ Hackathon entry — agent that finds, drafts, and applies to London rentals (port 3002)
│   ├── nextjs-explorer/  # Earlier experiment — visual tour of the Next.js codebase (port 3000)
│   └── productify/       # Abandoned — GitHub URL → v0 product. Kept for reference, do not extend (port 3001)
├── packages/             # Shared TS packages (only if reused across 2+ apps)
├── docs/                 # Internal docs (monorepo setup, conventions, etc.)
│   └── monorepo.md       # Setup + stack reference (was the old root README)
├── package.json          # Root scripts + Bun workspaces config
├── bun.lock              # Bun lockfile (committed)
├── README.md             # Judge-facing pitch (kept lean — internal docs go in docs/)
└── AGENTS.md             # This file
```

## Toolchain

- **Runtime + package manager:** [Bun](https://bun.sh) 1.3+. Bun is *both* the runtime
  (Next.js dev/build/start use `bun --bun next ...`) and the workspace manager. No npm, pnpm,
  yarn, or Node-runtime alternatives.
- **Bundler:** Turbopack (Next.js default). Webpack only as fallback if a library forces it.
- **Lockfile:** `bun.lock` (text format). Committed. Do not delete or hand-edit.

## Common commands

Run from the repo root:

| Goal                         | Command                                       |
|------------------------------|-----------------------------------------------|
| Install all deps             | `bun install`                                 |
| Run nextjs-explorer (3000)   | `bun run dev`                                 |
| Run productify (3001)        | `bun run dev:productify`                      |
| Run rentry (3002)            | `bun run dev:rentry`                          |
| Build all apps               | `bun run build`                               |
| Lint all apps                | `bun run lint`                                |
| Add a dep to a specific app  | `bun add <pkg> --cwd apps/<app-name>`         |
| Run a script in one workspace| `bun --filter <app-name> <script>`            |

Each app pins a distinct port so multiple dev servers can run side-by-side.

## Conventions

### Adding a new app
1. `cd apps && bun create next ./<name> --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --yes`
2. Delete any generated `AGENTS.md`, `CLAUDE.md`, `node_modules`, `package-lock.json`,
   `pnpm-lock.yaml`, and `README.md` from the new app — the root owns those.
3. Edit the new app's `package.json` `scripts` so `dev`/`build`/`start` use the Bun runtime:
   `bun --bun next dev`, `bun --bun next build`, `bun --bun next start`.
4. Run `bun install` from the repo root to register the workspace.
5. Apply the editorial baseline: copy `globals.css` and `layout.tsx` from `nextjs-explorer` as a
   starting point, or invoke `impeccable:craft`.

### Server boundaries
Server logic lives inside Next.js apps as Server Actions, Route Handlers, or Vercel Functions.
For heavy compute, long-running jobs, or persistent state, prefer Vercel Workflow or a Vercel
Function with appropriate runtime config — still TypeScript. Do not introduce a separate
backend in another language.

## Apps

### `rentry` (port 3002) — hackathon entry, 100% of effort goes here
Conversational rental-search agent for London. The product organically uses all three sponsor
tools, which is the strategic core of the submission:

- **Vercel** — hosting, Postgres, AI workflow / Server Actions, per-user persistence keyed off
  the auth screen (same username = same agent state across sessions).
- **Bright Data** — live property listings fetched on demand for the user's stated criteria.
- **Mubit** — long-term memory of the user's preferences, sharpening results across sessions.

Demo flow (this is the canonical happy path — every code decision should make this flow
unbreakable on stage):

1. **Auth screen.** Username gate — purpose is to demo Vercel-side persistence + Mubit recall
   ("log in with the same name later, your prefs come back").
2. **Prompt entry.** Free-form criteria, e.g. *"I want to live in Aldgate East, Waterloo, or
   near KCL. Budget ~£2000 pcm. Easy commute to Camden."*
3. **Bright Data fetch.** Agent pulls live listings matching the area / budget constraints.
4. **Ranked results with explainable fit.** Each property card surfaces green-checkmark reasons
   the agent thinks it's a good fit (specific commute time, budget headroom, distance to named
   landmarks, matched preferences from Mubit).

This is the only app that should receive new feature work, polish, or design attention.

### `nextjs-explorer` (port 3000) — earlier experiment, frozen
Visual field guide to the Next.js codebase, rendered as live Mermaid diagrams. Mermaid is loaded
client-side and themed to match the dark editorial surface. Diagram source lives in
`src/lib/diagrams.ts`. Useful as a styling baseline for `rentry` (Geist sans, Instrument Serif
italic accents, dark zinc surfaces, grain, gradient warm/cool wash). Don't extend it.

### `productify` (port 3001) — abandoned
GitHub-URL-to-v0-product agent. Submission was dropped in favour of `rentry`. The code stays in
the repo for reference but **do not add features, polish, or fix bugs here** unless the user
explicitly asks. If a shared utility from this app is genuinely useful to `rentry`, copy it
across rather than introducing a cross-app dependency.

## Deployment

Default target is Vercel (Fluid Compute, Node 24 LTS). Everything ships through the standard
`next build` pipeline — no separate backend services to deploy.

## README vs docs/

The root `README.md` is **judge-facing** — keep it short, hooky, and demo-oriented (problem,
what we built, demo link, screenshot, stack, team). Setup/conventions/internal references live
under `docs/`. Don't bloat the root README with toolchain trivia; link into `docs/monorepo.md`
or `AGENTS.md` instead.

## Things that should *not* end up in this repo

- A second package manager or runtime (no `npm install`, `yarn`, `pnpm` — Bun only).
- Backend services in Rust, Go, Python, or anything else — TypeScript only, inside Next.js.
- Component libraries pulled in for one component (vendor or write the component).
- AGENTS.md or CLAUDE.md files inside individual apps (the root is the single source of truth).

## Working with this repo as an agent

- Keep changes scoped to one app per task unless the user explicitly asks for cross-cutting work.
- When editing UI, screenshot the result with headless Chrome (`/Applications/Google
  Chrome.app/Contents/MacOS/Google Chrome --headless --screenshot=...`) and verify visually
  before declaring done.
- When in doubt about the design direction, default to the `nextjs-explorer` baseline rather
  than introducing a new aesthetic.
