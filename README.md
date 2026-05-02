# Productify

**Paste a GitHub repo URL. An agent investigates it, picks the right kind of interactive web product, and ships it on v0.**

Submission for [Zero to Agent](https://oscarama.notion.site/Zero-to-Agent-London-Information-Public-352f4900574780849517e736e27499b9), London.

> **Live demo:** _(deployed URL pending — Vercel link being wired)_
>
> **To try it yourself:** Paste your v0 API key + any GitHub repo. Watch the agent work in real time.

---

## What makes this an agent

It's not a one-shot prompt. The repo investigation runs as a tool-using loop on **Vercel AI Gateway** (Claude Sonnet 4.5):

1. Calls `github_stats` to orient — stars, language mix, topics.
2. Pulls the README and any manifests it sees (`package.json`, `Cargo.toml`, `pyproject.toml`, etc.).
3. Drills into specific files when the README points it somewhere interesting.
4. **Picks an archetype** — the kind of product that best showcases this repo:
   - `playground` — try-it-now UI for parsers, formatters, encoders, CLIs
   - `explorer` — queryable browser for repos that ship structured data or specs
   - `gallery` — submission + voting hub for visual / generative artifacts
   - `docs_hub` — searchable docs site with per-page comments
   - `landing` — fallback editorial page for pure-infra repos
5. Drafts a structured **marketing brief** (audience, problem, value prop, features with evidence, hero copy, social proof) and a **Postgres schema** if the archetype needs persistence.
6. Calls `commission_v0` exactly once as its terminal action — passing the brief to v0 to generate a full Next.js + Tailwind + Postgres app.

The browser sees every step as a streaming SSE event. The "agent trace" panel shows tool calls, arguments, durations, and final reasoning live.

## Why this won't be a v0 wrapper

A v0 wrapper takes a prompt and forwards it. Productify's reasoning is in the *understanding* phase, not the *generation* phase:

- **Archetype selection** is a real choice the agent makes from evidence. A regex library gets a playground; a CSS framework gets a gallery; an internal infra tool gets a landing page.
- **Schema design** is non-trivial and grounded in what the archetype needs. Playground saves runs; gallery stores votes.
- **The brief is verbatim, not a prompt template.** Hero copy, features, value props are filled by the agent from repo evidence. v0 receives a finished brief, not a prompt with placeholders.

The result: every output uses v0's full-stack capability (DB + server actions + UI), not just landing-page generation.

## Architecture

```
                       ┌─────────────────────────────────┐
   browser  ◀── SSE ───│ /api/generate  (Next.js Route)  │
      │                └──────────────┬──────────────────┘
      │                               │
      │                       ┌───────▼───────┐
      │                       │  agent loop   │   AI SDK 6 + streamText
      │                       │  (lib/agent)  │   stopWhen: stepCountIs(14)
      │                       └───────┬───────┘
      │                               │
      │      ┌──────────────────┬─────┴─────┬──────────────────┐
      │      ▼                  ▼           ▼                  ▼
      │  github_stats       fetch_readme   read_file       commission_v0
      │  fetch_manifest     list_dir       search_code     (terminal)
      │  ─────────┬─────────────────────┬─────              ─────┬────
      │           │                     │                        │
      │           ▼                     ▼                        ▼
      │     GitHub REST API       GitHub Trees API           v0 SDK
      │
      └─────────────────── thinking panel UI
```

Built with **AI SDK 6**, **Vercel AI Gateway** (Anthropic Claude Sonnet 4.5), the **v0 SDK**, **Next.js 16** (App Router + Turbopack), and **Bun**. The app itself is editorially designed; the generated apps inherit a matching aesthetic.

## Repo layout

```
apps/productify/         the hackathon entry — paste a repo, watch it ship
  src/app/page.tsx       hero + form
  src/app/api/generate   streaming Route Handler
  src/lib/agent.ts       investigation loop driver
  src/lib/tools.ts       agent's tool surface
  src/lib/commission.ts  v0 terminal action
  src/lib/github.ts      GitHub primitives the tools wrap
  src/lib/schema.ts      shared zod / TS types
apps/nextjs-explorer/    earlier, unrelated experiment
crates/                  Rust workspace (unused by this entry)
```

See [`AGENTS.md`](./AGENTS.md) for monorepo conventions and [`docs/monorepo.md`](./docs/monorepo.md) for setup.

## Run locally

```bash
bun install
cp apps/productify/.env.example apps/productify/.env.local
# then edit .env.local — set AI_GATEWAY_API_KEY
bun run dev:productify       # http://localhost:3001
```

The v0 API key is **not** an env var. You paste it into the UI; it travels with the request and is never persisted.

## Status

Hackathon prototype. The agent loop and v0 commission are end-to-end working. Rate-limit fallback caching, Vercel deployment, and a recorded walkthrough are the remaining polish items.
