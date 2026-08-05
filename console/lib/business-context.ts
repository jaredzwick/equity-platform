// Fresh per-tenant cluster context, injected into every chat turn's system
// prompt so the model always sees live state.

import { listArgoApps, listCronJobs } from "@/lib/k8s";
import { fetchNats } from "@/lib/nats";
import { resolveTenant } from "@/lib/tenants";
import { buildEventsContext } from "@/lib/business-context-events";

export async function buildBusinessContext(tenantSlug: string): Promise<string> {
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return `Unknown tenant: ${tenantSlug}`;

  const [apps, crons, nats, eventsBlurb] = await Promise.all([
    listArgoApps(tenant.namespaces).catch(() => []),
    listCronJobs(tenant.namespaces).catch(() => []),
    fetchNats(),
    buildEventsContext(tenantSlug).catch((e) => `## Event bus\n(context error: ${e instanceof Error ? e.message : String(e)})\n`),
  ]);

  const staleCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const staleCrons = crons.filter(
    (c) => !c.suspend && (!c.lastSuccessfulTime || new Date(c.lastSuccessfulTime).getTime() < staleCutoff),
  );
  const unhealthyApps = apps.filter((a) => a.status?.health?.status !== "Healthy");

  const lines: string[] = [];
  lines.push(`# Business: ${tenant.name} (slug: ${tenant.slug})`);
  lines.push(`Namespaces: ${tenant.namespaces.join(", ") || "(none)"}`);
  lines.push("");

  lines.push(`## ArgoCD Applications (${apps.length})`);
  if (apps.length === 0) {
    lines.push("(none deployed)");
  } else {
    for (const a of apps) {
      const src = a.spec.sources?.[0] ?? a.spec.source;
      lines.push(
        `- ${a.metadata.name} → ns=${a.spec.destination.namespace} ` +
          `sync=${a.status?.sync?.status ?? "?"} ` +
          `health=${a.status?.health?.status ?? "?"} ` +
          `chart=${src?.chart ?? "-"}@${src?.targetRevision ?? "-"}`,
      );
    }
  }
  if (unhealthyApps.length > 0) {
    lines.push(`⚠️ ${unhealthyApps.length} unhealthy: ${unhealthyApps.map((a) => a.metadata.name).join(", ")}`);
  }
  lines.push("");

  lines.push(`## CronJobs (${crons.length})`);
  if (crons.length === 0) {
    lines.push("(none)");
  } else {
    for (const c of crons.slice(0, 30)) {
      lines.push(
        `- ${c.namespace}/${c.name} — "${c.schedule}" ` +
          `${c.suspend ? "[SUSPENDED] " : ""}` +
          `last-success=${c.lastSuccessfulTime ?? "never"} active=${c.activeCount}`,
      );
    }
    if (crons.length > 30) lines.push(`… (+${crons.length - 30} more)`);
  }
  if (staleCrons.length > 0) {
    lines.push(`⚠️ ${staleCrons.length} stale (no success in 24h): ${staleCrons.slice(0, 5).map((c) => c.name).join(", ")}`);
  }
  lines.push("");

  lines.push(`## NATS JetStream`);
  if (!nats.reachable) {
    lines.push(`unreachable (${nats.error})`);
  } else if (nats.streams.length === 0) {
    lines.push("reachable, no streams");
  } else {
    lines.push(`${nats.streams.length} stream(s), ${nats.overview?.messages ?? 0} total messages`);
    for (const s of nats.streams.slice(0, 10)) {
      lines.push(
        `- ${s.name}: ${s.messages} msgs, ${s.consumerCount} consumer(s)` +
          (s.consumers.some((c) => c.numPending > 0)
            ? ` (⚠️ pending on: ${s.consumers.filter((c) => c.numPending > 0).map((c) => `${c.name}=${c.numPending}`).join(", ")})`
            : ""),
      );
    }
  }
  lines.push("");

  lines.push(eventsBlurb);

  lines.push(`_Snapshot captured at ${new Date().toISOString()}._`);

  return lines.join("\n");
}
