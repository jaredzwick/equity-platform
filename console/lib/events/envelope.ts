import "server-only";

// The event envelope — every event on the bus carries this shape. Non-negotiable
// because it enables replay, cost attribution, audit, and cross-consumer
// correlation. Locked-in decision from the events plan.

export type Actor =
  | { kind: "human"; id: string }                    // e.g. GitHub login, session user
  | { kind: "agent"; name: string; runId?: string }  // AI consumer name + optional run id
  | { kind: "system"; source: string };              // scheduled job, webhook, cron

export type Envelope<T = unknown> = {
  // Unique event id. UUIDv4 today via crypto.randomUUID(); swap for UUIDv7
  // when Node exposes it natively so ids sort by emission time. Used as the
  // JetStream msgID for dedup (default 2m window).
  id: string;

  // Tenant slug — matches equity.io/tenant label. All per-tenant streams
  // filter on this. `null` for cluster-scoped events (e.g., platform.*).
  tenant: string | null;

  // Who caused this event. Human clicks, agent actions, and system triggers
  // are all attributable — required for cost governance and abuse audit.
  actor: Actor;

  // Where the event originated. Free-form service name — "console",
  // "scraper", "webhook.stripe". Used for filtering + debugging.
  source: string;

  // Correlation across a user-facing flow. Same correlationId ties together
  // (a) the initial event, (b) enrichments/reactions, (c) downstream side
  // effects. Missing = a new correlation starts here.
  correlationId: string;

  // ISO-8601 UTC. When the event happened, NOT when it was ingested.
  ts: string;

  // Schema version of the `data` payload. Mirrors the v<n> segment of the
  // subject. Consumers use this to decide "can I handle this or should I
  // skip until we deploy a new consumer version?"
  schemaVersion: number;

  // Domain payload. Consumer-defined.
  data: T;
};

export type NewEnvelopeOpts<T> = {
  tenant: string | null;
  actor: Actor;
  source: string;
  data: T;
  schemaVersion: number;
  correlationId?: string;
  ts?: string;
};

// Factory — fills in id, ts, correlationId when not provided.
export function newEnvelope<T>(opts: NewEnvelopeOpts<T>): Envelope<T> {
  return {
    id: newId(),
    tenant: opts.tenant,
    actor: opts.actor,
    source: opts.source,
    correlationId: opts.correlationId ?? newId(),
    ts: opts.ts ?? new Date().toISOString(),
    schemaVersion: opts.schemaVersion,
    data: opts.data,
  };
}

// crypto.randomUUID is the same in Node 18+ and browser — no dep, ok for
// server-only files. UUIDv4 (not v7): lookup ordering only matters for
// consumers doing manual replay, which is rare.
function newId(): string {
  return crypto.randomUUID();
}
