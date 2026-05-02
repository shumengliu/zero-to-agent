"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ResultCard,
  ResultReason,
  SearchCriteria,
  SearchEvent,
} from "@/lib/schema";

type Stage = "auth" | "idle" | "thinking" | "results";

type ThinkingLine = {
  id: number;
  text: string;
  indent: number;
  emphasis: "bold" | "muted" | undefined;
};

const STORAGE_KEY = "rentry.username";

export default function Home() {
  const [username, setUsername] = useState<string | null>(null);
  const [authDraft, setAuthDraft] = useState("");
  const [stage, setStage] = useState<Stage>("auth");
  const [prompt, setPrompt] = useState("");
  const [thinking, setThinking] = useState<ThinkingLine[]>([]);
  const [results, setResults] = useState<ResultCard[]>([]);
  const [criteria, setCriteria] = useState<SearchCriteria | null>(null);
  const lineCounter = useRef(0);
  const streamCtrl = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      setUsername(saved);
      setStage("idle");
    }
    return () => streamCtrl.current?.abort();
  }, []);

  function login(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUsername(trimmed);
    setStage("idle");
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  }

  function logout() {
    streamCtrl.current?.abort();
    streamCtrl.current = null;
    window.localStorage.removeItem(STORAGE_KEY);
    setUsername(null);
    setStage("auth");
    setAuthDraft("");
    setPrompt("");
    setThinking([]);
    setResults([]);
    setCriteria(null);
  }

  async function submitPrompt() {
    if (!username || !prompt.trim()) return;
    setStage("thinking");
    setThinking([]);
    setResults([]);
    setCriteria(null);
    lineCounter.current = 0;

    const res = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, prompt }),
    });
    if (!res.ok) {
      setStage("idle");
      return;
    }
    const { runId } = (await res.json()) as { runId: string };
    void streamRun(runId);
  }

  async function streamRun(runId: string) {
    streamCtrl.current?.abort();
    const ctrl = new AbortController();
    streamCtrl.current = ctrl;
    try {
      const res = await fetch(`/api/search/${runId}/stream`, {
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            applyEvent(JSON.parse(line) as SearchEvent);
          } catch {
            // skip parse errors on partial chunks
          }
        }
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
  }

  function applyEvent(event: SearchEvent) {
    switch (event.kind) {
      case "thinking":
        setThinking((prev) => [
          ...prev,
          {
            id: ++lineCounter.current,
            text: event.text,
            indent: event.indent ?? 0,
            emphasis: event.emphasis,
          },
        ]);
        return;
      case "criteria_extracted":
        setCriteria(event.criteria);
        return;
      case "results":
        setResults(event.cards);
        setStage("results");
        return;
      case "complete":
      case "error":
      case "started":
      default:
        return;
    }
  }

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <Header username={username} onLogout={logout} />
      <main className="mx-auto w-full max-w-5xl px-6 sm:px-10 pt-16 pb-32 flex-1">
        {stage === "auth" && (
          <Auth value={authDraft} onChange={setAuthDraft} onSubmit={() => login(authDraft)} />
        )}

        {(stage === "idle" || stage === "thinking" || stage === "results") && username && (
          <>
            <Pitch username={username} />
            <PromptForm
              value={prompt}
              onChange={setPrompt}
              onSubmit={submitPrompt}
              disabled={stage === "thinking"}
              minimised={stage !== "idle"}
            />
            {(stage === "thinking" || stage === "results") && (
              <Trace lines={thinking} />
            )}
            {stage === "results" && results.length > 0 && (
              <Results cards={results} criteria={criteria} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// --- Components --------------------------------------------------------------

function Header({
  username,
  onLogout,
}: {
  username: string | null;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-black/40 border-b border-white/[0.06]">
      <div className="mx-auto w-full max-w-5xl px-6 sm:px-10 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-warm)]" />
          <span className="text-sm text-zinc-300">
            <span className="text-white font-medium">Rentry</span>
            <span className="text-zinc-500 ml-2">— the friend in London you wish you had</span>
          </span>
        </div>
        <div className="flex items-center gap-5 text-xs text-zinc-500 font-mono">
          {username && (
            <>
              <span>signed in as <span className="text-zinc-300">{username}</span></span>
              <button
                onClick={onLogout}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                logout
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Auth({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col items-center pt-32">
      <h1 className="text-5xl sm:text-6xl tracking-tight font-medium text-white text-center max-w-3xl">
        Find a flat the way a
        <span className="font-serif italic text-[var(--accent-warm)]"> friend with insider knowledge </span>
        would.
      </h1>
      <p className="mt-6 text-zinc-400 max-w-xl text-center text-base sm:text-lg leading-relaxed">
        Type your name. Rentry remembers what you care about across sessions —
        commute targets, deal-breakers, areas you've explored.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mt-12 w-full max-w-md flex flex-col items-stretch gap-3"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="username"
          className="px-4 py-3 rounded-lg bg-black/40 border border-white/[0.1] text-base text-white outline-none focus:border-[var(--accent-warm)] transition-colors text-center"
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="px-5 py-3 rounded-lg bg-[var(--accent-warm)] text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Enter →
        </button>
        <p className="text-center text-[11px] font-mono text-zinc-600 mt-2">
          try <span className="text-zinc-400">shumeng</span> for the seeded demo profile
        </p>
      </form>
    </div>
  );
}

function Pitch({ username }: { username: string }) {
  return (
    <div className="pt-12">
      <p className="text-xs font-mono text-zinc-600 uppercase tracking-wide">
        welcome back, {username}
      </p>
      <h1 className="mt-3 text-4xl sm:text-5xl tracking-tight font-medium text-white">
        What are you
        <span className="font-serif italic text-[var(--accent-warm)]"> looking for </span>
        this time?
      </h1>
    </div>
  );
}

function PromptForm({
  value,
  onChange,
  onSubmit,
  disabled,
  minimised,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  minimised: boolean;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className={`mt-${minimised ? "8" : "12"} transition-all`}
    >
      <div className="flex items-stretch gap-3">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. studios near KCL under £2,000 with an easy commute to Camden"
          disabled={disabled}
          className="flex-1 px-5 py-4 rounded-xl bg-black/40 border border-white/[0.1] text-base sm:text-lg text-white outline-none focus:border-[var(--accent-warm)] disabled:opacity-50 transition-colors"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="px-6 py-4 rounded-xl bg-[var(--accent-warm)] text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Go →
        </button>
      </div>
    </form>
  );
}

function Trace({ lines }: { lines: ThinkingLine[] }) {
  return (
    <div className="mt-14 space-y-3 font-serif text-zinc-300">
      {lines.map((l) => (
        <TraceLine key={l.id} line={l} />
      ))}
    </div>
  );
}

function TraceLine({ line }: { line: ThinkingLine }) {
  const size = line.indent > 0 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl";
  const tone =
    line.emphasis === "bold"
      ? "text-white"
      : line.emphasis === "muted"
        ? "text-zinc-500"
        : "text-zinc-200";
  const indentPx = line.indent * 28;

  return (
    <div
      className={`${size} ${tone} fade-in-up`}
      style={{ paddingLeft: indentPx }}
    >
      {line.indent > 0 && <span className="text-zinc-600 mr-3">→</span>}
      {line.text}
      <style jsx>{`
        .fade-in-up {
          animation: fadeInUp 600ms ease-out both;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function Results({
  cards,
  criteria,
}: {
  cards: ResultCard[];
  criteria: SearchCriteria | null;
}) {
  return (
    <section className="mt-20">
      <p className="text-xs font-mono text-zinc-600 uppercase tracking-wide">
        top 3 of {cards.length === 0 ? "0" : "many"}
        {criteria?.commuteTarget && (
          <> · ranked by commute to {criteria.commuteTarget}</>
        )}
      </p>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {cards.map((card, i) => (
          <ResultCardView key={card.listingId} card={card} elevated={i === 0} />
        ))}
      </div>
    </section>
  );
}

function ResultCardView({
  card,
  elevated,
}: {
  card: ResultCard;
  elevated: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border overflow-hidden transition-shadow ${
        elevated
          ? "border-[var(--accent-warm)]/40 bg-zinc-950/90 shadow-[0_0_60px_-15px_rgba(245,209,153,0.4)] lg:scale-[1.02]"
          : "border-white/[0.08] bg-zinc-950/70"
      }`}
    >
      {card.photo && (
        <div
          className="h-44 bg-cover bg-center"
          style={{ backgroundImage: `url(${card.photo})` }}
        />
      )}
      <div className="p-5 sm:p-6">
        <h3 className="text-lg text-white font-medium leading-snug">
          {card.title}
        </h3>
        <p className="mt-1 text-sm text-zinc-400">
          £{card.pricePcm.toLocaleString()} pcm · {card.area}
        </p>
        <ul className="mt-5 space-y-2.5">
          {card.reasons.map((r, i) => (
            <ReasonLine key={i} reason={r} />
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-between text-xs font-mono text-zinc-600">
          <span>via {card.source}</span>
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-zinc-200"
          >
            view original →
          </a>
        </div>
      </div>
    </article>
  );
}

function ReasonLine({ reason }: { reason: ResultReason }) {
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span
        className={`shrink-0 mt-[2px] ${
          reason.remembered
            ? "text-[var(--accent-pink)]"
            : "text-[var(--accent-green)]"
        }`}
      >
        ✓
      </span>
      <span
        className={
          reason.remembered
            ? "italic text-zinc-300"
            : "text-zinc-200"
        }
      >
        {reason.text}
        {reason.remembered && (
          <span className="ml-2 text-[11px] not-italic font-mono text-[var(--accent-pink)]/80">
            — remembered from last session
          </span>
        )}
      </span>
    </li>
  );
}
