"use client";

import { useEffect, useRef, useState } from "react";
import { ModelPicker, useChatModel } from "@/components/ModelPicker";
import { extractCronProposal } from "@/lib/cron-proposal";

type Msg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  // A dry-run pseudo-message — shown inline in the transcript but not
  // sent back to /api/chat when the operator's next turn goes out.
  | { role: "dryrun"; content: string; forMessageIndex: number };

type Props = { tenantSlug: string; tenantName: string };

export default function ChatUI({ tenantSlug, tenantName }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Per-message dry-run state so multiple proposals in one conversation
  // don't share a spinner.
  const [dryRunBusy, setDryRunBusy] = useState<number | null>(null);
  const { model, setModel } = useChatModel();
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dryRunAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  // The chat API only cares about user/assistant turns. Dry-run
  // pseudo-messages are UI-only — filter them out before sending history.
  function chatHistory(msgs: Msg[]): { role: "user" | "assistant"; content: string }[] {
    return msgs
      .filter((m): m is Extract<Msg, { role: "user" | "assistant" }> =>
        m.role === "user" || m.role === "assistant",
      )
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async function send(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || busy) return;

    const userMsg: Msg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages([...history, { role: "assistant", content: "" }]);
    if (!preset) setInput("");
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: tenantSlug, messages: chatHistory(history), model }),
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

  async function dryRun(assistantIndex: number, prompt: string) {
    if (dryRunBusy !== null) return;
    setDryRunBusy(assistantIndex);

    // Insert a placeholder dryrun message right after the assistant proposal.
    const insertIdx = assistantIndex + 1;
    setMessages((prev) => {
      const next = [...prev];
      next.splice(insertIdx, 0, { role: "dryrun", content: "", forMessageIndex: assistantIndex });
      return next;
    });

    const ctrl = new AbortController();
    dryRunAbortRef.current = ctrl;

    try {
      const res = await fetch("/api/cron/dry-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
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
        setMessages((prev) => {
          const next = [...prev];
          const idx = next.findIndex(
            (m, i) => i > assistantIndex && m.role === "dryrun" && m.forMessageIndex === assistantIndex,
          );
          if (idx >= 0) next[idx] = { role: "dryrun", content: acc, forMessageIndex: assistantIndex };
          return next;
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg !== "AbortError" && !msg.includes("aborted")) {
        setMessages((prev) => {
          const next = [...prev];
          const idx = next.findIndex(
            (m, i) => i > assistantIndex && m.role === "dryrun" && m.forMessageIndex === assistantIndex,
          );
          if (idx >= 0) next[idx] = { role: "dryrun", content: `❌ ${msg}`, forMessageIndex: assistantIndex };
          return next;
        });
      }
    } finally {
      setDryRunBusy(null);
      dryRunAbortRef.current = null;
    }
  }

  function stopDryRun() {
    dryRunAbortRef.current?.abort();
  }

  function stop() {
    abortRef.current?.abort();
  }

  function reset() {
    if (busy) stop();
    if (dryRunBusy !== null) stopDryRun();
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
              <div>· &ldquo;Schedule a weekly SEO audit for {tenantName}.com every Monday at 9am.&rdquo;</div>
              <div>· &ldquo;What growth experiment should I run this week?&rdquo;</div>
              <div>· &ldquo;What events are flowing right now? Anything stale?&rdquo;</div>
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === "dryrun") {
            return (
              <div key={i} className="flex justify-start pl-6">
                <div className="max-w-[85%] px-4 py-2.5 rounded bg-amber-950/20 border border-amber-900/40">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-amber-300 mb-1">
                    <span>🧪 Play output</span>
                    {dryRunBusy === m.forMessageIndex && (
                      <button
                        onClick={stopDryRun}
                        className="text-red-400 hover:text-red-300 normal-case tracking-normal"
                      >
                        stop
                      </button>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap font-normal">
                    {m.content || (dryRunBusy === m.forMessageIndex ? "…" : "")}
                  </div>
                </div>
              </div>
            );
          }

          const proposal = m.role === "assistant" ? extractCronProposal(m.content) : null;
          const canPlay = !!proposal?.prompt && !busy;

          return (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-2"}>
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

              {proposal && m.role === "assistant" && (
                <div className="flex items-center gap-2 pl-2">
                  {proposal.prompt && (
                    <button
                      onClick={() => dryRun(i, proposal.prompt!)}
                      disabled={!canPlay || dryRunBusy !== null}
                      title="Run the prompt now — no commit, no schedule — so you can iterate on it"
                      className="text-xs px-3 py-1.5 rounded bg-amber-600/80 text-white hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                    >
                      ▶ Play
                    </button>
                  )}
                  <button
                    onClick={() => send("commit + apply")}
                    disabled={busy || dryRunBusy !== null}
                    title="Commit crons/<name>.yaml + apply the CronJob to the cluster"
                    className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                  >
                    ✅ Commit + apply
                  </button>
                  <span className="text-[10px] text-[color:var(--color-muted)]">
                    {proposal.mode} · {proposal.schedule}
                  </span>
                </div>
              )}
            </div>
          );
        })}
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
            onClick={() => send()}
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
