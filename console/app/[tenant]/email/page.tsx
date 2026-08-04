import { resolveTenant } from "@/lib/tenants";
import { notFound } from "next/navigation";
import {
  ensureTenantEmailDb,
  getEmailStats,
  isEmailDbConfigured,
  listRecentEmailEvents,
  tenantDbName,
  type EmailEvent,
  type EmailStats,
} from "@/lib/email-db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tenant: string }> };

export default async function EmailPage({ params }: Props) {
  const { tenant: slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  if (!isEmailDbConfigured()) {
    return (
      <div className="max-w-6xl">
        <NotConfigured
          heading="Email DB not configured"
          body={
            <>
              Set <code>EMAIL_DB_BASE_URL</code> in <code>console/.env.local</code> — one Postgres
              URL covers every tenant. The console derives per-tenant DBs (
              <code>equity_email_{"<slug>"}</code>) and creates them on demand.
            </>
          }
        />
      </div>
    );
  }

  let stats: EmailStats | null = null;
  let events: EmailEvent[] = [];
  let dbErr: string | null = null;

  try {
    await ensureTenantEmailDb(slug);
    [stats, events] = await Promise.all([
      getEmailStats(slug, 30),
      listRecentEmailEvents(slug, 25),
    ]);
  } catch (e) {
    dbErr = e instanceof Error ? e.message : String(e);
  }

  const dbName = tenantDbName(slug);
  const empty = !dbErr && (stats?.totalEvents ?? 0) === 0;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="text-xs text-[color:var(--color-muted)]">
        Deliverability for <span className="text-[color:var(--color-fg)]">{tenant.name}</span> ·
        DB <code className="text-[color:var(--color-fg)]">{dbName}</code> ·
        window last 30 days
      </div>

      {dbErr && (
        <div className="p-4 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          <div className="font-semibold mb-1">DB error</div>
          <pre className="whitespace-pre-wrap text-xs">{dbErr}</pre>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Sent"       value={stats.byType["email.sent"] ?? stats.byType["sent"] ?? 0} />
          <StatCard label="Delivered"  value={stats.byType["email.delivered"] ?? stats.byType["delivered"] ?? 0}
                    sub={fmtPct(stats.deliveryRate)} />
          <StatCard label="Opened"     value={stats.byType["email.opened"] ?? stats.byType["opened"] ?? 0}
                    sub={fmtPct(stats.openRate)} />
          <StatCard label="Clicked"    value={stats.byType["email.clicked"] ?? stats.byType["clicked"] ?? 0}
                    sub={fmtPct(stats.clickRate)} />
          <StatCard label="Bounced"    value={stats.byType["email.bounced"] ?? stats.byType["bounced"] ?? 0}
                    sub={fmtPct(stats.bounceRate)} danger />
          <StatCard label="Complained" value={stats.byType["email.complained"] ?? stats.byType["complained"] ?? 0}
                    sub={fmtPct(stats.complaintRate)} danger />
        </div>
      )}

      {empty && (
        <div className="p-6 border border-[color:var(--color-border)] rounded-lg bg-white/[0.02] text-sm">
          <div className="font-semibold mb-1">No events yet</div>
          <div className="text-[color:var(--color-muted)] mb-3">
            The platform uses ONE Resend webhook for every business —{" "}
            <code className="text-[color:var(--color-fg)]">https://&lt;host&gt;/api/webhooks/resend</code>.
            Events route to this business because outbound emails carry a{" "}
            <code>tenant</code> tag. Use <code>lib/resend-send.ts</code> —
            it adds the tag for you.
          </div>
          <div className="text-xs text-[color:var(--color-muted)]">
            Events land in <code className="text-[color:var(--color-fg)]">{dbName}.email_events</code>{" "}
            (auto-created on first request).
          </div>
        </div>
      )}

      {events.length > 0 && (
        <div className="border border-[color:var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2 text-xs text-[color:var(--color-muted)] border-b border-[color:var(--color-border)]">
            Recent events
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-[color:var(--color-muted)]">
              <tr>
                <th className="text-left px-4 py-2 font-normal">Time</th>
                <th className="text-left px-4 py-2 font-normal">Event</th>
                <th className="text-left px-4 py-2 font-normal">To</th>
                <th className="text-left px-4 py-2 font-normal">Subject</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-[color:var(--color-border)]">
                  <td className="px-4 py-2 text-xs text-[color:var(--color-muted)] font-mono">
                    {new Date(e.created_at).toISOString().replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-2">
                    <span className={eventClass(e.event_type)}>{e.event_type}</span>
                  </td>
                  <td className="px-4 py-2 truncate max-w-[220px]">{e.to_addr}</td>
                  <td className="px-4 py-2 truncate max-w-[300px]">{e.subject ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, sub, danger,
}: { label: string; value: number; sub?: string; danger?: boolean }) {
  return (
    <div className="p-3 border border-[color:var(--color-border)] rounded-lg bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</div>
      <div className={"text-xl font-semibold mt-0.5 " + (danger ? "text-amber-300" : "")}>{value}</div>
      {sub && <div className="text-[11px] text-[color:var(--color-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

function NotConfigured({ heading, body }: { heading: string; body: React.ReactNode }) {
  return (
    <div className="p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
      <div className="font-semibold text-amber-200 mb-1">{heading}</div>
      <div className="text-neutral-300">{body}</div>
    </div>
  );
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function eventClass(type: string): string {
  if (type.includes("bounced") || type.includes("complained") || type.includes("failed")) {
    return "text-amber-300";
  }
  if (type.includes("clicked") || type.includes("opened")) return "text-emerald-300";
  return "text-[color:var(--color-fg)]";
}
