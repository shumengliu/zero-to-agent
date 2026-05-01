import { Mermaid } from "@/components/Mermaid";
import { Nav } from "@/components/Nav";
import { diagrams } from "@/lib/diagrams";

export default function Home() {
  return (
    <div className="relative z-10 flex flex-col flex-1">
      <Header />

      <main className="mx-auto w-full max-w-7xl px-6 sm:px-10 pt-20 pb-32">
        <Hero />

        <div className="mt-24 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12 lg:gap-16">
          <Nav items={diagrams.map((d) => ({ id: d.id, title: d.title }))} />

          <div className="space-y-32 min-w-0">
            {diagrams.map((d, i) => (
              <section key={d.id} id={d.id} className="scroll-mt-24">
                <DiagramSection index={i} {...d} />
              </section>
            ))}
          </div>
        </div>

        <Footer />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/40 border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-sm text-zinc-300">
            Inside <span className="text-white font-medium">Next.js</span>
          </span>
        </div>
        <div className="flex items-center gap-5 text-xs text-zinc-500 font-mono">
          <a
            href="https://github.com/vercel/next.js"
            target="_blank"
            rel="noreferrer"
            className="hover:text-zinc-200 transition-colors"
          >
            vercel/next.js ↗
          </a>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <span className="relative inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-gradient-to-b from-white/10 to-white/[0.02]">
      <span className="absolute inset-[3px] rounded-[4px] bg-gradient-to-br from-amber-200/70 via-rose-200/40 to-sky-300/50 blur-[2px] opacity-80" />
      <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
    </span>
  );
}

function Hero() {
  return (
    <section className="pt-12">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-500">
        <span className="h-px w-8 bg-zinc-700" />
        A field guide
      </div>

      <h1 className="mt-6 text-5xl sm:text-6xl md:text-7xl lg:text-[88px] leading-[0.95] tracking-[-0.03em] font-medium text-zinc-50">
        How <span className="font-serif italic font-normal text-amber-100/95">Vercel</span> built
        <br />
        <span className="bg-gradient-to-br from-zinc-100 via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
          the Next.js framework.
        </span>
      </h1>

      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-zinc-400">
        A visual tour through{" "}
        <a
          href="https://github.com/vercel/next.js"
          className="text-zinc-200 underline decoration-zinc-700 underline-offset-4 hover:decoration-zinc-400"
          target="_blank"
          rel="noreferrer"
        >
          vercel/next.js
        </a>
        : the packages, the request lifecycle, the build pipeline, and the four caches that make
        it fast. Six diagrams, drawn in Mermaid, rendered live.
      </p>

      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] rounded-xl overflow-hidden border border-white/[0.06]">
        <Stat label="Diagrams" value="6" />
        <Stat label="Packages" value="20+" hint="in the monorepo" />
        <Stat label="Languages" value="TS · Rust" hint="SWC + Turbopack" />
        <Stat label="Caches" value="4" hint="layers, by lifetime" />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-zinc-950/60 px-5 py-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl text-zinc-100 tracking-tight">{value}</div>
      {hint && <div className="text-[11px] text-zinc-600 mt-0.5">{hint}</div>}
    </div>
  );
}

function DiagramSection({
  id,
  index,
  title,
  tagline,
  description,
  source,
}: {
  id: string;
  index: number;
  title: string;
  tagline: string;
  description: string;
  source: string;
}) {
  return (
    <article>
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-xs tabular-nums text-amber-200/70">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500 font-mono">
          {tagline}
        </span>
      </div>

      <h2 className="mt-3 text-3xl sm:text-4xl tracking-[-0.02em] text-zinc-50 font-medium">
        {title}
      </h2>

      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-zinc-400">
        {description}
      </p>

      <div className="relative mt-8 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-zinc-950/80 to-black overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.015]">
          <span className="h-2 w-2 rounded-full bg-zinc-700" />
          <span className="h-2 w-2 rounded-full bg-zinc-800" />
          <span className="h-2 w-2 rounded-full bg-zinc-800" />
          <span className="ml-3 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            {id}.mmd
          </span>
        </div>
        <div className="p-6 sm:p-10">
          <Mermaid id={id} chart={source} />
        </div>
      </div>
    </article>
  );
}

function Footer() {
  return (
    <footer className="mt-32 pt-10 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
      <div>
        Built for the hackathon. Diagrams are interpretations of the public{" "}
        <a
          href="https://github.com/vercel/next.js"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-300 hover:text-white"
        >
          vercel/next.js
        </a>{" "}
        source.
      </div>
      <div className="flex items-center gap-4">
        <span>Next.js 16 · React 19 · Turbopack</span>
      </div>
    </footer>
  );
}
