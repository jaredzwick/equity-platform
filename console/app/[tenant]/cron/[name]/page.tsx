import Link from "next/link";
import { notFound } from "next/navigation";
import { getCronJob, listCronJobRuns, type CronRun } from "@/lib/k8s";
import { peekStream } from "@/lib/nats-peek";
import { streamNameFor } from "@/lib/nats-streams";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import RunDetails from "./RunDetails";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tenant: string; name: string }> };

function relative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function fmtDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function statusBadge(status: CronRun["status"]) {
  const color =
    status === "succeeded" ? "text-emerald-400 bg-emerald-950/40 border-emerald-900" :
    status === "failed"    ? "text-red-400 bg-red-950/40 border-red-900" :
    status === "running"   ? "text-amber-400 bg-amber-950/40 border-amber-900" :
                             "text-neutral-400 bg-neutral-950/40 border-neutral-800";
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded ${color}`}>
      {status}
    </span>
  );
}

type RunnerEvent = {
  seq: number;
  ts: string;
  cronName: string;
  exitCode: number;
  durationMs: number;
  summary: string;
};

// Pulls the last N events on events.<tenant>.cron.completed and filters
// by cronName. Runner publishes envelopes shaped like:
//   { data: { cronName, exitCode, durationMs, summary, ... } }
async function fetchRunnerEvents(tenantSlug: string, cronName: string): Promise<RunnerEvent[]> {
  const streamName = streamNameFor(tenantSlug);
  const peek = await peekStream(streamName, 50).catch(() => ({ ok: false, messages: [] as unknown[] }));
  if (!peek.ok || !("messages" in peek)) return [];
  type Envelope = { ts?: string; data?: { cronName?: string; exitCode?: number; durationMs?: number; summary?: string } };
  const out: RunnerEvent[] = [];
  for (const m of peek.messages as Array<{ seq: number; subject: string; timestamp: string; payload: unknown }>) {
    if (!m.subject.endsWith(".cron.completed")) continue;
    const env = m.payload as Envelope;
    if (env?.data?.cronName !== cronName) continue;
    out.push({
      seq: m.seq,
      ts: env.ts ?? m.timestamp,
      cronName,
      exitCode: env.data.exitCode ?? -1,
      durationMs: env.data.durationMs ?? 0,
      summary: env.data.summary ?? "",
    });
  }
  return out;
}

export default async function CronDetailPage({ params }: Props) {
  const { tenant: slug, name } = await params;
  if (slug === MASTER_SLUG) notFound();

  const tenant = await resolveTenant(slug);
  if (!tenant || tenant.namespaces.length === 0) notFound();

  // The cron might live in any of the tenant's namespaces. Try each until
  // we find it. Cheap — most tenants only have one namespace today.
  let cronjob = null;
  let namespace = "";
  for (const ns of tenant.namespaces) {
    const cj = await getCronJob(ns, name);
    if (cj) {
      cronjob = cj;
      namespace = ns;
      break;
    }
  }
  if (!cronjob) notFound();

  const [runs, runnerEvents] = await Promise.all([
    listCronJobRuns(namespace, name, 20).catch(() => []),
    cronjob.isRunner ? fetchRunnerEvents(slug, name) : Promise.resolve([]),
  ]);

  // Join runs with runner events by start time (closest match within 60s).
  // Not perfect — a proper correlation ID would need to be threaded through
  // — but good enough while runs and events are both roughly chronological.
  const eventForRun = (run: CronRun): RunnerEvent | undefined => {
    if (!run.startedAt) return undefined;
    const runStart = new Date(run.startedAt).getTime();
    let best: { ev: RunnerEvent; delta: number } | null = null;
    for (const ev of runnerEvents) {
      const delta = Math.abs(new Date(ev.ts).getTime() - runStart);
      if (delta > 5 * 60_000) continue; // 5-min window
      if (!best || delta < best.delta) best = { ev, delta };
    }
    return best?.ev;
  };

  return (
    <div className="max-w-6xl">
      <Link
        href={`/${slug}/cron`}
        className="inline-flex items-center gap-1 text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] mb-4"
      >
        ← Crons
      </Link>

      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-2">
          <h1 className="text-lg font-semibold">{cronjob.name}</h1>
          {cronjob.isRunner && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-emerald-800 bg-emerald-950/40 text-emerald-300">
              AI runner
            </span>
          )}
          {cronjob.suspend && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-amber-800 bg-amber-950/40 text-amber-300">
              suspended
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <div className="text-[color:var(--color-muted)] uppercase tracking-wider text-[10px]">Namespace</div>
            <div className="font-mono">{namespace}</div>
          </div>
          <div>
            <div className="text-[color:var(--color-muted)] uppercase tracking-wider text-[10px]">Schedule</div>
            <div className="font-mono">{cronjob.schedule}</div>
          </div>
          <div>
            <div className="text-[color:var(--color-muted)] uppercase tracking-wider text-[10px]">Concurrency</div>
            <div>{cronjob.concurrencyPolicy}</div>
          </div>
          <div>
            <div className="text-[color:var(--color-muted)] uppercase tracking-wider text-[10px]">Image</div>
            <div className="font-mono text-[11px] truncate" title={cronjob.image ?? ""}>{cronjob.image ?? "—"}</div>
          </div>
        </div>

        {cronjob.isRunner && cronjob.prompt && (
          <details className="mt-4 border border-[color:var(--color-border)] rounded p-3 bg-white/[0.02]">
            <summary className="text-xs uppercase tracking-wider text-[color:var(--color-muted)] cursor-pointer">
              Prompt
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-[color:var(--color-fg)]">
              {cronjob.prompt}
            </pre>
          </details>
        )}
      </div>

      <div className="mb-3 text-sm text-[color:var(--color-muted)]">
        {runs.length} recent run{runs.length === 1 ? "" : "s"}
        {" · "}
        <span className="text-[11px]">
          k8s keeps ~3 successful + 1 failed by default; pod stdout is only readable while the pod exists
          {cronjob.isRunner ? "; NATS summaries persist longer per stream retention" : ""}.
        </span>
      </div>

      {runs.length === 0 ? (
        <div className="border border-[color:var(--color-border)] rounded p-10 text-center text-sm text-[color:var(--color-muted)]">
          No runs yet. Next fire: whenever <code className="font-mono">{cronjob.schedule}</code> next matches.
        </div>
      ) : (
        <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
                <th className="p-3">Status</th>
                <th className="p-3">Started</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Job</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const ev = eventForRun(run);
                return (
                  <tr key={run.jobName} className="border-t border-[color:var(--color-border)] align-top">
                    <td className="p-3">{statusBadge(run.status)}</td>
                    <td className="p-3">
                      <div>{relative(run.startedAt)}</div>
                      <div className="text-[10px] text-[color:var(--color-muted)]">
                        {run.startedAt ?? ""}
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{fmtDuration(run.durationMs)}</td>
                    <td className="p-3 font-mono text-[11px] text-[color:var(--color-muted)]">{run.jobName}</td>
                    <td className="p-3">
                      <RunDetails
                        namespace={namespace}
                        podName={run.podName}
                        summary={ev?.summary}
                        exitCode={ev?.exitCode}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
