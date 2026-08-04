// Per-tenant email deliverability DB — auto-provisioned.
//
// Design goal: zero manual per-customer configuration. The operator sets
// ONE env var (EMAIL_DB_BASE_URL) pointing at a Postgres server; the console
// derives per-tenant DB names + creates the DB + schema on demand.
//
// Escape hatch: EMAIL_DB_URL_<SLUG> (full URL) overrides the derived URL for
// tenants that need isolated storage.

import "server-only";
import postgres from "postgres";

// ─── URL resolution ───────────────────────────────────────────────────────

/**
 * Resolve the effective Postgres URL for a tenant's email events. Precedence:
 *   1. EMAIL_DB_URL_<SLUG_UPPER> — full URL override, escape hatch for
 *      tenants with dedicated Postgres instances.
 *   2. EMAIL_DB_BASE_URL + auto-derived DB name (equity_email_<slug>).
 *   3. null — email dashboard unavailable.
 *
 * Returned URL always includes a database name.
 */
export function resolveEmailDbUrl(slug: string): string | null {
  const override = process.env[`EMAIL_DB_URL_${slug.toUpperCase()}`];
  if (override) return override;
  const base = process.env.EMAIL_DB_BASE_URL;
  if (!base) return null;
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/${tenantDbName(slug)}`;
}

/** Deterministic per-tenant DB name derived from slug. */
export function tenantDbName(slug: string): string {
  // Postgres identifiers: lowercase, must start with letter/underscore, ≤63 chars.
  // Our slug validator already restricts to [a-z0-9][-a-z0-9]* so we just swap
  // dashes for underscores and prefix.
  return `equity_email_${slug.replace(/-/g, "_")}`;
}

/** Admin URL — same server as EMAIL_DB_BASE_URL but connects to the built-in
 * `postgres` database so we can CREATE DATABASE for tenants. Not used when
 * a tenant has an override URL (we assume the DB is already provisioned). */
function adminUrl(): string | null {
  const base = process.env.EMAIL_DB_BASE_URL;
  if (!base) return null;
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/postgres`;
}

// ─── Connection pool cache ───────────────────────────────────────────────

// One pool per tenant DB, reused across requests. postgres.js already
// handles connection pooling internally — this Map just avoids re-parsing
// the URL + allocating a new pool per request.
const pools = new Map<string, postgres.Sql>();

function poolFor(url: string): postgres.Sql {
  const cached = pools.get(url);
  if (cached) return cached;
  const sql = postgres(url, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 5,
    onnotice: () => {}, // silence NOTICE-level chatter (e.g., "database already exists")
  });
  pools.set(url, sql);
  return sql;
}

// ─── Auto-provisioning ────────────────────────────────────────────────────

const provisioned = new Set<string>();

/**
 * Ensure the tenant's Postgres database + email_events table exist. Called
 * lazily on first email-tab load and eagerly on tenant creation. Idempotent
 * and cheap after the first call (in-memory set skips repeat work).
 *
 * Returns the tenant's DB URL if provisioning succeeded (or was already
 * done), or throws with a clear message otherwise. When EMAIL_DB_BASE_URL
 * is unset, returns null — the caller should surface "Not configured".
 */
export async function ensureTenantEmailDb(slug: string): Promise<string | null> {
  const url = resolveEmailDbUrl(slug);
  if (!url) return null;
  if (provisioned.has(url)) return url;

  const dbName = tenantDbName(slug);

  // Only auto-CREATE DATABASE when we're using the derived path (base URL).
  // Overrides are assumed to be pre-provisioned by whoever set them.
  const override = process.env[`EMAIL_DB_URL_${slug.toUpperCase()}`];
  if (!override) {
    const admin = adminUrl();
    if (admin) {
      const adminSql = poolFor(admin);
      try {
        // CREATE DATABASE can't run inside a transaction, so a raw unsafe
        // call is the simplest path. Guarded by identifier validation
        // (dbName is derived from a slug we validated on tenant creation).
        const rows = await adminSql`
          SELECT 1 FROM pg_database WHERE datname = ${dbName} LIMIT 1
        `;
        if (rows.length === 0) {
          await adminSql.unsafe(`CREATE DATABASE "${dbName}"`);
        }
      } catch (e) {
        throw new Error(
          `ensureTenantEmailDb: could not create database "${dbName}" via admin URL — ${errMsg(e)}`,
        );
      }
    }
  }

  // Create the schema. Safe to run every time (IF NOT EXISTS everywhere).
  const sql = poolFor(url);
  try {
    await sql.unsafe(SCHEMA_SQL);
  } catch (e) {
    throw new Error(`ensureTenantEmailDb: schema init failed for ${dbName} — ${errMsg(e)}`);
  }

  provisioned.add(url);
  return url;
}

// Schema: one event per Resend webhook delivery. Denormalized (to/from/etc.
// captured at send time) so the dashboard doesn't need joins to render.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS email_events (
  id           BIGSERIAL PRIMARY KEY,
  event_type   TEXT NOT NULL,
  email_id     TEXT NOT NULL,
  to_addr      TEXT NOT NULL,
  from_addr    TEXT NOT NULL,
  subject      TEXT,
  template_id  TEXT,
  metadata     JSONB DEFAULT '{}'::JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_events_created_idx ON email_events (created_at DESC);
CREATE INDEX IF NOT EXISTS email_events_email_id_idx ON email_events (email_id);
CREATE INDEX IF NOT EXISTS email_events_type_idx ON email_events (event_type);
`;

// ─── Query helpers (for the dashboard) ───────────────────────────────────

export type EmailStats = {
  windowDays: number;
  totalEvents: number;
  byType: Record<string, number>;
  // Deliverability rates computed from event counts within the window.
  deliveryRate: number | null; // delivered / sent
  openRate: number | null;     // opened / delivered
  clickRate: number | null;    // clicked / delivered
  bounceRate: number | null;   // bounced / sent
  complaintRate: number | null; // complained / delivered
};

export type EmailEvent = {
  id: number;
  event_type: string;
  email_id: string;
  to_addr: string;
  from_addr: string;
  subject: string | null;
  template_id: string | null;
  created_at: Date;
};

/** Aggregate stats for the last N days. Zero-alloc if the table is empty. */
export async function getEmailStats(slug: string, windowDays = 30): Promise<EmailStats | null> {
  const url = await ensureTenantEmailDb(slug);
  if (!url) return null;
  const sql = poolFor(url);
  const rows = await sql<{ event_type: string; c: string }[]>`
    SELECT event_type, COUNT(*)::text AS c
    FROM email_events
    WHERE created_at >= NOW() - (${windowDays} || ' days')::interval
    GROUP BY event_type
  `;
  const byType: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const n = Number(r.c);
    byType[r.event_type] = n;
    total += n;
  }
  const sent = byType["email.sent"] ?? byType["sent"] ?? 0;
  const delivered = byType["email.delivered"] ?? byType["delivered"] ?? 0;
  const opened = byType["email.opened"] ?? byType["opened"] ?? 0;
  const clicked = byType["email.clicked"] ?? byType["clicked"] ?? 0;
  const bounced = byType["email.bounced"] ?? byType["bounced"] ?? 0;
  const complained = byType["email.complained"] ?? byType["complained"] ?? 0;
  return {
    windowDays,
    totalEvents: total,
    byType,
    deliveryRate: sent > 0 ? delivered / sent : null,
    openRate: delivered > 0 ? opened / delivered : null,
    clickRate: delivered > 0 ? clicked / delivered : null,
    bounceRate: sent > 0 ? bounced / sent : null,
    complaintRate: delivered > 0 ? complained / delivered : null,
  };
}

export async function listRecentEmailEvents(slug: string, limit = 25): Promise<EmailEvent[]> {
  const url = await ensureTenantEmailDb(slug);
  if (!url) return [];
  const sql = poolFor(url);
  const rows = await sql<EmailEvent[]>`
    SELECT id, event_type, email_id, to_addr, from_addr, subject, template_id, created_at
    FROM email_events
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

// ─── Webhook insert (used by /api/webhooks/resend/[tenant]) ──────────────

export type EmailEventInput = {
  event_type: string;
  email_id: string;
  to_addr: string;
  from_addr: string;
  subject?: string | null;
  template_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at?: Date;
};

export async function insertEmailEvent(slug: string, ev: EmailEventInput): Promise<void> {
  const url = await ensureTenantEmailDb(slug);
  if (!url) throw new Error(`Email DB not configured for ${slug}`);
  const sql = poolFor(url);
  await sql`
    INSERT INTO email_events
      (event_type, email_id, to_addr, from_addr, subject, template_id, metadata, created_at)
    VALUES
      (${ev.event_type}, ${ev.email_id}, ${ev.to_addr}, ${ev.from_addr},
       ${ev.subject ?? null}, ${ev.template_id ?? null},
       ${sql.json((ev.metadata ?? {}) as postgres.JSONValue)}, ${ev.created_at ?? new Date()})
  `;
}

// ─── Utilities ───────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** True if the platform has an email DB configured at all. */
export function isEmailDbConfigured(): boolean {
  return !!process.env.EMAIL_DB_BASE_URL || Object.keys(process.env).some((k) =>
    k.startsWith("EMAIL_DB_URL_"),
  );
}
