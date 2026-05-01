# AGENTS.md

Operating manual for AI agents and humans working in this repository.

## Project context

This is a hackathon monorepo. The bias is toward **simple, direct, demoable** choices over architectural purity.
Decisions made for this reason are not technical debt — they are scope.

## Hard rules

These are non-negotiable:

1. **Backend language: Rust only.** Any service, daemon, CLI, or worker on the backend goes in
   a Rust crate under `crates/`. No Python, Go, Node servers.
2. **Frontend language: TypeScript + React + the latest Next.js, only.** No Vue, Svelte, plain JS,
   or alternative React metaframeworks. Apps live in `apps/<name>/`.
3. **Frontend styling: use the `impeccable` skill suite.** When building or editing UI, invoke the
   relevant `impeccable:*` skill (`craft`, `polish`, `typeset`, `layout`, `delight`, etc.). Default
   aesthetic is editorial dark — see `apps/nextjs-explorer` for the established baseline (Geist sans,
   Instrument Serif italic accents, dark zinc surfaces, subtle grain, gradient warm/cool wash).
4. **Hackathon priority: ship over polish-the-edges.** When stuck between a clever abstraction and
   three duplicated lines, choose the duplication. Premature DRY is rejected.

## Repository layout

```
zero-to-agent/
├── apps/                 # Next.js apps (one per demo)
│   └── nextjs-explorer/  # App #1: visual tour of the Next.js codebase
├── crates/               # Rust crates (Cargo workspace members)
├── packages/             # Shared TS packages (only if reused across 2+ apps)
├── Cargo.toml            # Rust workspace manifest
├── pnpm-workspace.yaml   # pnpm workspace manifest
├── package.json          # Root scripts + packageManager pin
└── AGENTS.md             # This file
```

## Toolchain

- **Node:** 20+ (tested on 25). Pin via `engines` in root `package.json`.
- **Package manager:** `pnpm` (10.x). Installed at `~/.npm-global/bin/pnpm`. If `pnpm` is not on
  PATH, run `export PATH="$HOME/.npm-global/bin:$PATH"`.
- **Rust:** stable, via Homebrew (`cargo`, `rustc`). Workspace-pinned dependencies live in
  `[workspace.dependencies]` of the root `Cargo.toml`.
- **Bundler:** Turbopack (Next.js default). Webpack only as fallback if a library forces it.

## Common commands

Run from the repo root:

| Goal                         | Command                                          |
|------------------------------|--------------------------------------------------|
| Install all JS deps          | `pnpm install`                                   |
| Run the explorer dev server  | `pnpm dev` (alias for `--filter nextjs-explorer dev`) |
| Build all JS apps            | `pnpm build`                                     |
| Lint all JS apps             | `pnpm lint`                                      |
| Add a dep to a specific app  | `pnpm --filter <app-name> add <pkg>`             |
| Build all Rust crates        | `cargo build --workspace`                        |
| Test all Rust crates         | `cargo test --workspace`                         |

## Conventions

### Adding a new app
1. `cd apps && pnpm create next-app@latest <name> --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --use-pnpm --yes`
2. Delete the generated `pnpm-workspace.yaml`, `AGENTS.md`, `CLAUDE.md`, `node_modules`,
   `pnpm-lock.yaml`, and `README.md` from the new app — the root owns those.
3. Run `pnpm install` from the repo root to register the workspace.
4. Apply the editorial baseline: copy `globals.css` and `layout.tsx` from `nextjs-explorer` as a
   starting point, or invoke `impeccable:craft`.

### Adding a new Rust crate
1. `cd crates && cargo new <name> --lib` (or `--bin` for executables).
2. Add common deps via `<dep>.workspace = true` referencing the root `[workspace.dependencies]`.
3. The crate is auto-discovered by the `members = ["crates/*"]` glob.

### Server boundaries
If a Next.js app needs server logic that crosses the trivial threshold (anything beyond
straightforward Server Actions / Route Handlers — e.g. heavy compute, persistent state,
long-running jobs), put it in a Rust crate and call it via HTTP from a Route Handler. **Do not**
introduce a Node backend.

## Apps

### `nextjs-explorer`
Visual field guide to the Next.js codebase, rendered as live Mermaid diagrams. Six sections:
repo layout, internals of `packages/next`, request lifecycle, build pipeline, App Router
rendering, caching architecture. Mermaid is loaded client-side and themed to match the dark
editorial surface. Diagram source lives in `src/lib/diagrams.ts` — edit there to add or change a
diagram, and the rest of the page picks it up.

## Deployment

Default target is Vercel (Fluid Compute, Node 24 LTS). Rust crates that need to be reachable from
the frontend should be deployed separately (Vercel Sandbox, Fly.io, or a containerized service)
and called over HTTP. Do not couple Rust binaries to the Vercel build.

## Things that should *not* end up in this repo

- A second JS package manager (no `npm install` or `yarn` — pnpm only).
- Backend code in JS/TS (other than Server Actions / Route Handlers in Next.js apps).
- Component libraries pulled in for one component (vendor or write the component).
- AGENTS.md or CLAUDE.md files inside individual apps (the root is the single source of truth).

## Working with this repo as an agent

- Keep changes scoped to one app or one crate per task unless the user explicitly asks for
  cross-cutting work.
- When editing UI, screenshot the result with headless Chrome (`/Applications/Google
  Chrome.app/Contents/MacOS/Google Chrome --headless --screenshot=...`) and verify visually
  before declaring done.
- When in doubt about the design direction, default to the `nextjs-explorer` baseline rather
  than introducing a new aesthetic.
