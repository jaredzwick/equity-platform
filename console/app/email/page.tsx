export const dynamic = "force-dynamic";

// Email deliverability MVP — placeholder page.
//
// Data sources (to wire up):
//   1. Resend webhook events written to Postgres `email_events` table:
//      - event_type: sent | delivered | opened | clicked | bounced | complained | dropped
//      - email_id, to, from, subject, template_id, created_at
//   2. Postgres query aggregating rates over rolling 24h / 7d windows.
//
// Metrics to show:
//   - Send volume (24h, 7d)
//   - Delivery rate = delivered / sent
//   - Bounce rate = (hard_bounces + soft_bounces) / sent
//   - Complaint rate = complaints / sent  (danger zone > 0.1%)
//   - Recent failures table: last 20 bounces/complaints with recipient + reason
//
// Enable this page:
//   1. Point env EMAIL_DB_URL at a Postgres with an email_events table.
//   2. Wire a `/api/webhooks/resend` route to ingest Resend events.
//   3. Uncomment the query in `fetchEmailStats()` below.

async function fetchEmailStats() {
  return {
    connected: false,
    reason: "EMAIL_DB_URL not set — see the source of this file to wire up.",
    sent24h: 0,
    delivered24h: 0,
    bounced24h: 0,
    complained24h: 0,
    recent: [] as Array<{ to: string; type: string; reason: string; at: string }>,
  };
}

export default async function EmailPage() {
  const stats = await fetchEmailStats();
  const deliveryRate = stats.sent24h > 0 ? ((stats.delivered24h / stats.sent24h) * 100).toFixed(1) : "—";
  const bounceRate = stats.sent24h > 0 ? ((stats.bounced24h / stats.sent24h) * 100).toFixed(1) : "—";
  const complaintRate = stats.sent24h > 0 ? ((stats.complained24h / stats.sent24h) * 100).toFixed(2) : "—";

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold mb-2">Email</h1>
      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        Deliverability, bounces, complaints. Backed by Resend webhook events → Postgres.
      </p>

      {!stats.connected && (
        <div className="mb-6 p-4 border border-amber-900 rounded bg-amber-950/40 text-sm">
          <div className="font-semibold text-amber-400 mb-1">Not connected</div>
          <div className="text-neutral-400">{stats.reason}</div>
        </div>
      )}

      <section className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 border border-[color:var(--color-border)] rounded">
          <div className="text-xs text-[color:var(--color-muted)] uppercase">Sent (24h)</div>
          <div className="text-3xl font-semibold mt-1">{stats.sent24h}</div>
        </div>
        <div className="p-4 border border-[color:var(--color-border)] rounded">
          <div className="text-xs text-[color:var(--color-muted)] uppercase">Delivery rate</div>
          <div className="text-3xl font-semibold mt-1 text-emerald-400">{deliveryRate}{stats.sent24h > 0 ? "%" : ""}</div>
        </div>
        <div className="p-4 border border-[color:var(--color-border)] rounded">
          <div className="text-xs text-[color:var(--color-muted)] uppercase">Bounce rate</div>
          <div className="text-3xl font-semibold mt-1">{bounceRate}{stats.sent24h > 0 ? "%" : ""}</div>
        </div>
        <div className="p-4 border border-[color:var(--color-border)] rounded">
          <div className="text-xs text-[color:var(--color-muted)] uppercase">Complaint rate</div>
          <div className="text-3xl font-semibold mt-1">{complaintRate}{stats.sent24h > 0 ? "%" : ""}</div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-3">Recent failures</h2>
        <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                <th className="p-3">When</th>
                <th className="p-3">Type</th>
                <th className="p-3">To</th>
                <th className="p-3">Reason</th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-[color:var(--color-muted)]">
                    No email events yet.
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
