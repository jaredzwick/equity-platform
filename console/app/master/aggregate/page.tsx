import { listArgoApps, listCronJobs } from "@/lib/k8s";
import { fetchNats } from "@/lib/nats";
import { discoverTenants } from "@/lib/tenants";

export const dynamic = "force-dynamic";

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
  return <span className={`inline-block px-2 py-0.5 rounded text-xs border ${color}`}>{status ?? "unknown"}</span>;
}

function relative(ts: string | null): string {
  if (!ts) return "never";
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function tenantOfNamespace(ns: string, byNs: Map<string, string>): string {
  return byNs.get(ns) ?? "platform";
}

export default async function AggregatePage() {
  const tenants = await discoverTenants().catch(() => []);
  const nsToTenant = new Map<string, string>();
  for (const t of tenants) {
    for (const n of t.namespaces) nsToTenant.set(n, t.name);
  }

  const [apps, crons, nats] = await Promise.all([
    listArgoApps().catch(() => []),
    listCronJobs().catch(() => []),
    fetchNats().catch(() => ({ reachable: false, streams: [], error: "unavailable", monitorUrl: "" })),
  ]);

  const staleCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const staleCronCount = crons.filter(
    (c) => !c.suspend && (!c.lastSuccessfulTime || new Date(c.lastSuccessfulTime).getTime() < staleCutoff),
  ).length;
  const unhealthyApps = apps.filter((a) => a.status?.health?.status !== "Healthy").length;
  const streamCount = nats.reachable ? nats.streams.length : 0;
  const eventCount = nats.reachable ? nats.streams.reduce((sum, s) => sum + s.messages, 0) : 0;

  return (
    <div className="max-w-6xl">
      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        Everything running in the cluster — platform infra + every business — one pane.
      </p>

      <section className="grid grid-cols-4 gap-3 mb-8">
        <Stat label="Applications" value={apps.length} sub={unhealthyApps > 0 ? `${unhealthyApps} unhealthy` : "all healthy"} bad={unhealthyApps > 0} />
        <Stat label="CronJobs" value={crons.length} sub={staleCronCount > 0 ? `${staleCronCount} stale` : "all fresh"} bad={staleCronCount > 0} />
        <Stat label="NATS streams" value={streamCount} sub={nats.reachable ? "reachable" : "unreachable"} bad={!nats.reachable} />
        <Stat label="Events (all-time)" value={eventCount.toLocaleString()} sub="across all streams" />
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-medium mb-3">All Applications ({apps.length})</h2>
        <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                <th className="p-3">Name</th>
                <th className="p-3">Tenant</th>
                <th className="p-3">Destination</th>
                <th className="p-3">Sync</th>
                <th className="p-3">Health</th>
                <th className="p-3">Chart</th>
              </tr>
            </thead>
            <tbody>
              {apps.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[color:var(--color-muted)]">
                    No ArgoCD Applications in the cluster.
                  </td>
                </tr>
              )}
              {apps.map((a) => {
                const src = a.spec.sources?.[0] ?? a.spec.source;
                const owner = tenantOfNamespace(a.spec.destination.namespace, nsToTenant);
                return (
                  <tr key={a.metadata.name} className="border-t border-[color:var(--color-border)]">
                    <td className="p-3 font-medium">{a.metadata.name}</td>
                    <td className="p-3 text-xs text-[color:var(--color-muted)]">{owner}</td>
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
        <h2 className="text-lg font-medium mb-3">All CronJobs ({crons.length})</h2>
        <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                <th className="p-3">Status</th>
                <th className="p-3">Name</th>
                <th className="p-3">Tenant</th>
                <th className="p-3">Namespace</th>
                <th className="p-3">Schedule</th>
                <th className="p-3">Last success</th>
              </tr>
            </thead>
            <tbody>
              {crons.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[color:var(--color-muted)]">
                    No CronJobs in the cluster.
                  </td>
                </tr>
              )}
              {crons.map((c) => {
                const stale = !c.suspend && (!c.lastSuccessfulTime || new Date(c.lastSuccessfulTime).getTime() < staleCutoff);
                const color = c.suspend ? "bg-amber-500" : stale ? "bg-red-500" : "bg-emerald-500";
                const owner = tenantOfNamespace(c.namespace, nsToTenant);
                return (
                  <tr key={`${c.namespace}/${c.name}`} className="border-t border-[color:var(--color-border)]">
                    <td className="p-3"><span className={`inline-block w-2 h-2 rounded-full ${color}`} /></td>
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-xs text-[color:var(--color-muted)]">{owner}</td>
                    <td className="p-3 text-[color:var(--color-muted)]">{c.namespace}</td>
                    <td className="p-3 font-mono text-xs">{c.schedule}</td>
                    <td className="p-3 text-[color:var(--color-muted)]">{relative(c.lastSuccessfulTime)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {nats.reachable && nats.streams.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3">NATS streams ({nats.streams.length})</h2>
          <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                  <th className="p-3">Stream</th>
                  <th className="p-3">Subjects</th>
                  <th className="p-3">Messages</th>
                  <th className="p-3">Consumers</th>
                </tr>
              </thead>
              <tbody>
                {nats.streams.map((s) => (
                  <tr key={`${s.account}/${s.name}`} className="border-t border-[color:var(--color-border)]">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 font-mono text-xs">{s.subjects.join(", ") || "—"}</td>
                    <td className="p-3">{s.messages.toLocaleString()}</td>
                    <td className="p-3">{s.consumerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub, bad }: { label: string; value: number | string; sub?: string; bad?: boolean }) {
  return (
    <div className="p-4 border border-[color:var(--color-border)] rounded">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className={`text-xs mt-0.5 ${bad ? "text-red-400" : "text-[color:var(--color-muted)]"}`}>{sub}</div>}
    </div>
  );
}
