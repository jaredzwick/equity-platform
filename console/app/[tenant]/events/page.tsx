import { fetchNats, fmtBytes, type NatsAlerts } from "@/lib/nats";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { notFound } from "next/navigation";
import { EventsAutoRefresh } from "@/components/EventsAutoRefresh";
import { StreamRow } from "@/components/StreamRow";
import { EnsureStreamButton } from "@/components/EnsureStreamButton";

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
      <EventsAutoRefresh intervalMs={5000} />

      {!snap.reachable && (
        <div className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">NATS monitoring unreachable</div>
          <div className="text-neutral-400 mb-3">{snap.error}</div>
          <div className="text-xs text-neutral-500">
            Local:{" "}
            <code className="text-neutral-300">
              kubectl port-forward -n nats svc/nats-headless 8222:8222
            </code>
          </div>
        </div>
      )}

      {snap.reachable && <AlertBanner alerts={snap.alerts} />}

      {snap.reachable && snap.overview && (
        <section className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Tile label="Streams" value={snap.overview.streams.toLocaleString()} />
            <Tile label="Consumers" value={snap.overview.consumers.toLocaleString()} />
            <Tile label="Messages" value={snap.overview.messages.toLocaleString()} />
            <Tile label="Bytes" value={fmtBytes(snap.overview.bytes)} />
            <Tile label="Memory" value={fmtBytes(snap.overview.memory)} />
            <Tile label="Storage" value={fmtBytes(snap.overview.storage)} />
          </div>
        </section>
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
                  <EmptyState isMaster={isMaster} slug={slug} subjectPrefix={subjectPrefix} />
                )}
                {filteredStreams.map((s) => (
                  <StreamRow key={`${s.account}/${s.name}`} stream={s} />
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
                    <tr
                      key={`${s.name}/${c.name}`}
                      className="border-t border-[color:var(--color-border)]"
                    >
                      <td className="p-3 text-[color:var(--color-muted)]">{s.name}</td>
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">
                        {c.numPending > 0 ? (
                          <span className="text-amber-400">{c.numPending.toLocaleString()}</span>
                        ) : (
                          c.numPending
                        )}
                      </td>
                      <td className="p-3">{c.numAckPending}</td>
                      <td className="p-3">
                        {c.numRedelivered > 0 ? (
                          <span className="text-red-400">{c.numRedelivered}</span>
                        ) : (
                          c.numRedelivered
                        )}
                      </td>
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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[color:var(--color-border)] rounded p-3">
      <div className="text-xs uppercase text-[color:var(--color-muted)]">{label}</div>
      <div className="mt-1 text-lg font-medium">{value}</div>
    </div>
  );
}

function AlertBanner({ alerts }: { alerts: NatsAlerts }) {
  const total = alerts.redelivered.length + alerts.pending.length;
  if (total === 0) return null;
  return (
    <div className="mb-6 p-4 border border-red-500/40 rounded-lg bg-red-950/60 text-sm">
      <div className="font-semibold text-red-200 mb-2">
        {total} consumer{total === 1 ? "" : "s"} unhealthy
      </div>
      {alerts.redelivered.length > 0 && (
        <div className="mb-1 text-neutral-300">
          <span className="text-red-300">Redelivered &gt; 0:</span>{" "}
          {alerts.redelivered
            .map((a) => `${a.stream}/${a.consumer} (${a.count})`)
            .join(", ")}
        </div>
      )}
      {alerts.pending.length > 0 && (
        <div className="text-neutral-300">
          <span className="text-red-300">Pending &gt; 100:</span>{" "}
          {alerts.pending.map((a) => `${a.stream}/${a.consumer} (${a.count})`).join(", ")}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  isMaster,
  slug,
  subjectPrefix,
}: {
  isMaster: boolean;
  slug: string;
  subjectPrefix: string;
}) {
  return (
    <tr>
      <td colSpan={5} className="p-6 text-center text-[color:var(--color-muted)]">
        {isMaster ? (
          "No streams yet."
        ) : (
          <div className="space-y-3">
            <div>No streams matching {subjectPrefix}&gt;</div>
            <EnsureStreamButton slug={slug} />
          </div>
        )}
      </td>
    </tr>
  );
}

