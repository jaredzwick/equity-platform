"use client";

import { useEffect, useRef, useState } from "react";
import { saveLogoFromForm } from "./actions";

type Iteration = {
  id: number;
  directive: string;
  b64: string; // PNG base64, no data-URI prefix
};

type Props = {
  tenantSlug: string;
  tenantName: string;
  currentLogoUrl: string | null;
  disabled: boolean;
};

export default function LogoStudio({ tenantSlug, tenantName, currentLogoUrl, disabled }: Props) {
  const [iterations, setIterations] = useState<Iteration[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [directive, setDirective] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [iterations]);

  const selected = iterations.find((i) => i.id === selectedId) ?? null;

  async function generate() {
    const text = directive.trim();
    if (!text || busy || disabled) return;

    setBusy(true);
    setError(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    // Prior directives are sent as assistant/user chat history to keep
    // continuity across iterations (server builds this into the prompt).
    const history = iterations.flatMap((it) => [
      { role: "user" as const, content: it.directive },
      { role: "assistant" as const, content: "(generated logo variant)" },
    ]);

    try {
      const res = await fetch(`/api/${tenantSlug}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive: text, history }),
        signal: ctrl.signal,
      });
      const data = (await res.json()) as { b64?: string; error?: string };
      if (!res.ok || !data.b64) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const id = Date.now();
      const next: Iteration = { id, directive: text, b64: data.b64 };
      setIterations((prev) => [...prev, next]);
      setSelectedId(id);
      setDirective("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("aborted")) setError(msg);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const suggestions = [
    `Minimal geometric mark for ${tenantName}`,
    "Bold monogram, sharp corners",
    "Playful, hand-drawn feel",
    "Abstract shape suggesting motion + growth",
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6 h-[calc(100vh-260px)]">
      {/* Left: chat / prompt column */}
      <div className="flex flex-col border border-[color:var(--color-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[color:var(--color-border)] text-xs text-[color:var(--color-muted)]">
          Iterations · model <code className="text-[color:var(--color-fg)]">gpt-image-1</code>
        </div>

        <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-3">
          {iterations.length === 0 && (
            <div className="text-sm text-[color:var(--color-muted)]">
              Describe the logo you want. Each generation stays on-brand with{" "}
              <span className="text-[color:var(--color-fg)]">{tenantName}</span>&apos;s profile
              (colors, tagline, offer, voice).
              <div className="mt-3 space-y-1 text-xs">
                <div className="text-[color:var(--color-muted)]">Try:</div>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDirective(s)}
                    className="block text-left text-emerald-400 hover:underline"
                  >
                    · {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {iterations.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setSelectedId(it.id)}
              className={
                "w-full text-left rounded border px-3 py-2 flex gap-3 items-start transition-colors " +
                (selectedId === it.id
                  ? "border-emerald-600/70 bg-emerald-950/40"
                  : "border-[color:var(--color-border)] hover:bg-white/5")
              }
            >
              <img
                src={`data:image/png;base64,${it.b64}`}
                alt=""
                className="w-12 h-12 rounded object-cover bg-black shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                  v{i + 1}
                </div>
                <div className="text-sm truncate">{it.directive}</div>
              </div>
            </button>
          ))}
          {busy && (
            <div className="rounded border border-[color:var(--color-border)] px-3 py-2 text-sm text-[color:var(--color-muted)] flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Generating… (~15–30s)
            </div>
          )}
        </div>

        <div className="border-t border-[color:var(--color-border)] p-3 flex gap-2">
          <textarea
            value={directive}
            onChange={(e) => setDirective(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                generate();
              }
            }}
            placeholder={
              iterations.length === 0
                ? "Describe the logo…"
                : "Refine — e.g. 'make it more geometric', 'try a monogram'…"
            }
            rows={3}
            disabled={busy || disabled}
            className="flex-1 p-2 rounded border border-[color:var(--color-border)] bg-white/5 text-sm focus:outline-none focus:border-emerald-600 resize-none disabled:opacity-60"
          />
          {busy ? (
            <button
              onClick={stop}
              className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-500 text-sm self-end"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={!directive.trim() || disabled}
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm self-end"
              title="⌘/Ctrl+Enter"
            >
              Generate
            </button>
          )}
        </div>
        {error && (
          <div className="px-3 pb-3 text-xs text-red-300">{error}</div>
        )}
      </div>

      {/* Right: preview column */}
      <div className="flex flex-col border border-[color:var(--color-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[color:var(--color-border)] flex items-center justify-between">
          <div className="text-xs text-[color:var(--color-muted)]">
            {selected ? `Preview · v${iterations.findIndex((i) => i.id === selected.id) + 1}` : "Preview"}
          </div>
          {selected && (
            <form
              action={async (fd) => {
                setSaving(true);
                try {
                  await saveLogoFromForm(fd);
                } catch (e) {
                  // Server action redirects on success/error; nothing to do
                  // here except release the button in the error redirect.
                  setSaving(false);
                  throw e;
                }
              }}
            >
              <input type="hidden" name="tenant" value={tenantSlug} />
              <input type="hidden" name="b64" value={selected.b64} />
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 text-sm font-medium"
              >
                {saving ? "Saving…" : "Save this logo"}
              </button>
            </form>
          )}
        </div>
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[repeating-conic-gradient(#111_0%_25%,#0a0a0a_0%_50%)] bg-[length:24px_24px]">
          {selected ? (
            <img
              src={`data:image/png;base64,${selected.b64}`}
              alt="logo preview"
              className="max-w-full max-h-full rounded shadow-2xl"
            />
          ) : currentLogoUrl ? (
            <div className="text-center">
              <div className="text-xs text-[color:var(--color-muted)] mb-3">Current logo</div>
              <img
                src={currentLogoUrl}
                alt="current logo"
                className="max-w-full max-h-[70vh] rounded shadow-2xl"
              />
            </div>
          ) : (
            <div className="text-sm text-[color:var(--color-muted)]">
              No logo yet. Generate one on the left.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
