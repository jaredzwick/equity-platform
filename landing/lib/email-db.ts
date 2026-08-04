// KEEP IN SYNC with console/lib/email-db.ts. Two identical copies until we
// extract this to a workspace package — landing needs the same Postgres
// helpers because /api/webhooks/resend lives here (Vercel builds landing/,
// not console/).
//
// Per-tenant email deliverability DB — auto-provisioned. One env var
// (EMAIL_DB_BASE_URL) → tenants get equity_email_<slug> databases + schema
// on demand. No per-tenant config.

import "server-only";
import postgres from "postgres";

export function resolveEmailDbUrl(slug: string): string | null {
  const override = process.env[`EMAIL_DB_URL_${slug.toUpperCase()}`];
  if (override) return override;
  const base = process.env.EMAIL_DB_BASE_URL;
  if (!base) return null;
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/${tenantDbName(slug)}`;
}

export function tenantDbName(slug: string): string {
  return `equity_email_${slug.replace(/-/g, "_")}`;
}

function adminUrl(): string | null {
  const base = process.env.EMAIL_DB_BASE_URL;
  if (!base) return null;
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/postgres`;
}

const pools = new Map<string, postgres.Sql>();

function poolFor(url: string): postgres.Sql {
  const cached = pools.get(url);
  if (cached) return cached;
  const sql = postgres(url, {
    max: 4,
    idle_timeout: 20,
    connect_timeout: 5,
    onnotice: () => {},
  });
  pools.set(url, sql);
  return sql;
}

const provisioned = new Set<string>();

export async function ensureTenantEmailDb(slug: string): Promise<string | null> {
  const url = resolveEmailDbUrl(slug);
  if (!url) return null;
  if (provisioned.has(url)) return url;

  const dbName = tenantDbName(slug);

  const override = process.env[`EMAIL_DB_URL_${slug.toUpperCase()}`];
  if (!override) {
    const admin = adminUrl();
    if (admin) {
      const adminSql = poolFor(admin);
      try {
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

  const sql = poolFor(url);
  try {
    await sql.unsafe(SCHEMA_SQL);
  } catch (e) {
    throw new Error(`ensureTenantEmailDb: schema init failed for ${dbName} — ${errMsg(e)}`);
  }

  provisioned.add(url);
  return url;
}

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

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function isEmailDbConfigured(): boolean {
  return !!process.env.EMAIL_DB_BASE_URL || Object.keys(process.env).some((k) =>
    k.startsWith("EMAIL_DB_URL_"),
  );
}
