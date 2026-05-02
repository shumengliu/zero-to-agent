"use client";

import { useState, useRef, useCallback } from "react";
import type { AgentEvent } from "@/lib/agent";
import { ThinkingPanel } from "./ThinkingPanel";
import { ResultView } from "./ResultView";

type Status = "idle" | "running" | "done" | "error";

const KEY_PREFIX_HINT = "v1:";

export function UrlForm() {
  const [repoUrl, setRepoUrl] = useState("");
  const [v0Key, setV0Key] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!repoUrl.trim()) {
        setErrorMessage("Paste a GitHub URL.");
        return;
      }
      if (!v0Key.trim()) {
        setErrorMessage("Paste your v0 API key.");
        return;
      }

      setStatus("running");
      setEvents([]);
      setErrorMessage(null);

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          body: JSON.stringify({ repoUrl: repoUrl.trim(), v0Key: v0Key.trim() }),
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => "Request failed");
          setErrorMessage(text);
          setStatus("error");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          // SSE framing: events separated by \n\n. Each event is a sequence
          // of lines, the data lines start with "data: ".
          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const raw = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const dataLine = raw
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            try {
              const parsed = JSON.parse(dataLine.slice(6)) as AgentEvent;
              setEvents((prev) => [...prev, parsed]);
              if (parsed.type === "error") {
                setErrorMessage(parsed.message);
                setStatus("error");
              }
              if (parsed.type === "done") {
                setStatus("done");
              }
            } catch {
              // skip malformed frame
            }
          }
        }

        // If the stream ended without an explicit done, settle.
        setStatus((s) => (s === "running" ? "done" : s));
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setStatus("error");
      } finally {
        abortRef.current = null;
      }
    },
    [repoUrl, v0Key],
  );

  const onCancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  const commissioned = events.find((e) => e.type === "commissioned");
  const isRunning = status === "running";

  return (
    <div className="w-full max-w-3xl mx-auto">
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm"
      >
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500 mb-2">
            v0 API key{" "}
            <span className="text-zinc-600">— judges, paste yours; never persisted</span>
          </label>
          <input
            type="password"
            value={v0Key}
            onChange={(e) => setV0Key(e.target.value)}
            placeholder={`${KEY_PREFIX_HINT}…`}
            autoComplete="off"
            disabled={isRunning}
            className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2.5 text-zinc-100 placeholder:text-zinc-700 font-mono text-sm outline-none focus:border-white/20 transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500 mb-2">
            GitHub repo
          </label>
          <div className="group relative flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/40 focus-within:border-white/20 transition-colors">
            <span className="pl-3 pr-1 text-zinc-500 font-mono text-sm select-none">
              github.com/
            </span>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              required
              placeholder="vercel/next.js"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={isRunning}
              className="flex-1 bg-transparent border-0 outline-none text-zinc-100 placeholder:text-zinc-700 font-mono text-sm py-2.5"
            />
            <div className="pr-1.5">
              {isRunning ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-300 border border-white/10 hover:border-white/20"
                >
                  cancel
                </button>
              ) : (
                <SubmitButton />
              )}
            </div>
          </div>
        </div>
      </form>

      {errorMessage && (
        <div className="mt-4 text-sm text-rose-300/90 font-mono">⨯ {errorMessage}</div>
      )}

      {events.length > 0 && (
        <div className="mt-10">
          <ThinkingPanel events={events} status={status} />
        </div>
      )}

      {commissioned && commissioned.type === "commissioned" && (
        <div className="mt-12">
          <ResultView result={commissioned.result} repoUrl={repoUrl} />
        </div>
      )}
    </div>
  );
}

function SubmitButton() {
  return (
    <button
      type="submit"
      className="relative inline-flex items-center justify-center rounded-lg px-4 py-1.5 text-xs font-medium text-zinc-950 bg-gradient-to-b from-zinc-100 to-zinc-300 hover:from-white hover:to-zinc-200 transition-all shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]"
    >
      Productify ↵
    </button>
  );
}
