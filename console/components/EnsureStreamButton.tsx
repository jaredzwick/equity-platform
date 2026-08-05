"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function EnsureStreamButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    try {
      const res = await fetch("/api/nats/ensure-stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) {
        setError(body.error ?? "provision failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="text-xs px-3 py-1.5 rounded border border-[color:var(--color-border)] hover:bg-white/5 disabled:opacity-50"
      >
        {isPending ? "Provisioning…" : `Provision events.${slug}.> stream`}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
