import { fetchNats, fmtBytes } from "@/lib/nats";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const snap = await fetchNats();

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold mb-2">Events</h1>
      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        NATS JetStream streams and durable consumers. Publish rate + lag are
        computed by the server; per-message browsing lives in the ArgoCD UI (v0.2).
      </p>

      {!snap.reachable && (
        <div className="mb-6 p-4 border border-amber-900 rounded bg-amber-950/40 text-sm">
          <div className="font-semibold text-amber-400 mb-1">NATS monitoring unreachable</div>
          <div className="text-neutral-400 mb-3">{snap.error}</div>
          <div className="text-xs text-neutral-500">
            Tried: <code className="text-neutral-300">{snap.monitorUrl}</code>
            <br />
            Local: <code className="text-neutral-300">kubectl port-forward -n nats svc/nats-headless 8222:8222</code>
            <br />
            In-cluster: <code className="text-neutral-300">NATS_MONITOR_URL=http://nats-headless.nats.svc.cluster.local:8222</code>
          </div>
        </div>
      )}

      {snap.reachable && snap.overview && (
        <section className="grid grid-cols-6 gap-3 mb-8">
          <Stat label="Streams" value={snap.overview.streams} />
          <Stat label="Consumers" value={snap.overview.consumers} />
          <Stat label="Messages" value={snap.overview.messages.toLocaleString()} />
          <Stat label="Bytes" value={fmtBytes(snap.overview.bytes)} />
          <Stat label="Memory" value={fmtBytes(snap.overview.memory)} />
          <Stat label="Storage" value={fmtBytes(snap.overview.storage)} />
        </section>
      )}

      {snap.reachable && (
        <section className="mb-8">
          <h2 className="text-lg font-medium mb-3">Streams</h2>
          <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                  <th className="p-3">Stream</th>
                  <th className="p-3">Subjects</th>
                  <th className="p-3">Messages</th>
                  <th className="p-3">Bytes</th>
                  <th className="p-3">Seq (first→last)</th>
                  <th className="p-3">Consumers</th>
                </tr>
              </thead>
              <tbody>
                {snap.streams.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[color:var(--color-muted)]">
                      No streams yet. Create one with{" "}
                      <code className="text-neutral-300 text-xs">nats stream add</code>.
                    </td>
                  </tr>
                )}
                {snap.streams.map((s) => (
                  <tr key={`${s.account}/${s.name}`} className="border-t border-[color:var(--color-border)]">
                    <td className="p-3 font-medium">
                      <div>{s.name}</div>
                      <div className="text-xs text-[color:var(--color-muted)]">acct: {s.account}</div>
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {s.subjects.length === 0
                        ? <span className="text-[color:var(--color-muted)]">—</span>
                        : s.subjects.join(", ")}
                    </td>
                    <td className="p-3">{s.messages.toLocaleString()}</td>
                    <td className="p-3">{fmtBytes(s.bytes)}</td>
                    <td className="p-3 font-mono text-xs text-[color:var(--color-muted)]">
                      {s.firstSeq}→{s.lastSeq}
                    </td>
                    <td className="p-3">{s.consumerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {snap.reachable && snap.streams.some((s) => s.consumers.length > 0) && (
        <section>
          <h2 className="text-lg font-medium mb-3">Consumers</h2>
          <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                  <th className="p-3">Stream</th>
                  <th className="p-3">Consumer</th>
                  <th className="p-3" title="Messages waiting to be delivered">Pending</th>
                  <th className="p-3" title="Messages delivered awaiting ack">Ack-pending</th>
                  <th className="p-3" title="Messages that were redelivered (retried)">Redelivered</th>
                  <th className="p-3" title="Consumer pull-requests waiting for a message">Waiting</th>
                </tr>
              </thead>
              <tbody>
                {snap.streams.flatMap((s) =>
                  s.consumers.map((c) => (
                    <tr key={`${s.name}/${c.name}`} className="border-t border-[color:var(--color-border)]">
                      <td className="p-3 text-[color:var(--color-muted)]">{s.name}</td>
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">
                        {c.numPending > 0
                          ? <span className="text-amber-400">{c.numPending.toLocaleString()}</span>
                          : c.numPending}
                      </td>
                      <td className="p-3">{c.numAckPending}</td>
                      <td className="p-3">
                        {c.numRedelivered > 0
                          ? <span className="text-red-400">{c.numRedelivered}</span>
                          : c.numRedelivered}
                      </td>
                      <td className="p-3 text-[color:var(--color-muted)]">{c.numWaiting}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 border border-[color:var(--color-border)] rounded">
      <div className="text-[10px] text-[color:var(--color-muted)] uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
