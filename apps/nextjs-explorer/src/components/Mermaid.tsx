"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  chart: string;
  id: string;
};

let mermaidPromise: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const m = mod.default;
      m.initialize({
        startOnLoad: false,
        theme: "base",
        securityLevel: "loose",
        fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui",
        themeVariables: {
          background: "transparent",
          primaryColor: "#0b0b0c",
          primaryTextColor: "#f5f5f4",
          primaryBorderColor: "#3f3f46",
          lineColor: "#71717a",
          secondaryColor: "#18181b",
          tertiaryColor: "#0a0a0a",
          clusterBkg: "rgba(244, 244, 245, 0.02)",
          clusterBorder: "rgba(244, 244, 245, 0.12)",
          edgeLabelBackground: "#0a0a0a",
          fontSize: "13px",
        },
        flowchart: {
          curve: "basis",
          padding: 18,
          nodeSpacing: 38,
          rankSpacing: 58,
          htmlLabels: true,
        },
      });
      return m;
    });
  }
  return mermaidPromise;
}

export function Mermaid({ chart, id }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMermaid()
      .then(async (mermaid) => {
        if (cancelled || !ref.current) return;
        try {
          const { svg } = await mermaid.render(`m-${id}`, chart);
          if (cancelled || !ref.current) return;
          ref.current.innerHTML = svg;
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return (
      <pre className="text-xs text-red-400 overflow-auto p-4 bg-red-950/20 rounded-lg border border-red-900/40">
        {error}
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className="mermaid-host w-full overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
      aria-label="Architecture diagram"
    />
  );
}
