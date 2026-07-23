import { listArgoApps } from "@/lib/k8s";

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
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs border ${color}`}>{status ?? "unknown"}</span>
  );
}

export default async function Home() {
  let apps: Awaited<ReturnType<typeof listArgoApps>> = [];
  let err: string | null = null;
  try {
    apps = await listArgoApps();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  const synced = apps.filter((a) => a.status?.sync?.status === "Synced").length;
  const healthy = apps.filter((a) => a.status?.health?.status === "Healthy").length;

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold mb-6">Overview</h1>

      {err && (
        <div className="mb-6 p-4 border border-red-900 rounded bg-red-950/40 text-sm">
          <div className="font-semibold text-red-400 mb-1">Cannot reach Kubernetes API</div>
          <div className="text-neutral-400">{err}</div>
          <div className="mt-2 text-xs text-neutral-500">
            Local dev: check <code className="text-neutral-300">kubectl config current-context</code> — should be
            <code className="text-neutral-300"> kind-equity-local</code>.
          </div>
        </div>
      )}

      <section className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 border border-[color:var(--color-border)] rounded">
          <div className="text-xs text-[color:var(--color-muted)] uppercase">ArgoCD apps</div>
          <div className="text-3xl font-semibold mt-1">{apps.length}</div>
        </div>
        <div className="p-4 border border-[color:var(--color-border)] rounded">
          <div className="text-xs text-[color:var(--color-muted)] uppercase">Synced</div>
          <div className="text-3xl font-semibold mt-1 text-emerald-400">{synced}/{apps.length}</div>
        </div>
        <div className="p-4 border border-[color:var(--color-border)] rounded">
          <div className="text-xs text-[color:var(--color-muted)] uppercase">Healthy</div>
          <div className="text-3xl font-semibold mt-1 text-emerald-400">{healthy}/{apps.length}</div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Applications</h2>
        <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                <th className="p-3">Name</th>
                <th className="p-3">Namespace</th>
                <th className="p-3">Sync</th>
                <th className="p-3">Health</th>
                <th className="p-3">Last op</th>
              </tr>
            </thead>
            <tbody>
              {apps.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[color:var(--color-muted)]">
                    No ArgoCD Applications found.
                  </td>
                </tr>
              )}
              {apps.map((a) => (
                <tr key={a.metadata.name} className="border-t border-[color:var(--color-border)]">
                  <td className="p-3 font-medium">{a.metadata.name}</td>
                  <td className="p-3 text-[color:var(--color-muted)]">{a.spec.destination.namespace}</td>
                  <td className="p-3"><StatusPill status={a.status?.sync?.status} /></td>
                  <td className="p-3"><StatusPill status={a.status?.health?.status} /></td>
                  <td className="p-3 text-[color:var(--color-muted)] text-xs">
                    {a.status?.operationState?.phase ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
