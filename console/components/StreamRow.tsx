"use client";

import { useState } from "react";
import type { StreamRow as StreamRowData } from "@/lib/nats";
import type { PeekedMessage } from "@/lib/nats-peek";
import { fmtBytes } from "@/lib/nats";

type PeekState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; messages: PeekedMessage[] }
  | { status: "error"; error: string };

export function StreamRow({ stream }: { stream: StreamRowData }) {
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<PeekState>({ status: "idle" });

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && peek.status === "idle") {
      await load();
    }
  }

  async function load() {
    setPeek({ status: "loading" });
    try {
      const res = await fetch("/api/nats/peek", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stream: stream.name, count: 10 }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        messages: PeekedMessage[];
        error?: string;
      };
      if (body.ok) setPeek({ status: "ok", messages: body.messages });
      else setPeek({ status: "error", error: body.error ?? "peek failed" });
    } catch (e) {
      setPeek({ status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <>
      <tr className="border-t border-[color:var(--color-border)] hover:bg-white/5">
        <td className="p-3">
          <button
            onClick={toggle}
            className="mr-2 text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] font-mono"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? "▾" : "▸"}
          </button>
          <span className="font-medium">{stream.name}</span>
        </td>
        <td className="p-3 font-mono text-xs">{stream.subjects.join(", ") || "—"}</td>
        <td className="p-3">{stream.messages.toLocaleString()}</td>
        <td className="p-3">{fmtBytes(stream.bytes)}</td>
        <td className="p-3">{stream.consumerCount}</td>
      </tr>
      {open && (
        <tr className="border-t border-[color:var(--color-border)] bg-black/20">
          <td colSpan={5} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase text-[color:var(--color-muted)]">
                Last 10 messages
              </div>
              <button
                onClick={load}
                className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
              >
                refresh
              </button>
            </div>
            {peek.status === "loading" && (
              <div className="text-sm text-[color:var(--color-muted)]">loading…</div>
            )}
            {peek.status === "error" && (
              <div className="text-sm text-red-400">peek failed: {peek.error}</div>
            )}
            {peek.status === "ok" && peek.messages.length === 0 && (
              <div className="text-sm text-[color:var(--color-muted)]">no messages yet</div>
            )}
            {peek.status === "ok" && peek.messages.length > 0 && (
              <ol className="space-y-2 text-xs font-mono">
                {peek.messages.map((m) => (
                  <li
                    key={m.seq}
                    className="border border-[color:var(--color-border)] rounded p-2 bg-black/40"
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[color:var(--color-muted)]">#{m.seq}</span>
                      <span className="text-[color:var(--color-muted)]">{m.timestamp}</span>
                    </div>
                    <div className="text-neutral-300 mb-1">{m.subject}</div>
                    <pre className="text-neutral-400 whitespace-pre-wrap break-all">
                      {typeof m.payload === "string"
                        ? m.payload
                        : JSON.stringify(m.payload, null, 2)}
                    </pre>
                  </li>
                ))}
              </ol>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
