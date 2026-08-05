"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type Props = { tenantSlug: string; tenantName: string };

export default function ChatUI({ tenantSlug, tenantName }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
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
        body: JSON.stringify({ tenant: tenantSlug, messages: history }),
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
          Chatting with the {tenantName} agent · cluster + event bus state
          re-fetched each turn · model <code className="text-[color:var(--color-fg)]">claude-opus-4-7</code>
        </div>
        {messages.length > 0 && (
          <button onClick={reset} className="hover:text-[color:var(--color-fg)]">
            Reset
          </button>
        )}
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-auto space-y-4 pb-4 border border-[color:var(--color-border)] rounded p-4"
      >
        {messages.length === 0 && (
          <div className="text-sm text-[color:var(--color-muted)]">
            Ask about {tenantName}&apos;s infrastructure or its event bus. Every turn refreshes
            live app health, cron staleness, NATS streams, recent event subjects, registered
            consumers, and today&apos;s budget spend.
            <div className="mt-3 space-y-1 text-xs">
              <div>Try:</div>
              <div>· &ldquo;What events are flowing right now?&rdquo;</div>
              <div>· &ldquo;What consumers are registered on this stream?&rdquo;</div>
              <div>· &ldquo;Scaffold an enrich that scores listing.deal.created events.&rdquo;</div>
              <div>· &ldquo;Are any cron jobs stale?&rdquo;</div>
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
