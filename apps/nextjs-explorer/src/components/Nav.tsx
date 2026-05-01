"use client";

import { useEffect, useState } from "react";
import type { Diagram } from "@/lib/diagrams";

export function Nav({ items }: { items: Pick<Diagram, "id" | "title">[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      {
        rootMargin: "-30% 0px -60% 0px",
        threshold: 0,
      }
    );
    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) obs.observe(el);
    }
    observers.push(obs);
    return () => {
      for (const o of observers) o.disconnect();
    };
  }, [items]);

  return (
    <nav className="sticky top-24 hidden lg:block">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-3 font-mono">
        Field guide
      </div>
      <ol className="space-y-1.5 text-sm">
        {items.map((item, i) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`group flex items-baseline gap-3 py-1 transition-colors ${
                  isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    isActive ? "text-amber-200/80" : "text-zinc-600"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="leading-tight">{item.title}</span>
                {isActive && (
                  <span className="ml-auto h-1 w-1 rounded-full bg-amber-200 self-center" />
                )}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
