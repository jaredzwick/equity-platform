import { notFound } from "next/navigation";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { loadMetrics } from "@/lib/metrics";
import MetricsClient from "./MetricsClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ saved?: string; error?: string; gitwarn?: string; git?: string }>;
};

export default async function MetricsPage({ params, searchParams }: Props) {
  const { tenant: slug } = await params;
  const { saved, error, gitwarn, git } = await searchParams;
  if (slug === MASTER_SLUG) notFound();

  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const doc = await loadMetrics(slug);

  return (
    <div className="max-w-6xl">
      <div className="mb-4 text-sm text-[color:var(--color-muted)]">
        Day-by-day ERP for <span className="text-[color:var(--color-fg)]">{tenant.name}</span>.
        Enter what you did, watch the rates.{" "}
        <span className="text-xs">
          Stored at <code className="text-neutral-400">local/.state/metrics/{slug}.yaml</code>,
          mirrored to <code className="text-neutral-400">businesses/{slug}.metrics.yaml</code> when git is configured.
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          {error}
        </div>
      )}
      {saved && !gitwarn && (
        <div className="mb-4 px-3 py-2 border border-emerald-500/40 rounded-lg bg-emerald-950/80 text-xs text-emerald-200">
          Saved {saved}
          {git ? ` · git ${git}` : ""}.
        </div>
      )}
      {saved && gitwarn && (
        <div className="mb-4 px-3 py-2 border border-[color:var(--color-border)] rounded-lg bg-white/5 text-xs">
          Saved locally. Git backup skipped ({/401/.test(gitwarn) ? "auth expired" : "sync error"}).
        </div>
      )}

      <MetricsClient tenantSlug={slug} doc={doc} />
    </div>
  );
}
