"use client";

import { useState } from "react";
import type { CommissionResult } from "@/lib/commission";

export function ResultView({
  result,
  repoUrl,
}: {
  result: CommissionResult;
  repoUrl: string;
}) {
  const { archetype, demoUrl, webUrl, chatId, status } = result;
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-emerald-300/80">
            ✓ shipped — {archetype}
          </div>
          <h2 className="mt-2 text-3xl tracking-[-0.02em] text-zinc-50">
            <span className="font-mono text-zinc-300">{repoUrl || chatId}</span>
            <span className="font-serif italic text-zinc-500"> — productified</span>
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            archetype: {archetype} · status: {status}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {webUrl && <Action href={webUrl} label="Open in v0 ↗" tone="primary" />}
          {webUrl && (
            <Action
              href={`${webUrl}?fork=1`}
              label="Fork to GitHub"
              tone="secondary"
            />
          )}
          {repoUrl && (
            <Action
              href={
                repoUrl.startsWith("http") ? repoUrl : `https://github.com/${repoUrl}`
              }
              label="Source repo ↗"
              tone="ghost"
            />
          )}
        </div>
      </div>

      {demoUrl ? (
        <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-zinc-950 border-b border-white/[0.06]">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
            <span className="ml-3 text-xs text-zinc-500 font-mono truncate">
              {demoUrl}
            </span>
          </div>
          <iframe
            src={demoUrl}
            title="Generated v0 preview"
            className="block w-full h-[640px] bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.03] p-6 text-amber-100/80 text-sm">
          v0 generation accepted (chat <code className="font-mono">{chatId}</code>)
          but hasn&rsquo;t produced a demo URL yet. Open the chat in v0 to watch it
          finish.
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowPrompt((v) => !v)}
        className="text-xs font-mono uppercase tracking-[0.18em] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {showPrompt ? "− hide v0 prompt" : "+ show v0 prompt"}
      </button>

      {showPrompt && (
        <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40 p-4 text-[11px] font-mono leading-relaxed text-zinc-400 max-h-96">
          {result.prompt}
        </pre>
      )}
    </div>
  );
}

function Action({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: "primary" | "secondary" | "ghost";
}) {
  const styles = {
    primary:
      "bg-gradient-to-b from-zinc-100 to-zinc-300 text-zinc-950 hover:from-white hover:to-zinc-200",
    secondary:
      "border border-white/[0.12] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.07]",
    ghost: "text-zinc-400 hover:text-zinc-200",
  }[tone];

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${styles}`}
    >
      {label}
    </a>
  );
}
