import Link from "next/link";

const URL_LABEL = "rentry-zero-to-agent.vercel.app";
const URL_HREF = "https://rentry-zero-to-agent.vercel.app";

export default function DemoFinishPage() {
  return (
    <div className="relative z-10 flex flex-1 flex-col min-h-[100dvh]">
      <header className="px-8 sm:px-14 pt-10 sm:pt-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent-warm)] pulse-dot" />
          <span className="text-base sm:text-lg tracking-tight text-white font-medium">
            Rentry
          </span>
        </div>
        <Link
          href="/"
          className="text-xs font-mono text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          ← back
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 -mt-6">
        <p className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.32em] text-zinc-600">
          try it now — on your phone
        </p>

        <a
          href={URL_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-8 sm:mt-10 block text-center"
        >
          <h1 className="url-shimmer text-[12vw] sm:text-[8.5vw] leading-[0.95] tracking-tight font-medium text-white break-words">
            {URL_LABEL}
          </h1>
        </a>

        <p className="mt-10 sm:mt-14 text-2xl sm:text-3xl font-serif italic text-[var(--accent-warm)] text-center max-w-3xl leading-snug">
          the friend in London you wish you had.
        </p>
      </main>

      <footer className="px-6 sm:px-12 pb-12 sm:pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-10">
            <SponsorLine
              brand="Bright Data"
              verb="SEES"
              tone="warm"
              caption="the live London market"
            />
            <SponsorLine
              brand="Vercel Workflow"
              verb="RUNS"
              tone="cool"
              caption="every step, durable"
            />
            <SponsorLine
              brand="Mubit"
              verb="REMEMBERS"
              tone="pink"
              caption="what makes you, you"
            />
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.25); }
        }
        .pulse-dot { animation: pulse-dot 2.4s ease-in-out infinite; }

        @keyframes url-shimmer {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.18); }
        }
        .url-shimmer {
          animation: url-shimmer 4.2s ease-in-out infinite;
          text-shadow:
            0 0 80px rgba(245, 209, 153, 0.18),
            0 0 220px rgba(158, 193, 255, 0.12);
        }
      `}</style>
    </div>
  );
}

function SponsorLine({
  brand,
  verb,
  tone,
  caption,
}: {
  brand: string;
  verb: string;
  tone: "warm" | "cool" | "pink";
  caption: string;
}) {
  const verbColor =
    tone === "warm"
      ? "text-[var(--accent-warm)]"
      : tone === "cool"
        ? "text-[var(--accent-cool)]"
        : "text-[var(--accent-pink)]";
  return (
    <div className="border-t border-white/[0.08] pt-5">
      <p className="text-xs font-mono uppercase tracking-[0.18em] text-zinc-500">
        {brand}
      </p>
      <p className={`mt-2 text-3xl sm:text-4xl font-medium ${verbColor}`}>
        {verb}
      </p>
      <p className="mt-2 text-sm text-zinc-500">{caption}</p>
    </div>
  );
}
