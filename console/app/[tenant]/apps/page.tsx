import Link from "next/link";
import { listArgoApps } from "@/lib/k8s";
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
  return <span className={`inline-block px-2 py-0.5 rounded text-xs border ${color}`}>{status ?? "unknown"}</span>;
}

export default async function AppsPage({ params }: Props) {
  const { tenant: slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const isMaster = slug === MASTER_SLUG;
  const nsFilter = isMaster ? undefined : tenant.namespaces;
  const apps = await listArgoApps(nsFilter).catch(() => []);

  return (
    <div className="max-w-6xl">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-sm text-[color:var(--color-muted)]">
          {apps.length} application{apps.length === 1 ? "" : "s"} · GitOps-managed by ArgoCD
        </div>
        {!isMaster && (
          <Link
            href={`/${slug}/apps/new`}
            className="text-sm px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-medium"
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
              <th className="p-3">Revision</th>
            </tr>
          </thead>
          <tbody>
            {apps.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-[color:var(--color-muted)]">
                  {isMaster
                    ? "No ArgoCD Applications yet."
                    : (
                      <>
                        No apps in {tenant.name}.{" "}
                        <Link href={`/${slug}/apps/new`} className="text-emerald-400 hover:underline">
                          Provision one →
                        </Link>
                      </>
                    )
                  }
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
                  <td className="p-3 text-[color:var(--color-muted)] font-mono text-xs">
                    {a.status?.sync?.revision?.slice(0, 7) ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
