"use client";

import { useEffect, useRef, useState } from "react";

// Simulated terminal: types the boot sequence, then shows the "ready"
// confirmation. Devtool-native visual — more concrete than a 3D scene
// for signaling "this actually works."
const LINES: Array<{
  prompt?: string;
  text: string;
  color?: string;
  delay?: number;
}> = [
  { prompt: "$", text: "gh repo fork jaredzwick/equity-platform --clone" },
  { text: "✓ Forked to your account", color: "text-emerald-400", delay: 300 },
  { prompt: "$", text: "cd equity-platform && ./local/up.sh", delay: 400 },
  { text: "→ Creating kind cluster 'equity-local'…", color: "text-white/60", delay: 500 },
  { text: "✓ Cluster ready (90s)", color: "text-emerald-400", delay: 1000 },
  { text: "→ Installing ArgoCD v3.4.6", color: "text-white/60", delay: 200 },
  { text: "✓ Reconciled 7 Applications", color: "text-emerald-400", delay: 900 },
  { text: "→ Console: http://localhost:3030", color: "text-cyan-300", delay: 500 },
];

export default function TerminalPanel() {
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) {
      // Show everything instantly, no typing
      setVisibleIndex(LINES.length);
      return;
    }
    let cancelled = false;
    let i = 0;
    let ch = 0;
    let timer: number | undefined;

    const step = () => {
      if (cancelled) return;
      if (i >= LINES.length) return;
      const line = LINES[i];
      if (line.prompt) {
        // Type char-by-char
        if (ch < line.text.length) {
          ch++;
          setTypedChars(ch);
          timer = window.setTimeout(step, 25 + Math.random() * 45);
        } else {
          i++;
          ch = 0;
          setTypedChars(0);
          setVisibleIndex(i);
          timer = window.setTimeout(step, LINES[i]?.delay ?? 400);
        }
      } else {
        // Reveal instantly
        i++;
        setVisibleIndex(i);
        timer = window.setTimeout(step, LINES[i]?.delay ?? 400);
      }
    };

    timer = window.setTimeout(step, 700);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom as new lines appear
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleIndex, typedChars]);

  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-2xl shadow-indigo-500/10 backdrop-blur">
      {/* Chrome */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/60 px-4 py-2">
        <span className="h-3 w-3 rounded-full bg-red-500/70" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
        <span className="ml-3 text-xs text-white/40 font-mono">
          ~/equity-platform
        </span>
      </div>
      {/* Body */}
      <div
        ref={scrollerRef}
        className="max-h-[280px] overflow-hidden p-4 font-mono text-xs leading-relaxed sm:text-sm"
      >
        {LINES.slice(0, visibleIndex + (typedChars > 0 ? 1 : 0)).map((line, idx) => {
          const isCurrent = idx === visibleIndex && typedChars > 0 && line.prompt;
          const rendered = isCurrent ? line.text.slice(0, typedChars) : line.text;
          const shouldRender = !isCurrent || rendered.length > 0;
          if (!shouldRender && !isCurrent) return null;
          return (
            <div key={idx} className={line.color ?? "text-white/90"}>
              {line.prompt && (
                <span className="mr-2 select-none text-fuchsia-400">{line.prompt}</span>
              )}
              {rendered}
              {isCurrent && (
                <span className="ml-0.5 inline-block h-4 w-1.5 -translate-y-[1px] animate-pulse bg-white/80 align-middle" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
