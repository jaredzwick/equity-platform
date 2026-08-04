"use client";

import { useEffect, useRef, useState } from "react";

type State =
  | { kind: "checking" }
  | { kind: "ready"; targetRepo: string }
  | { kind: "needs_fork"; targetRepo: string; forkUrl: string; upstream: string; attempts: number }
  | { kind: "error"; message: string };

// Polls /api/onboarding/fork-ready. Three outcomes per poll:
//   200 { ready: true, ... }         → fork exists, we're done
//   200 { ready: false, needsFork }  → no fork yet — show the "Fork on
//                                       GitHub" CTA + keep polling in the
//                                       background so the moment the user
//                                       clicks-and-forks in the other tab
//                                       we flip to ready
//   401                              → not signed in
export default function ForkStatusChip({
  onReady,
}: {
  onReady?: (targetRepo: string) => void;
}) {
  const [state, setState] = useState<State>({ kind: "checking" });
  // Track attempts across polls without triggering effect re-runs.
  const attemptsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      attemptsRef.current += 1;

      let nextDelayMs = 3000; // steady 3s once we're in "needs_fork" mode
      try {
        const res = await fetch("/api/onboarding/fork-ready", { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 401) {
            setState({ kind: "error", message: "Not signed in." });
            return;
          }
          throw new Error(`http_${res.status}`);
        }
        const data = (await res.json()) as {
          ready?: boolean;
          needsFork?: boolean;
          targetRepo: string;
          forkUrl?: string;
          upstream?: string;
        };
        if (cancelled) return;

        if (data.ready) {
          setState({ kind: "ready", targetRepo: data.targetRepo });
          onReady?.(data.targetRepo);
          return;
        }

        if (data.needsFork && data.forkUrl && data.upstream) {
          setState({
            kind: "needs_fork",
            targetRepo: data.targetRepo,
            forkUrl: data.forkUrl,
            upstream: data.upstream,
            attempts: attemptsRef.current,
          });
          // Steady poll — user's clicking "Fork" in another tab; snappy
          // enough to feel instant, cheap enough to run forever.
          nextDelayMs = 3000;
        } else {
          // Backoff for other unexpected transient states.
          nextDelayMs = Math.min(1000 * 2 ** (attemptsRef.current - 1), 8000);
        }
        setTimeout(() => {
          void poll();
        }, nextDelayMs);
      } catch (e) {
        if (cancelled) return;
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [onReady]);

  if (state.kind === "checking") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">
        <Spinner /> Checking your GitHub account for the fork…
      </div>
    );
  }

  if (state.kind === "ready") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
        <CheckIcon /> Fork ready: <code className="text-emerald-100">{state.targetRepo}</code>
      </div>
    );
  }

  if (state.kind === "needs_fork") {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-300">
            <ForkIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white">Fork the template repo</div>
            <p className="mt-1 text-sm text-white/60">
              You&rsquo;ll need your own copy of{" "}
              <code className="text-white/80">{state.upstream}</code> — the console commits
              YAML directly to it. Click below to fork; we&rsquo;ll detect it automatically
              (usually within a few seconds).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a
                href={state.forkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-indigo-500/40"
              >
                Fork on GitHub
                <ArrowUpRight />
              </a>
              <span className="inline-flex items-center gap-1.5 text-xs text-white/40">
                <Spinner small /> Watching for the fork (attempt {state.attempts})…
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
      Error: {state.message}
    </div>
  );
}

function Spinner({ small = false }: { small?: boolean }) {
  const size = small ? "h-3 w-3" : "h-4 w-4";
  return (
    <svg className={`animate-spin ${size}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 0 1 .006 1.415l-8.25 8.335a1 1 0 0 1-1.42 0l-3.75-3.79a1 1 0 1 1 1.42-1.41l3.04 3.073 7.54-7.617a1 1 0 0 1 1.414-.006Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.5 4a.75.75 0 0 1 .75-.75h9a.75.75 0 0 1 .75.75v9a.75.75 0 0 1-1.5 0V5.81L5.03 15.53a.75.75 0 0 1-1.06-1.06L13.69 4.75H6.25A.75.75 0 0 1 5.5 4Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ForkIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
      <path d="M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm10 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM5 13a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z" />
      <path
        fillRule="evenodd"
        d="M5 8v4h1V8H5Zm10 0v1.5a3.5 3.5 0 0 1-3.5 3.5H9v-1.5h2.5A2 2 0 0 0 13.5 9.5V8H15Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
