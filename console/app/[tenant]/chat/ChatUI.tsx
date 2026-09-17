"use client";

import { useEffect, useRef, useState } from "react";
import { ModelPicker, useChatModel } from "@/components/ModelPicker";

type Msg = { role: "user" | "assistant"; content: string };
type Props = { tenantSlug: string; tenantName: string };

export default function ChatUI({ tenantSlug, tenantName }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { model, setModel } = useChatModel();
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: Msg = { role: "user", content: text };
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
        body: JSON.stringify({ tenant: tenantSlug, messages: history, model }),
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
        setMessages([...history, { role: "assistant", content: `❌ ${msg}` }]);
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
  }

  return (
    <div className="max-w-3xl flex flex-col h-[calc(100vh-180px)]">
      <div className="mb-3 flex items-center justify-between text-xs text-[color:var(--color-muted)]">
        <div>
          Chatting with the {tenantName} agent · cluster + event bus state re-fetched each turn
        </div>
        <div className="flex items-center gap-3">
          <ModelPicker value={model} onChange={setModel} disabled={busy} />
          {messages.length > 0 && (
            <button onClick={reset} className="hover:text-[color:var(--color-fg)]">
              Reset
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-auto space-y-4 pb-4 border border-[color:var(--color-border)] rounded p-4"
      >
        {messages.length === 0 && (
          <div className="text-sm text-[color:var(--color-muted)]">
            I&apos;m your copilot for {tenantName} — strategy, marketing, sales, customer discovery,
            AND the live cluster + event bus behind it. Every turn refreshes app health, cron
            staleness, NATS streams, recent event subjects, and today&apos;s budget spend.
            <div className="mt-3 space-y-1 text-xs">
              <div>Try:</div>
              <div>· &ldquo;Who is the ideal customer for {tenantName} and why?&rdquo;</div>
              <div>· &ldquo;Draft a cold-outbound message for {tenantName}&apos;s top segment.&rdquo;</div>
              <div>· &ldquo;What growth experiment should I run this week?&rdquo;</div>
              <div>· &ldquo;What events are flowing right now? Anything stale?&rdquo;</div>
              <div>· &ldquo;Scaffold an enrich that scores listing.deal.created events.&rdquo;</div>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[85%] px-4 py-2.5 rounded " +
                (m.role === "user"
                  ? "bg-emerald-950/40 border border-emerald-900/60"
                  : "bg-white/5 border border-[color:var(--color-border)]")
              }
            >
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-1">
                {m.role === "user" ? "You" : "Assistant"}
              </div>
              <div className="text-sm whitespace-pre-wrap font-normal">
                {m.content || (busy && i === messages.length - 1 ? "…" : "")}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Ask about ${tenantName}…`}
          rows={2}
          disabled={busy}
          className="flex-1 p-3 rounded border border-[color:var(--color-border)] bg-white/5 text-sm focus:outline-none focus:border-emerald-600 resize-none disabled:opacity-60"
        />
        {busy ? (
          <button
            onClick={stop}
            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-500 font-medium text-sm self-end"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={send}
            disabled={!input.trim()}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm self-end"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
