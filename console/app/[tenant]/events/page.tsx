import { fetchNats, fmtBytes } from "@/lib/nats";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tenant: string }> };

// v0.2: NATS is shared cluster-wide, so master + tenant show the same data.
// v0.3: subject-based filter — tenant's namespace prefix scopes subjects
// (e.g., events.pypes.>, events.hiringfunnel.>).

export default async function EventsPage({ params }: Props) {
  const { tenant: slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const snap = await fetchNats();
  const isMaster = slug === MASTER_SLUG;
  const subjectPrefix = isMaster ? "" : `events.${slug}.`;
  const filteredStreams = isMaster
    ? snap.streams
    : snap.streams.filter((s) => s.subjects.some((sub) => sub.startsWith(subjectPrefix)));

  return (
    <div className="max-w-6xl">
      {!snap.reachable && (
        <div className="mb-6 p-4 border border-amber-900 rounded bg-amber-950/40 text-sm">
          <div className="font-semibold text-amber-400 mb-1">NATS monitoring unreachable</div>
          <div className="text-neutral-400 mb-3">{snap.error}</div>
          <div className="text-xs text-neutral-500">
            Local: <code className="text-neutral-300">kubectl port-forward -n nats svc/nats-headless 8222:8222</code>
          </div>
        </div>
      )}

      {snap.reachable && (
        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-lg font-medium">
              Streams {isMaster ? "" : `matching ${subjectPrefix}>`}
            </h2>
          </div>
          <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                  <th className="p-3">Stream</th>
                  <th className="p-3">Subjects</th>
                  <th className="p-3">Messages</th>
                  <th className="p-3">Bytes</th>
                  <th className="p-3">Consumers</th>
                </tr>
              </thead>
              <tbody>
                {filteredStreams.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-[color:var(--color-muted)]">
                      {isMaster ? "No streams yet." : `No streams matching ${subjectPrefix}>`}
                    </td>
                  </tr>
                )}
                {filteredStreams.map((s) => (
                  <tr key={`${s.account}/${s.name}`} className="border-t border-[color:var(--color-border)]">
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3 font-mono text-xs">{s.subjects.join(", ") || "—"}</td>
                    <td className="p-3">{s.messages.toLocaleString()}</td>
                    <td className="p-3">{fmtBytes(s.bytes)}</td>
                    <td className="p-3">{s.consumerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {snap.reachable && filteredStreams.some((s) => s.consumers.length > 0) && (
        <section>
          <h2 className="text-lg font-medium mb-3">Consumers</h2>
          <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                  <th className="p-3">Stream</th>
                  <th className="p-3">Consumer</th>
                  <th className="p-3">Pending</th>
                  <th className="p-3">Ack-pending</th>
                  <th className="p-3">Redelivered</th>
                </tr>
              </thead>
              <tbody>
                {filteredStreams.flatMap((s) =>
                  s.consumers.map((c) => (
                    <tr key={`${s.name}/${c.name}`} className="border-t border-[color:var(--color-border)]">
                      <td className="p-3 text-[color:var(--color-muted)]">{s.name}</td>
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">{c.numPending > 0 ? <span className="text-amber-400">{c.numPending.toLocaleString()}</span> : c.numPending}</td>
                      <td className="p-3">{c.numAckPending}</td>
                      <td className="p-3">{c.numRedelivered > 0 ? <span className="text-red-400">{c.numRedelivered}</span> : c.numRedelivered}</td>
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
