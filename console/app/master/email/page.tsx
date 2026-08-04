import Link from "next/link";
import { discoverTenants, MASTER_SLUG } from "@/lib/tenants";
import { getEmailStats, isEmailDbConfigured, type EmailStats } from "@/lib/email-db";

export const dynamic = "force-dynamic";

type Row = {
  slug: string;
  name: string;
  stats: EmailStats | null;
  error: string | null;
};

export default async function MasterEmailPage() {
  if (!isEmailDbConfigured()) {
    return (
      <div className="max-w-6xl">
        <div className="p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">Email DB not configured</div>
          <div className="text-neutral-300">
            Set <code>EMAIL_DB_BASE_URL</code> in <code>console/.env.local</code>. The console
            will auto-provision per-tenant DBs and this page will roll them up.
          </div>
        </div>
      </div>
    );
  }

  // Enumerate every tenant (skip master itself) and pull 30-day stats in
  // parallel. Failures don't kill the page — surfaced per-row so one broken
  // tenant DB doesn't blank the whole dashboard.
  const tenants = (await discoverTenants().catch(() => [])).filter(
    (t) => t.slug !== MASTER_SLUG,
  );
  const rows: Row[] = await Promise.all(
    tenants.map(async (t) => {
      try {
        const stats = await getEmailStats(t.slug, 30);
        return { slug: t.slug, name: t.name, stats, error: null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { slug: t.slug, name: t.name, stats: null, error: msg };
      }
    }),
  );

  const totals = aggregate(rows);
  const tenantsWithEvents = rows.filter((r) => (r.stats?.totalEvents ?? 0) > 0).length;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="text-sm text-[color:var(--color-muted)]">
        Deliverability across {tenants.length} {tenants.length === 1 ? "business" : "businesses"} ·
        {tenantsWithEvents} sending mail · window last 30 days
      </div>

      <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Sent"       value={totals.sent} />
        <StatCard label="Delivered"  value={totals.delivered} sub={pct(totals.delivered, totals.sent)} />
        <StatCard label="Opened"     value={totals.opened}    sub={pct(totals.opened, totals.delivered)} />
        <StatCard label="Clicked"    value={totals.clicked}   sub={pct(totals.clicked, totals.delivered)} />
        <StatCard label="Bounced"    value={totals.bounced}   sub={pct(totals.bounced, totals.sent)} danger />
        <StatCard label="Complained" value={totals.complained} sub={pct(totals.complained, totals.delivered)} danger />
      </section>

      <section className="border border-[color:var(--color-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-2 text-xs text-[color:var(--color-muted)] border-b border-[color:var(--color-border)]">
          Per-business breakdown
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs text-[color:var(--color-muted)]">
            <tr>
              <th className="text-left px-4 py-2 font-normal">Business</th>
              <th className="text-right px-4 py-2 font-normal">Sent</th>
              <th className="text-right px-4 py-2 font-normal">Delivery</th>
              <th className="text-right px-4 py-2 font-normal">Open</th>
              <th className="text-right px-4 py-2 font-normal">Click</th>
              <th className="text-right px-4 py-2 font-normal">Bounce</th>
              <th className="text-right px-4 py-2 font-normal">Complaint</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-[color:var(--color-muted)] text-xs">
                  No businesses yet. Create one from{" "}
                  <Link href="/master/new" className="text-emerald-400 hover:underline">
                    Master → + New Business
                  </Link>.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const sent = pick(r.stats, "sent");
              const delivered = pick(r.stats, "delivered");
              const opened = pick(r.stats, "opened");
              const clicked = pick(r.stats, "clicked");
              const bounced = pick(r.stats, "bounced");
              const complained = pick(r.stats, "complained");
              return (
                <tr key={r.slug} className="border-t border-[color:var(--color-border)]">
                  <td className="px-4 py-2">
                    <Link
                      href={`/${r.slug}/email`}
                      className="text-emerald-400 hover:underline font-medium"
                    >
                      {r.name}
                    </Link>
                    {r.error && (
                      <div className="text-[10px] text-red-300 mt-0.5 truncate max-w-[280px]" title={r.error}>
                        error: {r.error}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{sent || "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{pct(delivered, sent)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{pct(opened, delivered)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{pct(clicked, delivered)}</td>
                  <td className={"px-4 py-2 text-right tabular-nums " + (bounced > 0 ? "text-amber-300" : "")}>
                    {pct(bounced, sent)}
                  </td>
                  <td className={"px-4 py-2 text-right tabular-nums " + (complained > 0 ? "text-amber-300" : "")}>
                    {pct(complained, delivered)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

type Totals = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
};

function aggregate(rows: Row[]): Totals {
  const t: Totals = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 };
  for (const r of rows) {
    if (!r.stats) continue;
    t.sent       += pick(r.stats, "sent");
    t.delivered  += pick(r.stats, "delivered");
    t.opened     += pick(r.stats, "opened");
    t.clicked    += pick(r.stats, "clicked");
    t.bounced    += pick(r.stats, "bounced");
    t.complained += pick(r.stats, "complained");
  }
  return t;
}

// Resend emits event types with an `email.` prefix; older events may not.
// Read both, then coalesce.
function pick(
  stats: EmailStats | null,
  kind: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained",
): number {
  if (!stats) return 0;
  return (stats.byType[`email.${kind}`] ?? 0) + (stats.byType[kind] ?? 0);
}

function pct(num: number, denom: number): string {
  if (denom <= 0) return "—";
  return `${((num / denom) * 100).toFixed(1)}%`;
}

function StatCard({
  label, value, sub, danger,
}: { label: string; value: number; sub?: string; danger?: boolean }) {
  return (
    <div className="p-3 border border-[color:var(--color-border)] rounded-lg bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</div>
      <div className={"text-xl font-semibold mt-0.5 " + (danger && value > 0 ? "text-amber-300" : "")}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-[color:var(--color-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}
