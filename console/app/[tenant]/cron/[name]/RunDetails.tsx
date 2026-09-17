"use client";

import { useState } from "react";

type Props = {
  namespace: string;
  podName: string | null;
  summary?: string;   // NATS-derived summary for runner crons
  exitCode?: number;  // NATS-derived exit code
};

export default function RunDetails({ namespace, podName, summary, exitCode }: Props) {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && log === null && podName) {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/pods/${namespace}/${podName}/logs?tail=500`, {
          cache: "no-store",
        });
        const text = await res.text();
        if (!res.ok) {
          setErr(text);
        } else {
          setLog(text.length === 0 ? "(pod stdout was empty)" : text);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
      >
        {open ? "hide" : "details"}
      </button>

      {open && (
        <div className="mt-2 space-y-3 text-xs">
          {summary && (
            <div>
              <div className="uppercase tracking-wider text-[10px] text-[color:var(--color-muted)] mb-1">
                Summary {typeof exitCode === "number" && `· exit ${exitCode}`}
              </div>
              <pre className="whitespace-pre-wrap font-normal text-[color:var(--color-fg)] bg-white/[0.02] border border-[color:var(--color-border)] rounded p-2 max-h-64 overflow-auto">
                {summary}
              </pre>
            </div>
          )}

          <div>
            <div className="uppercase tracking-wider text-[10px] text-[color:var(--color-muted)] mb-1">
              Pod stdout {podName ? `· ${podName}` : "· (no pod recorded)"}
            </div>
            {!podName ? (
              <div className="text-[color:var(--color-muted)] italic">
                No pod tracked for this run — probably GC'd (k8s prunes successful pods per <code>successfulJobsHistoryLimit</code>).
              </div>
            ) : loading ? (
              <div className="text-[color:var(--color-muted)]">Loading…</div>
            ) : err ? (
              <pre className="whitespace-pre-wrap text-red-400 bg-red-950/40 border border-red-900 rounded p-2">
                {err}
              </pre>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-[11px] text-[color:var(--color-fg)] bg-black/40 border border-[color:var(--color-border)] rounded p-2 max-h-96 overflow-auto">
                {log ?? ""}
              </pre>
            )}
          </div>
        </div>
      )}
    </>
  );
}
