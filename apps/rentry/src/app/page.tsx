"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import type {
  ConversationContext,
  ResultCard,
  ResultReason,
  SearchCriteria,
  SearchEvent,
} from "@/lib/schema";

// One turn in the conversation. The user can submit multiple prompts; each
// creates a new turn at the top, streamed independently. Older turns stay
// visible below. The prompt re-enables as soon as the current stream closes.
type Turn = {
  id: string;
  prompt: string;
  runNumber: number;
  step: { current: number; total: number; label: string } | null;
  thinking: ThinkingLine[];
  criteria: SearchCriteria | null;
  results: ResultCard[];
  status: "thinking" | "complete" | "error";
};

type ThinkingLine = {
  id: number;
  text: string;
  indent: number;
  emphasis: "bold" | "muted" | undefined;
  style: "default" | "mubit_header" | "mubit_item";
  mubitSessionsAgo?: number;
};

const STORAGE_KEY = "rentry.username";

export default function Home() {
  const [username, setUsername] = useState<string | null>(null);
  const [authDraft, setAuthDraft] = useState("");
  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const lineCounter = useRef(0);
  const streamCtrl = useRef<AbortController | null>(null);
  const promptInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    if (saved) setUsername(saved);
    return () => streamCtrl.current?.abort();
  }, []);

  function login(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setUsername(trimmed);
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  }

  function logout() {
    streamCtrl.current?.abort();
    streamCtrl.current = null;
    window.localStorage.removeItem(STORAGE_KEY);
    setUsername(null);
    setAuthDraft("");
    setPrompt("");
    setTurns([]);
    setStreaming(false);
  }

  function submitPrompt() {
    void runSearch(prompt);
  }

  async function runSearch(rawText: string) {
    const text = rawText.trim();
    if (!username || !text || streaming) return;
    setPrompt("");

    // Build conversation context from the most recent successfully-completed
    // turn. Follow-ups like "cheaper" / "smaller" inherit prior areas, budget,
    // commute target etc.
    const lastDone = turns.find(
      (t) => t.status === "complete" && t.criteria != null,
    );
    const priorContext: ConversationContext | undefined = lastDone
      ? {
          priorCriteria: lastDone.criteria!,
          priorTopTitle: lastDone.results[0]?.title ?? null,
          priorTopPricePcm: lastDone.results[0]?.pricePcm ?? null,
        }
      : undefined;

    const turnId = `t-${Date.now()}`;
    const newTurn: Turn = {
      id: turnId,
      prompt: text,
      runNumber: 0,
      step: null,
      thinking: [],
      criteria: null,
      results: [],
      status: "thinking",
    };
    setTurns((prev) => [newTurn, ...prev]);
    setStreaming(true);

    streamCtrl.current?.abort();
    const ctrl = new AbortController();
    streamCtrl.current = ctrl;

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          prompt: text,
          priorContext,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        finishTurn(turnId, "error");
        return;
      }
      const { runId } = (await res.json()) as { runId: string };

      const streamRes = await fetch(`/api/search/${runId}/stream`, {
        signal: ctrl.signal,
      });
      if (!streamRes.ok || !streamRes.body) {
        finishTurn(turnId, "error");
        return;
      }
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let terminal = false;
      outer: while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as SearchEvent;
            applyEvent(turnId, event);
            // The server stream stays open until Vercel's maxDuration elapses
            // even after the workflow completes — so we close it ourselves
            // the moment we see a terminal event. Without this the prompt
            // input stays disabled for up to 2 minutes after results land.
            if (event.kind === "complete" || event.kind === "error") {
              terminal = true;
              break outer;
            }
          } catch {
            /* skip malformed chunk */
          }
        }
      }
      try {
        await reader.cancel();
      } catch {
        /* fine */
      }
      finishTurn(turnId, terminal ? "complete" : "complete");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") {
        finishTurn(turnId, "error");
      }
    } finally {
      setStreaming(false);
      // Refocus the prompt input so a follow-up is one keystroke away.
      requestAnimationFrame(() => promptInputRef.current?.focus());
    }
  }

  function submitFollowUp(text: string) {
    void runSearch(text);
  }

  function applyEvent(turnId: string, event: SearchEvent) {
    setTurns((prev) =>
      prev.map((t) => (t.id === turnId ? reduceTurn(t, event) : t)),
    );
  }

  function finishTurn(turnId: string, status: "complete" | "error") {
    setTurns((prev) =>
      prev.map((t) => (t.id === turnId ? { ...t, status } : t)),
    );
  }

  function reduceTurn(turn: Turn, event: SearchEvent): Turn {
    switch (event.kind) {
      case "started":
        return { ...turn, runNumber: event.runNumber };
      case "step":
        return {
          ...turn,
          step: {
            current: event.current,
            total: event.total,
            label: event.label,
          },
        };
      case "thinking":
        return {
          ...turn,
          thinking: [
            ...turn.thinking,
            {
              id: ++lineCounter.current,
              text: event.text,
              indent: event.indent ?? 0,
              emphasis: event.emphasis,
              style: event.style ?? "default",
              mubitSessionsAgo: event.mubitSessionsAgo,
            },
          ],
        };
      case "criteria_extracted":
        return { ...turn, criteria: event.criteria };
      case "results":
        return { ...turn, results: event.cards };
      case "complete":
        return { ...turn, status: "complete" };
      default:
        return turn;
    }
  }

  if (!username) {
    return (
      <div className="relative z-10 flex flex-col flex-1">
        <Header username={null} onLogout={logout} />
        <main className="mx-auto w-full max-w-5xl px-6 sm:px-10 pt-16 pb-32 flex-1">
          <Auth
            value={authDraft}
            onChange={setAuthDraft}
            onSubmit={() => login(authDraft)}
          />
        </main>
      </div>
    );
  }

  const isFirstTime = turns.length === 0;
  const showFirstTimeBanner =
    isFirstTime && username.toLowerCase() !== "shumeng";

  const latestComplete = turns.find(
    (t) => t.status === "complete" && t.results.length > 0,
  );

  return (
    <div className="relative z-10 flex flex-col flex-1">
      <Header username={username} onLogout={logout} />
      <main className="mx-auto w-full max-w-5xl px-6 sm:px-10 pt-12 pb-32 flex-1">
        {turns.length === 0 && <Pitch username={username} />}

        <div className="sticky top-14 z-30 -mx-6 sm:-mx-10 px-6 sm:px-10 py-3 backdrop-blur-xl bg-black/60 border-b border-white/[0.04]">
          <PromptForm
            ref={promptInputRef}
            value={prompt}
            onChange={setPrompt}
            onSubmit={submitPrompt}
            disabled={streaming}
            placeholder={
              turns.length === 0
                ? "e.g. studio in Hackney under £1500"
                : "ask a follow-up — e.g. 'cheaper', 'more bedrooms', 'different area'"
            }
          />
          {latestComplete && !streaming && (
            <FollowUpChips onPick={submitFollowUp} />
          )}
        </div>

        {showFirstTimeBanner && <FirstTimeBanner />}

        <div className="mt-12 space-y-16">
          {turns.map((turn, i) => (
            <TurnView key={turn.id} turn={turn} latest={i === 0} />
          ))}
        </div>
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
            <span className="text-zinc-500 ml-2">
              — the friend in London you wish you had
            </span>
          </span>
        </div>
        <div className="flex items-center gap-5 text-xs text-zinc-500 font-mono">
          <a
            href="/demo-finish"
            className="px-2.5 py-1 rounded-md border border-white/[0.1] text-zinc-400 hover:text-white hover:border-white/[0.2] transition-colors"
          >
            finish demo →
          </a>
          {username && (
            <>
              <span>
                signed in as{" "}
                <span className="text-zinc-300">{username}</span>
              </span>
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
        <span className="font-serif italic text-[var(--accent-warm)]">
          {" "}
          friend with insider knowledge{" "}
        </span>
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
          try <span className="text-zinc-400">shumeng</span> for the seeded
          demo profile
        </p>
      </form>
    </div>
  );
}

function Pitch({ username }: { username: string }) {
  return (
    <div className="pt-4 pb-2">
      <p className="text-xs font-mono text-zinc-600 uppercase tracking-wide">
        welcome back, {username}
      </p>
      <h1 className="mt-3 text-4xl sm:text-5xl tracking-tight font-medium text-white">
        What are you
        <span className="font-serif italic text-[var(--accent-warm)]">
          {" "}
          looking for{" "}
        </span>
        this time?
      </h1>
    </div>
  );
}

type PromptFormProps = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder: string;
};

const PromptForm = forwardRef<HTMLInputElement, PromptFormProps>(
  function PromptForm(
    { value, onChange, onSubmit, disabled, placeholder },
    ref,
  ) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-stretch gap-3">
          <input
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 px-5 py-3 rounded-xl bg-black/40 border border-white/[0.1] text-base text-white outline-none focus:border-[var(--accent-warm)] disabled:opacity-50 transition-colors"
          />
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="px-6 py-3 rounded-xl bg-[var(--accent-warm)] text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {disabled ? "…" : "Go →"}
          </button>
        </div>
      </form>
    );
  },
);

const FOLLOW_UP_CHIPS = [
  "cheaper",
  "more bedrooms",
  "smaller",
  "different area",
  "similar to before",
];

function FollowUpChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-zinc-600 font-mono">try a follow-up:</span>
      {FOLLOW_UP_CHIPS.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onPick(chip)}
          className="px-3 py-1 rounded-full border border-white/[0.1] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

function FirstTimeBanner() {
  return (
    <div className="mt-6 rounded-xl border border-[var(--accent-cool)]/20 bg-[var(--accent-cool)]/[0.04] p-4 text-sm text-zinc-300">
      <span className="text-[var(--accent-cool)] mr-2">●</span>
      First time? You'll see live listings.{" "}
      <span className="text-zinc-500">
        Log in as <span className="font-mono text-zinc-300">shumeng</span> to
        see the personalised version from the demo.
      </span>
    </div>
  );
}

// --- A single turn (prompt + step counter + trace + cards) -------------------

function TurnView({ turn, latest }: { turn: Turn; latest: boolean }) {
  return (
    <section
      className={`relative ${latest ? "" : "opacity-70"}`}
      aria-current={latest ? "true" : undefined}
    >
      <div className="mb-3 text-xs font-mono text-zinc-500">
        you asked: <span className="text-zinc-300">"{turn.prompt}"</span>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-8">
        <StepCounter turn={turn} />

        <div className="flex-1 min-w-0">
          {turn.thinking.length > 0 && <Trace lines={turn.thinking} />}
          {turn.results.length > 0 && (
            <Results cards={turn.results} criteria={turn.criteria} />
          )}
        </div>
      </div>
    </section>
  );
}

function StepCounter({ turn }: { turn: Turn }) {
  const { runNumber, step } = turn;
  return (
    <aside className="lg:w-56 lg:shrink-0 lg:sticky lg:top-20 self-start">
      <div className="rounded-lg border border-white/[0.08] bg-black/40 p-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="text-[var(--accent-cool)]">▶</span>
          <span>rentry-agent</span>
        </div>
        <div className="mt-1 text-zinc-500">
          run #{runNumber || "—"}
          {step && ` · step ${step.current}/${step.total}`}
        </div>
        {step && (
          <div className="mt-2 text-zinc-300 leading-snug">{step.label}</div>
        )}
        <div className="mt-3 flex gap-1">
          {step
            ? Array.from({ length: step.total }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded ${
                    i < step.current
                      ? "bg-[var(--accent-cool)]"
                      : "bg-white/[0.08]"
                  }`}
                />
              ))
            : Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="h-1 flex-1 rounded bg-white/[0.04]"
                />
              ))}
        </div>
      </div>
    </aside>
  );
}

function Trace({ lines }: { lines: ThinkingLine[] }) {
  return (
    <div className="space-y-3 font-serif text-zinc-300">
      {lines.map((l) => (
        <TraceLine key={l.id} line={l} />
      ))}
    </div>
  );
}

function TraceLine({ line }: { line: ThinkingLine }) {
  if (line.style === "mubit_header") {
    return (
      <div className="fade-in-up text-2xl sm:text-3xl text-[var(--accent-cool)] flex items-baseline gap-3">
        <span className="text-2xl">🧠</span>
        <span>{line.text}</span>
        <FadeStyle />
      </div>
    );
  }
  if (line.style === "mubit_item") {
    return (
      <div
        className="fade-in-up text-lg sm:text-xl text-zinc-300 flex items-baseline gap-3"
        style={{ paddingLeft: 32 }}
      >
        <span className="text-zinc-600">•</span>
        <span>{line.text}</span>
        {line.mubitSessionsAgo != null && (
          <MubitPill sessionsAgo={line.mubitSessionsAgo} />
        )}
        <FadeStyle />
      </div>
    );
  }

  const size =
    line.indent > 0 ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl";
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
      <FadeStyle />
    </div>
  );
}

function FadeStyle() {
  return (
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
  );
}

function MubitPill({ sessionsAgo }: { sessionsAgo: number }) {
  const label =
    sessionsAgo === 0
      ? "this session"
      : `${sessionsAgo} session${sessionsAgo === 1 ? "" : "s"} ago`;
  return (
    <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] not-italic font-mono bg-[var(--accent-cool)]/10 text-[var(--accent-cool)] border border-[var(--accent-cool)]/30">
      <span className="opacity-70">Mubit</span>
      <span className="opacity-40">·</span>
      <span>{label}</span>
    </span>
  );
}

function Results({
  cards,
  criteria,
}: {
  cards: ResultCard[];
  criteria: SearchCriteria | null;
}) {
  if (cards.length === 0) {
    return (
      <section className="mt-12">
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-8 text-center">
          <p className="text-zinc-300">
            No live listings matched
            {criteria?.budgetPcm != null
              ? ` your £${criteria.budgetPcm.toLocaleString()} pcm ceiling`
              : " those criteria"}
            {criteria?.areas.length
              ? ` in ${criteria.areas.join(" / ")}`
              : ""}
            .
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Try widening the budget or naming a cheaper area — Hackney,
            Peckham, Brixton, or Walthamstow tend to have more under-£1,500
            stock.
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className="mt-12">
      <p className="text-xs font-mono text-zinc-600 uppercase tracking-wide">
        top {Math.min(3, cards.length)}
        {criteria?.commuteTarget && (
          <> · ranked by commute to {criteria.commuteTarget}</>
        )}
      </p>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {cards.map((card, i) => (
          <ResultCardView
            key={card.listingId}
            card={card}
            elevated={i === 0}
          />
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
  const isWarning = reason.text.startsWith("⚠");
  const checkColor = isWarning
    ? "text-[var(--accent-red)]"
    : reason.remembered
      ? "text-[var(--accent-cool)]"
      : "text-[var(--accent-green)]";

  return (
    <li className="flex items-start gap-2.5 text-sm">
      <span className={`shrink-0 mt-[2px] ${checkColor}`}>
        {isWarning ? "⚠" : "✓"}
      </span>
      <span
        className={`flex-1 ${reason.remembered ? "text-zinc-200" : "text-zinc-200"}`}
      >
        <span>{reason.text.replace(/^⚠\s*/, "")}</span>
        {reason.remembered && (
          <MubitPill sessionsAgo={reason.mubitSessionsAgo ?? 2} />
        )}
      </span>
    </li>
  );
}
