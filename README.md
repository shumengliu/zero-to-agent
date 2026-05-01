# zero-to-agent

Hackathon monorepo. Rust on the back, Next.js on the front.

See [`AGENTS.md`](./AGENTS.md) for the operating manual.

## Quickstart

```bash
bun install
bun run dev   # runs apps/nextjs-explorer on the Bun runtime
```

Open http://localhost:3000.

## Apps

- **`apps/nextjs-explorer`** — a visual tour of the Next.js codebase, drawn as Mermaid diagrams.

## Stack

- Runtime + package manager: Bun 1.3+
- Frontend: TypeScript + React 19 + Next.js 16 (App Router, Turbopack)
- Backend: Rust (Cargo workspace under `crates/`)
- Styling: Tailwind 4 + the `impeccable` design skill suite
