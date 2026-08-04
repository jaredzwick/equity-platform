"use client";

import { useEffect, useState } from "react";

type State =
  | { kind: "checking" }
  | { kind: "ready"; targetRepo: string }
  | { kind: "waiting"; targetRepo: string; attempts: number }
  | { kind: "error"; message: string };

// Polls /api/onboarding/fork-ready with exponential backoff (1s → 2s → 4s
// → cap 8s). Renders a status pill and passes the ready-state to the
// parent so it can un-blur the clone commands.
export default function ForkStatusChip({
  onReady,
}: {
  onReady?: (targetRepo: string) => void;
}) {
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      attempts += 1;
      try {
        const res = await fetch("/api/onboarding/fork-ready", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) {
            setState({ kind: "error", message: "Not signed in." });
            return;
          }
          throw new Error(`http_${res.status}`);
        }
        const data = (await res.json()) as { ready: boolean; targetRepo: string };
        if (cancelled) return;
        if (data.ready) {
          setState({ kind: "ready", targetRepo: data.targetRepo });
          onReady?.(data.targetRepo);
          return;
        }
        setState({ kind: "waiting", targetRepo: data.targetRepo, attempts });
        // Exponential backoff capped at 8s
        const delay = Math.min(1000 * 2 ** (attempts - 1), 8000);
        setTimeout(poll, delay);
      } catch (e) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [onReady]);

  if (state.kind === "checking") {
    return <Chip color="muted" label="Checking fork…" />;
  }
  if (state.kind === "waiting") {
    return <Chip color="warn" label={`Preparing fork (attempt ${state.attempts})…`} />;
  }
  if (state.kind === "ready") {
    return <Chip color="good" label={`Fork ready: ${state.targetRepo}`} />;
  }
  return <Chip color="bad" label={`Error: ${state.message}`} />;
}

function Chip({
  color,
  label,
}: {
  color: "good" | "bad" | "warn" | "muted";
  label: string;
}) {
  const map = {
    good: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    bad: "bg-red-500/10 text-red-400 border-red-500/30",
    warn: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    muted: "bg-white/5 text-[color:var(--color-muted)] border-white/10",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${map[color]}`}>
      {label}
    </span>
  );
}
