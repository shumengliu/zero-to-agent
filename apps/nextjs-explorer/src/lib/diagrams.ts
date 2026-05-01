export type Diagram = {
  id: string;
  title: string;
  tagline: string;
  description: string;
  source: string;
};

export const diagrams: Diagram[] = [
  {
    id: "repo-layout",
    title: "Repository layout",
    tagline: "The packages that make up Next.js",
    description:
      "Next.js is a pnpm monorepo. The user-facing `next` package is the orchestrator, but most of the surface area lives in sibling packages: a Rust-powered SWC compiler, a Turbopack bundler, font and MDX loaders, a CLI scaffolder, and a constellation of plugins.",
    source: `flowchart LR
    Repo["vercel/next.js"]
    subgraph Core
      next["packages/next<br/>(framework runtime + CLI)"]
      swc["packages/next-swc<br/>(Rust · SWC plugins)"]
      env["packages/next-env<br/>(.env loader)"]
    end
    subgraph Frontend["Author-facing"]
      cna["packages/create-next-app"]
      font["packages/font"]
      mdx["packages/next-mdx"]
      tp["packages/third-parties"]
    end
    subgraph Tooling
      eslintC["packages/eslint-config-next"]
      eslintP["packages/eslint-plugin-next"]
      analyzer["packages/next-bundle-analyzer"]
      codemod["packages/next-codemod"]
    end
    Repo --> Core
    Repo --> Frontend
    Repo --> Tooling
    next -- "compiles via" --> swc
    next -- "loads via" --> env
    cna -- "scaffolds projects using" --> next
    font -- "registers loaders into" --> next
    mdx -- "extends config of" --> next`,
  },
  {
    id: "next-internals",
    title: "Inside packages/next",
    tagline: "Build · Server · Client · Shared",
    description:
      "The `next` package is split into four layers. `build/` runs at compile time, `server/` runs per request in Node or the Edge runtime, `client/` ships to the browser, and `shared/` holds everything that crosses the boundary. The CLI is the entrypoint that wires them together.",
    source: `flowchart TB
    cli["src/cli<br/>(next dev / build / start)"]
    subgraph build["src/build"]
      compilers["webpack & turbopack configs"]
      entries["entry generation"]
      manifests["manifest writers"]
      analyzer2["analyzer / collect-page-data"]
    end
    subgraph server["src/server"]
      base["base-server"]
      next_server["next-server (prod)"]
      dev_server["dev-server"]
      app_render["app-render (RSC)"]
      pages_render["render (Pages Router)"]
      route_modules["route-modules"]
      cache["response-cache"]
    end
    subgraph client["src/client"]
      bootstrap["app-bootstrap"]
      hot["hot-reloader / fast-refresh"]
      router["app-router runtime"]
      loader["page-loader"]
    end
    subgraph shared["src/shared"]
      lib["lib (router, head, hooks)"]
    end
    compiled["src/compiled<br/>(pre-bundled deps)"]
    cli --> build
    cli --> server
    build --> manifests
    manifests -. consumed by .-> server
    server --> app_render
    server --> pages_render
    app_render -. ships RSC to .-> client
    client --> router
    server --> shared
    client --> shared
    server --> compiled
    build --> compiled`,
  },
  {
    id: "request-lifecycle",
    title: "Request lifecycle",
    tagline: "URL → response, the server path",
    description:
      "Every request is handled by `base-server`, which delegates to a route module. App Router routes flow through `app-render` and stream React Server Component payloads. Pages Router routes go through the legacy `render` path. Both consult the response cache and emit headers + body to Node, Edge, or Bun runtimes.",
    source: `flowchart LR
    req(["Incoming request"]) --> mw["Middleware<br/>(matcher → rewrite/redirect/next)"]
    mw --> match["Route resolver<br/>(reads routes-manifest.json)"]
    match -->|app/| appmod["app-route module"]
    match -->|pages/| pagesmod["pages-route module"]
    appmod --> rsc["app-render<br/>(React Server Components)"]
    rsc --> stream{{"Streaming RSC payload"}}
    pagesmod --> ssr["render<br/>(getServerSideProps / SSG)"]
    ssr --> html{{"Static HTML"}}
    rsc --> respc["response-cache<br/>(memoization · ISR · tags)"]
    ssr --> respc
    respc --> out([Response])
    stream --> out
    html --> out`,
  },
  {
    id: "build-pipeline",
    title: "Build pipeline",
    tagline: "Source → SWC → bundler → manifests",
    description:
      "`next build` walks the `app/` and `pages/` directories, generates entries, runs them through the Rust SWC compiler, and hands the result to Webpack or Turbopack. The output is a set of JSON manifests (routes, build, app-paths, react-loadable, middleware) that the server reads at runtime.",
    source: `flowchart TB
    src["app/, pages/, components/, lib/"]
    cfg["next.config.ts / vercel.ts"]
    src --> entry["entry generation"]
    cfg --> entry
    entry --> swc["next-swc<br/>(Rust transforms)"]
    swc --> bundler{Bundler}
    bundler -->|default| tp["Turbopack"]
    bundler -->|legacy| wp["Webpack"]
    tp --> chunks[".next/static · .next/server"]
    wp --> chunks
    chunks --> mfs["Manifests<br/>routes-manifest, build-manifest,<br/>app-paths-manifest, middleware-manifest"]
    chunks --> tracing["next-tracing<br/>(file traces for slim deploys)"]
    mfs --> deploy([".next/ output"])
    tracing --> deploy`,
  },
  {
    id: "rendering",
    title: "App Router rendering",
    tagline: "RSC, streaming, hydration",
    description:
      "App Router pages compose layouts and pages into a tree of React Server Components. The server renders RSCs, streams their payload to the browser, and inlines a flight payload that the client router uses to hydrate without re-fetching. Client Components are bundled separately and hydrated in place.",
    source: `flowchart LR
    tree["Layout/Page/Loading/Error tree<br/>(file-system routing)"]
    tree --> rsc["RSC render<br/>(server-only)"]
    rsc --> flight["Flight payload<br/>(serialized component tree)"]
    flight --> stream{{"Streamed HTTP response"}}
    stream --> shell["HTML shell + suspense boundaries"]
    shell --> hydrate["Hydrate Client Components"]
    flight --> arouter["app-router runtime<br/>(client cache)"]
    hydrate --> interactive([Interactive page])
    arouter --> nav["Soft navigation<br/>(prefetch · reuse cache)"]`,
  },
  {
    id: "caching",
    title: "Caching architecture",
    tagline: "Four caches, different lifetimes",
    description:
      "Next.js stacks four caches. Per-request memoization dedupes `fetch()` within a render. The Data Cache persists across requests (and is tag-invalidated). The Full Route Cache stores rendered RSC + HTML. The Router Cache lives in the browser to make navigations instant. Cache Components (Next 16) make these explicit via `use cache`, `cacheLife`, `cacheTag`, and `updateTag`.",
    source: `flowchart TB
    user(["Request"]) --> req_memo["Request Memoization<br/>(per-render fetch dedup)"]
    req_memo --> data["Data Cache<br/>(persistent · tag-invalidated)"]
    data --> route["Full Route Cache<br/>(RSC + HTML on disk/edge)"]
    route --> resp([Response])
    resp -. hydrates .-> rc["Router Cache<br/>(client · in-memory)"]
    rc --> nav["Subsequent navigations"]
    nav --> rc
    invalidate{{"revalidateTag · updateTag"}} -. tags .-> data
    invalidate -. tags .-> route`,
  },
];
