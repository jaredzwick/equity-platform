"use client";

import { useState, useTransition } from "react";
import type { SellerListing } from "@/lib/lamboapp-admin";

export default function ListingsTable({ listings }: { listings: SellerListing[] }) {
  const [pending, startTransition] = useTransition();
  const [confirmingID, setConfirmingID] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const doUnpublish = (dealID: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/listings/${encodeURIComponent(dealID)}/unpublish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        // Success — hard reload so the RSC refetches
        window.location.reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="overflow-x-auto rounded border border-white/10 bg-white/[0.02]">
      {error && (
        <div className="border-b border-red-400/40 bg-red-400/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
          <tr>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Business</th>
            <th className="px-3 py-2">Asking</th>
            <th className="px-3 py-2">Files</th>
            <th className="px-3 py-2">Seller</th>
            <th className="px-3 py-2">Phone</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {listings.map((l) => {
            const isConfirming = confirmingID === l.deal_id;
            const created = new Date(l.created_at * 1000).toLocaleString();
            const asking = l.asking_price ? `$${l.asking_price.toLocaleString()}` : "—";
            return (
              <tr key={l.deal_id} className="hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-[color:var(--color-muted)]">
                  {created}
                </td>
                <td className="px-3 py-2">
                  <StatusPill listing={l} />
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-[color:var(--color-fg)]">{l.name}</div>
                  <div className="text-xs text-[color:var(--color-muted)]">
                    {l.origin} · {l.industry || "—"} · {l.location || "—"}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">{asking}</td>
                <td className="px-3 py-2 text-center">{l.file_count}</td>
                <td className="px-3 py-2 text-xs">
                  <div>{l.seller_email || "—"}</div>
                  {l.ghl_contact_id && (
                    <div className="text-[color:var(--color-muted)]">
                      GHL: {l.ghl_contact_id.slice(0, 12)}…
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{l.seller_phone || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {l.slug && (
                    <a
                      href={`https://www.lamboapp.com/deal/${l.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mr-2 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      view ↗
                    </a>
                  )}
                  {l.published ? (
                    isConfirming ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="reason (optional)"
                          className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => doUnpublish(l.deal_id)}
                          className="rounded bg-red-500/80 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          {pending ? "…" : "confirm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmingID(null);
                            setReason("");
                          }}
                          className="rounded border border-white/10 px-2 py-1 text-xs text-[color:var(--color-muted)] hover:bg-white/5"
                        >
                          cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingID(l.deal_id)}
                        className="rounded border border-red-400/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-200"
                      >
                        unpublish
                      </button>
                    )
                  ) : (
                    <span className="text-xs text-[color:var(--color-muted)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ listing }: { listing: SellerListing }) {
  if (!listing.paid_amount_cents) {
    return <Pill tone="muted">draft</Pill>;
  }
  if (listing.published) {
    return <Pill tone="ok">published</Pill>;
  }
  return <Pill tone="warn">paid · unpublished</Pill>;
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "muted"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-green-500/20 text-green-300 border-green-500/30"
      : tone === "warn"
        ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
        : "bg-white/[0.06] text-[color:var(--color-muted)] border-white/10";
  return (
    <span className={"inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider " + cls}>
      {children}
    </span>
  );
}
