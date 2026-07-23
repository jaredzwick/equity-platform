import Link from "next/link";
import { listCronJobs } from "@/lib/k8s";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tenant: string }> };

function relative(ts: string | null): string {
  if (!ts) return "never";
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function staleness(row: { lastSuccessfulTime: string | null; suspend: boolean }): "ok" | "stale" | "never" | "suspended" {
  if (row.suspend) return "suspended";
  if (!row.lastSuccessfulTime) return "never";
  return Date.now() - new Date(row.lastSuccessfulTime).getTime() > 24 * 60 * 60 * 1000 ? "stale" : "ok";
}

export default async function CronPage({ params }: Props) {
  const { tenant: slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const nsFilter = slug === MASTER_SLUG ? undefined : tenant.namespaces;
  const rows = (await listCronJobs(nsFilter).catch(() => [])).sort((a, b) => a.name.localeCompare(b.name));

  const isMaster = slug === MASTER_SLUG;

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-sm text-[color:var(--color-muted)]">
          {rows.length} cronjob{rows.length === 1 ? "" : "s"} · red dot = no successful run in 24h
        </div>
        {!isMaster && (
          <Link
            href={`/${slug}/cron/new`}
            className="text-sm px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-medium"
          >
            + New CronJob
          </Link>
        )}
      </div>

      <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
              <th className="p-3">Status</th>
              <th className="p-3">Namespace</th>
              <th className="p-3">Name</th>
              <th className="p-3">Schedule</th>
              <th className="p-3">Last success</th>
              <th className="p-3">Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[color:var(--color-muted)]">
                  No CronJobs.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const s = staleness(r);
              const color =
                s === "ok" ? "bg-emerald-500" :
                s === "stale" ? "bg-red-500" :
                s === "never" ? "bg-neutral-500" :
                "bg-amber-500";
              return (
                <tr key={`${r.namespace}/${r.name}`} className="border-t border-[color:var(--color-border)]">
                  <td className="p-3"><span className={`inline-block w-2 h-2 rounded-full ${color}`} title={s} /></td>
                  <td className="p-3 text-[color:var(--color-muted)]">{r.namespace}</td>
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-3 font-mono text-xs">{r.schedule}</td>
                  <td className="p-3 text-[color:var(--color-muted)]">{relative(r.lastSuccessfulTime)}</td>
                  <td className="p-3">{r.activeCount > 0 ? <span className="text-amber-400">{r.activeCount}</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
