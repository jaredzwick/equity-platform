import { listCronJobs } from "@/lib/k8s";

export const dynamic = "force-dynamic";

function relative(ts: string | null): string {
  if (!ts) return "never";
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

// A CronJob is "stale" if its last successful run is older than 2x its schedule
// interval. This is a rough heuristic — good enough to spot obviously broken jobs.
function staleness(row: {
  schedule: string;
  lastSuccessfulTime: string | null;
  suspend: boolean;
}): "ok" | "stale" | "never" | "suspended" {
  if (row.suspend) return "suspended";
  if (!row.lastSuccessfulTime) return "never";
  // We don't parse cron here — just flag anything >24h old as stale for now.
  // Future: parse `row.schedule` (e.g. via cronstrue or a real cron parser)
  // and compare against the actual interval * 2.
  const ageMs = Date.now() - new Date(row.lastSuccessfulTime).getTime();
  return ageMs > 24 * 60 * 60 * 1000 ? "stale" : "ok";
}

export default async function CronPage() {
  let rows: Awaited<ReturnType<typeof listCronJobs>> = [];
  let err: string | null = null;
  try {
    rows = await listCronJobs();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold mb-2">Cron</h1>
      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        Every CronJob across every namespace. Red = stale (no successful run in 24h). Yellow = suspended.
      </p>

      {err && (
        <div className="mb-6 p-4 border border-red-900 rounded bg-red-950/40 text-sm text-red-400">
          {err}
        </div>
      )}

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
                  No CronJobs in the cluster.
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
                  <td className="p-3">
                    <span className={`inline-block w-2 h-2 rounded-full ${color}`} title={s} />
                  </td>
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
