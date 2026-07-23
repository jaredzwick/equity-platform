"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { BusinessSummary } from "./page";

type Props = { businesses: BusinessSummary[] };

export default function MasterView({ businesses }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return businesses;
    return businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(needle) ||
        b.slug.toLowerCase().includes(needle) ||
        b.namespaces.some((n) => n.toLowerCase().includes(needle)),
    );
  }, [businesses, q]);

  return (
    <div className="max-w-6xl">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <p className="text-sm text-[color:var(--color-muted)]">
          {businesses.length} business{businesses.length === 1 ? "" : "es"} · click a card to drill in
        </p>
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search businesses…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="px-3 py-2 rounded border border-[color:var(--color-border)] bg-white/5 text-sm w-64 focus:outline-none focus:border-emerald-600"
          />
          <Link
            href="/master/new"
            className="text-sm px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-medium whitespace-nowrap"
          >
            + New Business
          </Link>
        </div>
      </div>

      {businesses.length === 0 && (
        <EmptyState />
      )}

      {businesses.length > 0 && filtered.length === 0 && (
        <div className="p-8 text-center text-sm text-[color:var(--color-muted)] border border-[color:var(--color-border)] rounded">
          No businesses match <span className="text-[color:var(--color-fg)]">&ldquo;{q}&rdquo;</span>.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {filtered.map((b) => (
          <BusinessCard key={b.slug} b={b} />
        ))}
      </div>
    </div>
  );
}

function BusinessCard({ b }: { b: BusinessSummary }) {
  const appsUnhealthy = b.apps.total - b.apps.healthy;
  const anyRed = b.crons.stale > 0 || appsUnhealthy > 0;
  return (
    <Link
      href={`/${b.slug}`}
      className="group block border border-[color:var(--color-border)] rounded-lg p-5 hover:border-emerald-700/60 hover:bg-emerald-950/10 transition"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-lg font-semibold flex items-center gap-2">
            {b.name}
            <span className="text-[color:var(--color-muted)] group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-transform">→</span>
          </div>
          <div className="text-xs text-[color:var(--color-muted)] font-mono mt-0.5">
            {b.namespaces.join(", ")}
          </div>
        </div>
        <StatusDot red={anyRed} amber={b.crons.suspended > 0} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <MiniStat
          label="Apps"
          value={b.apps.total}
          detail={b.apps.total === 0 ? "none" : `${b.apps.healthy}/${b.apps.total} healthy`}
          bad={appsUnhealthy > 0}
        />
        <MiniStat
          label="Cron"
          value={b.crons.total}
          detail={
            b.crons.total === 0
              ? "none"
              : b.crons.stale > 0
              ? `${b.crons.stale} stale`
              : "all fresh"
          }
          bad={b.crons.stale > 0}
        />
      </div>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  detail,
  bad,
}: {
  label: string;
  value: number;
  detail: string;
  bad?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <span className="text-2xl font-semibold">{value}</span>
        <span className={`text-xs ${bad ? "text-red-400" : "text-[color:var(--color-muted)]"}`}>{detail}</span>
      </div>
    </div>
  );
}

function StatusDot({ red, amber }: { red: boolean; amber: boolean }) {
  const color = red ? "bg-red-500" : amber ? "bg-amber-500" : "bg-emerald-500";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} mt-2`} title={red ? "has issues" : amber ? "warnings" : "healthy"} />;
}

function EmptyState() {
  return (
    <div className="p-10 text-center border border-dashed border-[color:var(--color-border)] rounded">
      <div className="text-lg font-medium mb-1">No businesses yet</div>
      <div className="text-sm text-[color:var(--color-muted)] mb-4">
        A business is a Kubernetes namespace labeled{" "}
        <code className="text-neutral-400">equity.io/tenant</code>.
      </div>
      <Link
        href="/master/new"
        className="inline-block text-sm px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-medium"
      >
        + Create your first business
      </Link>
    </div>
  );
}
