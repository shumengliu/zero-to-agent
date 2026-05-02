import { UrlForm } from "@/components/UrlForm";

export default function Home() {
  return (
    <div className="relative z-10 flex flex-col flex-1">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-6 sm:px-10 pt-24 pb-32 flex-1">
        <Hero />

        <div className="mt-14">
          <UrlForm />
        </div>

        <Examples />

        <Footer />
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/40 border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-6xl px-6 sm:px-10 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-sm text-zinc-300">
            <span className="text-white font-medium">Productify</span>
          </span>
        </div>
        <div className="flex items-center gap-5 text-xs text-zinc-500 font-mono">
          <span>powered by v0</span>
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
    <section className="text-center">
      <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-500">
        <span className="h-px w-8 bg-zinc-700" />
        an agent that ships interactive products from repos
        <span className="h-px w-8 bg-zinc-700" />
      </div>

      <h1 className="mt-8 text-5xl sm:text-6xl md:text-7xl leading-[0.98] tracking-[-0.03em] font-medium text-zinc-50">
        Turn any{" "}
        <span className="font-serif italic font-normal text-amber-100/95">
          GitHub repo
        </span>
        <br />
        <span className="bg-gradient-to-br from-zinc-100 via-zinc-300 to-zinc-500 bg-clip-text text-transparent">
          into a working product.
        </span>
      </h1>

      <p className="mt-7 mx-auto max-w-2xl text-base sm:text-lg text-zinc-400 leading-relaxed">
        An investigation agent reads the repo, picks the right product archetype —
        playground, explorer, gallery, docs hub — and commissions{" "}
        <span className="text-zinc-200">v0</span> to ship it. Watch it work.
      </p>
    </section>
  );
}

const EXAMPLES = [
  "vercel/next.js",
  "tokio-rs/tokio",
  "anthropics/claude-code",
  "rust-lang/rust",
];

function Examples() {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
      <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-600 mr-1">
        try one
      </span>
      {EXAMPLES.map((ex) => (
        <ExamplePill key={ex} value={ex} />
      ))}
    </div>
  );
}

function ExamplePill({ value }: { value: string }) {
  // Pure presentational hint — clicking just selects the input via a small bit
  // of progressive enhancement (skip for now; users can copy/paste).
  return (
    <span className="inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-xs font-mono text-zinc-500 hover:text-zinc-300 hover:border-white/[0.16] transition-colors">
      {value}
    </span>
  );
}

function Footer() {
  return (
    <footer className="mt-32 pt-10 border-t border-white/[0.06] text-xs text-zinc-600 font-mono flex flex-wrap gap-4 justify-between">
      <span>productify · hackathon prototype</span>
      <span>v0 platform api · github rest api</span>
    </footer>
  );
}
