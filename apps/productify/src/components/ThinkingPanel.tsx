"use client";

import { useMemo, useState } from "react";
import type { AgentEvent } from "@/lib/agent";

type Status = "idle" | "running" | "done" | "error";

type ToolFrame = {
  id: string;
  name: string;
  args: unknown;
  startedAt: number;
  durationMs?: number;
  result?: unknown;
};

type Trail = {
  startedRepo?: string;
  branch?: string;
  tools: ToolFrame[];
  text: string;
  steps: number;
};

function reduceEvents(events: AgentEvent[]): Trail {
  const trail: Trail = { tools: [], text: "", steps: 0 };
  for (const ev of events) {
    switch (ev.type) {
      case "started":
        trail.startedRepo = ev.repo;
        trail.branch = ev.branch;
        break;
      case "tool_call":
        trail.tools.push({
          id: ev.toolCallId,
          name: ev.name,
          args: ev.args,
          startedAt: Date.now(),
        });
        break;
      case "tool_result": {
        const idx = trail.tools.findIndex((t) => t.id === ev.toolCallId);
        if (idx >= 0) {
          trail.tools[idx] = {
            ...trail.tools[idx],
            result: ev.result,
            durationMs: ev.durationMs,
          };
        }
        break;
      }
      case "agent_text":
        trail.text += ev.text;
        break;
      case "step_finished":
        trail.steps = ev.step;
        break;
      default:
        break;
    }
  }
  return trail;
}

export function ThinkingPanel({
  events,
  status,
}: {
  events: AgentEvent[];
  status: Status;
}) {
  const trail = useMemo(() => reduceEvents(events), [events]);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/30 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <StatusDot status={status} />
          <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-zinc-400">
            agent trace
          </span>
          {trail.startedRepo && (
            <span className="text-xs font-mono text-zinc-500">
              · {trail.startedRepo}@{trail.branch}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-zinc-600">
          {trail.tools.length} tool {trail.tools.length === 1 ? "call" : "calls"}
        </span>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {trail.tools.map((t, i) => (
          <ToolRow key={t.id} index={i + 1} frame={t} />
        ))}
      </div>

      {trail.text && (
        <div className="px-5 py-4 border-t border-white/[0.06] bg-white/[0.01]">
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-zinc-500 mb-2">
            agent
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-serif">
            {trail.text}
          </p>
        </div>
      )}
    </div>
  );
}

function ToolRow({ index, frame }: { index: number; frame: ToolFrame }) {
  const [open, setOpen] = useState(false);
  const pending = frame.result === undefined;

  return (
    <div className="px-5 py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 text-left"
      >
        <span className="font-mono text-[10px] text-zinc-600 w-6 shrink-0">
          {String(index).padStart(2, "0")}
        </span>
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
            pending ? "bg-amber-300/80 animate-pulse" : "bg-emerald-300/80"
          }`}
        />
        <span className="font-mono text-sm text-zinc-200">{frame.name}</span>
        <ArgPreview args={frame.args} />
        <span className="ml-auto text-[10px] font-mono text-zinc-600">
          {pending
            ? "running…"
            : frame.durationMs != null
              ? `${(frame.durationMs / 1000).toFixed(1)}s`
              : ""}
        </span>
      </button>

      {open && (
        <div className="mt-3 pl-9 grid gap-3">
          <CodeBlock label="input" value={frame.args} />
          {frame.result !== undefined && (
            <CodeBlock label="output" value={frame.result} />
          )}
        </div>
      )}
    </div>
  );
}

function ArgPreview({ args }: { args: unknown }) {
  const text = useMemo(() => {
    if (!args || typeof args !== "object") return "";
    const entries = Object.entries(args as Record<string, unknown>);
    if (entries.length === 0) return "";
    return entries
      .map(([k, v]) => {
        const s = typeof v === "string" ? v : JSON.stringify(v);
        return `${k}: ${truncate(String(s), 32)}`;
      })
      .join("  ");
  }, [args]);

  if (!text) return null;
  return (
    <span className="font-mono text-xs text-zinc-500 truncate max-w-[40ch]">
      {text}
    </span>
  );
}

function CodeBlock({ label, value }: { label: string; value: unknown }) {
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/40 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-white/[0.04] text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-600">
        {label}
      </div>
      <pre className="overflow-x-auto p-3 text-[11px] font-mono leading-relaxed text-zinc-400 max-h-72">
        {truncate(formatted, 4000)}
      </pre>
    </div>
  );
}

function StatusDot({ status }: { status: Status }) {
  const cls = {
    idle: "bg-zinc-600",
    running: "bg-amber-300 animate-pulse",
    done: "bg-emerald-400",
    error: "bg-rose-400",
  }[status];
  return <span className={`h-2 w-2 rounded-full ${cls}`} aria-hidden />;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`;
}
