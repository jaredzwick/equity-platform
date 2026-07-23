import Link from "next/link";
import { listArgoApps, listCronJobs } from "@/lib/k8s";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tenant: string }> };

function StatusPill({ status }: { status: string | undefined }) {
  const s = (status ?? "unknown").toLowerCase();
  const color =
    s === "synced" || s === "healthy"
      ? "text-emerald-400 bg-emerald-950/40 border-emerald-900/60"
      : s === "progressing"
      ? "text-amber-400 bg-amber-950/40 border-amber-900/60"
      : s === "degraded" || s === "outofsync" || s === "missing"
      ? "text-red-400 bg-red-950/40 border-red-900/60"
      : "text-neutral-400 bg-neutral-800/40 border-neutral-700";
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${color}`}>{status ?? "unknown"}</span>
  );
}

export default async function TenantOverview({ params }: Props) {
  const { tenant: slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const isMaster = slug === MASTER_SLUG;
  // Master: no filter (list all argocd apps regardless of destination).
  // Tenant: filter by that tenant's namespaces.
  const nsFilter = isMaster ? undefined : tenant.namespaces;

  const [apps, crons] = await Promise.all([
    listArgoApps(nsFilter).catch(() => []),
    listCronJobs(nsFilter).catch(() => []),
  ]);

  const staleCrons = crons.filter((c) => {
    if (!c.lastSuccessfulTime) return !c.suspend;
    return Date.now() - new Date(c.lastSuccessfulTime).getTime() > 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="max-w-6xl">
      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-medium">Applications ({apps.length})</h2>
          {!isMaster && (
            <Link
              href={`/${slug}/apps/new`}
              className="text-xs px-3 py-1.5 rounded border border-[color:var(--color-border)] hover:bg-white/5"
            >
              + New Application
            </Link>
          )}
        </div>
        <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                <th className="p-3">Name</th>
                <th className="p-3">Destination</th>
                <th className="p-3">Sync</th>
                <th className="p-3">Health</th>
                <th className="p-3">Chart</th>
              </tr>
            </thead>
            <tbody>
              {apps.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <div className="text-sm text-[color:var(--color-fg)] mb-1">
                      No apps deployed{isMaster ? "" : ` to ${tenant.name}`} yet.
                    </div>
                    <div className="text-xs text-[color:var(--color-muted)] mb-3">
                      An app is any Helm chart wrapped as an ArgoCD Application.
                    </div>
                    {!isMaster && (
                      <Link
                        href={`/${slug}/apps/new`}
                        className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-medium inline-block"
                      >
                        + Provision one
                      </Link>
                    )}
                  </td>
                </tr>
              )}
              {apps.map((a) => {
                const src = a.spec.sources?.[0] ?? a.spec.source;
                return (
                  <tr key={a.metadata.name} className="border-t border-[color:var(--color-border)]">
                    <td className="p-3 font-medium">{a.metadata.name}</td>
                    <td className="p-3 text-[color:var(--color-muted)]">{a.spec.destination.namespace}</td>
                    <td className="p-3"><StatusPill status={a.status?.sync?.status} /></td>
                    <td className="p-3"><StatusPill status={a.status?.health?.status} /></td>
                    <td className="p-3 text-[color:var(--color-muted)] text-xs">
                      {src?.chart ?? "—"} {src?.targetRevision ? `@ ${src.targetRevision}` : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-medium">CronJobs ({crons.length})</h2>
          {staleCrons > 0 && (
            <Link href={`/${slug}/cron`} className="text-xs text-red-400">
              {staleCrons} stale — investigate
            </Link>
          )}
        </div>
        <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                <th className="p-3">Name</th>
                <th className="p-3">Namespace</th>
                <th className="p-3">Schedule</th>
                <th className="p-3">Last success</th>
              </tr>
            </thead>
            <tbody>
              {crons.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <div className="text-sm text-[color:var(--color-fg)] mb-1">
                      No cron jobs{isMaster ? "" : ` in ${tenant.name}`} yet.
                    </div>
                    <div className="text-xs text-[color:var(--color-muted)] mb-3">
                      Scheduled work — email digests, backups, sync jobs.
                    </div>
                    {!isMaster && (
                      <Link
                        href={`/${slug}/cron/new`}
                        className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-medium inline-block"
                      >
                        + Schedule one
                      </Link>
                    )}
                  </td>
                </tr>
              )}
              {crons.slice(0, 5).map((c) => (
                <tr key={`${c.namespace}/${c.name}`} className="border-t border-[color:var(--color-border)]">
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-[color:var(--color-muted)]">{c.namespace}</td>
                  <td className="p-3 font-mono text-xs">{c.schedule}</td>
                  <td className="p-3 text-[color:var(--color-muted)]">
                    {c.lastSuccessfulTime
                      ? new Date(c.lastSuccessfulTime).toLocaleString()
                      : "never"}
                  </td>
                </tr>
              ))}
              {crons.length > 5 && (
                <tr className="border-t border-[color:var(--color-border)]">
                  <td colSpan={4} className="p-3 text-center text-xs text-[color:var(--color-muted)]">
                    <Link href={`/${slug}/cron`} className="hover:text-[color:var(--color-fg)]">
                      + {crons.length - 5} more →
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
