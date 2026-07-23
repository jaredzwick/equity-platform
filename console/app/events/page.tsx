export const dynamic = "force-dynamic";

// NATS JetStream events surface — placeholder.
//
// Data sources (to wire up):
//   1. NATS monitoring HTTP endpoint (http://nats.nats.svc:8222/jsz?streams=1)
//      returns stream stats: messages, bytes, consumers, first_seq, last_seq
//   2. Per-consumer lag: num_pending, num_ack_pending, num_redelivered
//   3. `nats` CLI or the JS client (`nats.js`) for live stream browsing
//
// Metrics to show:
//   - Streams table: name, subject prefix, messages, bytes, first/last seq
//   - Consumers table: name, stream, pending, ack-pending, redelivered
//   - Recent events per subject prefix (last 100 messages, browse mode)
//   - Publish rate / consume rate (from Prometheus if prom-nats-exporter enabled)

export default async function EventsPage() {
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold mb-2">Events</h1>
      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        NATS JetStream streams, consumers, and recent messages.
      </p>

      <div className="p-4 border border-amber-900 rounded bg-amber-950/40 text-sm">
        <div className="font-semibold text-amber-400 mb-1">Not connected</div>
        <div className="text-neutral-400">
          NATS monitoring endpoint not yet wired. See the source of this file for the plan.
        </div>
      </div>
    </div>
  );
}
