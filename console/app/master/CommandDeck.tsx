"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BusinessSummary } from "./page";
import { ModelPicker, useChatModel } from "@/components/ModelPicker";

type Msg = { role: "user" | "assistant"; content: string };
type Props = { businesses: BusinessSummary[] };

export default function CommandDeck({ businesses }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { model, setModel } = useChatModel();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasConversation = messages.length > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(text?: string) {
    const raw = (text ?? input).trim();
    if (!raw || busy) return;
    const userMsg: Msg = { role: "user", content: raw };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: "master", messages: history, model }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      if (!res.body) throw new Error("no response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: acc }]);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "AbortError" && !msg.includes("aborted")) {
        setMessages([...history, { role: "assistant", content: `Error: ${msg}` }]);
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    if (busy) stop();
    setMessages([]);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const suggestions = businesses.length === 0
    ? [
        "Walk me through creating my first business.",
        "What kinds of businesses does this platform run best?",
        "Draft a one-liner for a new business I'm considering.",
      ]
    : [
        "Health summary across all my businesses.",
        "Which business should I focus on this week and why?",
        "Suggest one growth experiment for each business.",
      ];

  return (
    <div className="flex flex-col items-center min-h-[calc(100vh-120px)] pt-4">
      <div className="w-full max-w-3xl flex flex-col flex-1">
        {!hasConversation && (
          <div className="text-center mb-10 mt-8">
            <h1 className="text-3xl font-semibold tracking-tight mb-2">
              What do you want to do?
            </h1>
            <p className="text-sm text-[color:var(--color-muted)]">
              {businesses.length === 0
                ? "No businesses in the workspace yet. Start with a question or a request below."
                : `${businesses.length} business${businesses.length === 1 ? "" : "es"} in view. Ask the agent anything about your fleet.`}
            </p>
          </div>
        )}

        {hasConversation && (
          <div className="mb-3 flex items-center justify-between text-xs text-[color:var(--color-muted)]">
            <div>Agency agent · live snapshot per turn</div>
            <div className="flex items-center gap-3">
              <ModelPicker value={model} onChange={setModel} disabled={busy} />
              <button onClick={reset} className="hover:text-[color:var(--color-fg)]">
                New conversation
              </button>
            </div>
          </div>
        )}

        {hasConversation && (
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto space-y-4 pb-4 border border-[color:var(--color-border)] rounded-lg p-5 mb-3 min-h-[300px]"
          >
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    "max-w-[85%] px-4 py-2.5 rounded-lg " +
                    (m.role === "user"
                      ? "bg-emerald-950/40 border border-emerald-900/60"
                      : "bg-white/5 border border-[color:var(--color-border)]")
                  }
                >
                  <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
                    {m.role === "user" ? "You" : "Agent"}
                  </div>
                  <div className="text-sm whitespace-pre-wrap font-normal leading-relaxed">
                    {m.content || (busy && i === messages.length - 1 ? "…" : "")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasConversation && (
          <div className="flex justify-end mb-2 text-xs text-[color:var(--color-muted)]">
            <ModelPicker value={model} onChange={setModel} disabled={busy} />
          </div>
        )}

        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask anything, or describe what you want to do…"
            rows={hasConversation ? 2 : 3}
            disabled={busy}
            className="w-full p-4 pr-24 rounded-xl border border-[color:var(--color-border)] bg-white/5 text-sm focus:outline-none focus:border-emerald-600/70 focus:ring-2 focus:ring-emerald-600/20 resize-none disabled:opacity-60 transition"
          />
          <div className="absolute right-3 bottom-3">
            {busy ? (
              <button
                onClick={stop}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 font-medium text-sm"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
              >
                Send
              </button>
            )}
          </div>
        </div>

        {!hasConversation && (
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-[color:var(--color-border)] text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] hover:border-emerald-700/60 hover:bg-emerald-950/10 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <BusinessStrip businesses={businesses} />
      </div>
    </div>
  );
}

function BusinessStrip({ businesses }: { businesses: BusinessSummary[] }) {
  if (businesses.length === 0) {
    return (
      <div className="mt-10 pt-8 border-t border-[color:var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
            Workspace
          </div>
          <Link
            href="/master/new"
            className="text-xs text-[color:var(--color-muted)] hover:text-emerald-500"
          >
            + Create manually
          </Link>
        </div>
        <div className="text-sm text-[color:var(--color-muted)]">
          Your businesses will appear here once created. Ask the agent, or use{" "}
          <Link href="/master/new" className="text-emerald-500 hover:underline">
            the form
          </Link>
          .
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10 pt-8 border-t border-[color:var(--color-border)]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
          Workspace · {businesses.length} business{businesses.length === 1 ? "" : "es"}
        </div>
        <Link href="/master/new" className="text-xs text-[color:var(--color-muted)] hover:text-emerald-500">
          + New
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {businesses.map((b) => (
          <BusinessChip key={b.slug} b={b} />
        ))}
      </div>
    </div>
  );
}

function BusinessChip({ b }: { b: BusinessSummary }) {
  const unhealthy = b.apps.total - b.apps.healthy;
  const red = b.crons.stale > 0 || unhealthy > 0;
  const amber = b.crons.suspended > 0;
  const dot = red ? "bg-red-500" : amber ? "bg-amber-500" : "bg-emerald-500";
  return (
    <Link
      href={`/${b.slug}`}
      className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[color:var(--color-border)] hover:border-emerald-700/60 hover:bg-emerald-950/10 transition"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`inline-block w-2 h-2 rounded-full ${dot} shrink-0`} />
        <span className="text-sm font-medium truncate">{b.name}</span>
      </div>
      <span className="text-[10px] text-[color:var(--color-muted)] font-mono shrink-0">
        {b.apps.total}a · {b.crons.total}c
      </span>
    </Link>
  );
}
