// Postgres client for the landing site. Read-only: deal detail pages fetch by
// seo_slug from the `deals` table populated by the n8n workflow
// t5xCcyHPhqJd3LMi ("Deal Sourcer — Businesses For Sale Enricher").
//
// Shape matches the Drizzle schema at ~/pypes/infra/drizzle/schema.ts:
//   deals(id uuid, source text, external_id text, origin deal_origin,
//         name text, source_url text, asking_price numeric,
//         annual_revenue numeric, annual_profit numeric,
//         sde_multiple numeric, sde_multiple_computed numeric,
//         deal_fit_score numeric, thesis text, red_flags jsonb,
//         normalized_industry text, growth_signals jsonb,
//         seo_title text, seo_description text, seo_slug text,
//         seo_body_html text, published_at timestamptz, ...)
//
// DATABASE_URL env var required. Vercel sets pooled URLs by default; use a
// pooled endpoint (pgbouncer) since this is called from serverless.

import { Pool } from "pg";

const globalForPool = globalThis as unknown as { __lamboapp_pool?: Pool };

function pool(): Pool {
  if (!globalForPool.__lamboapp_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    globalForPool.__lamboapp_pool = new Pool({
      connectionString: url,
      max: 3,
      idleTimeoutMillis: 20_000,
      // Vercel/DO managed Postgres both require SSL; sslmode=require in the
      // URL is preferred, but this is a safety net.
      ssl: url.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }
  return globalForPool.__lamboapp_pool;
}

export type Deal = {
  id: string;
  source: string;
  origin: "online" | "smb";
  name: string;
  source_url: string;
  industry: string | null;
  normalized_industry: string | null;
  asking_price: number | null;
  currency: string | null;
  annual_revenue: number | null;
  annual_profit: number | null;
  sde_multiple: number | null;
  sde_multiple_computed: number | null;
  location: string | null;
  deal_fit_score: number | null;
  thesis: string | null;
  red_flags: string[] | null;
  growth_signals: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_slug: string;
  seo_body_html: string | null;
  published_at: string | null;
};

export async function getDealBySlug(slug: string): Promise<Deal | null> {
  const p = pool();
  const q = `
    SELECT id::text, source, origin::text AS origin, name, source_url,
           industry, normalized_industry,
           asking_price::float8 AS asking_price, currency,
           annual_revenue::float8 AS annual_revenue,
           annual_profit::float8 AS annual_profit,
           sde_multiple::float8 AS sde_multiple,
           sde_multiple_computed::float8 AS sde_multiple_computed,
           location,
           deal_fit_score::float8 AS deal_fit_score,
           thesis, red_flags, growth_signals,
           seo_title, seo_description, seo_slug, seo_body_html,
           published_at::text AS published_at
    FROM deals
    WHERE seo_slug = $1
      AND published_at IS NOT NULL
    LIMIT 1;
  `;
  const { rows } = await p.query(q, [slug]);
  return rows[0] ?? null;
}

// Sitemap helper — all published deals, newest first.
export async function listPublishedSlugs(limit = 5000): Promise<Array<{ slug: string; published_at: string }>> {
  const p = pool();
  const { rows } = await p.query(
    `SELECT seo_slug AS slug, published_at::text AS published_at
     FROM deals
     WHERE published_at IS NOT NULL AND seo_slug IS NOT NULL
     ORDER BY published_at DESC
     LIMIT $1;`,
    [limit],
  );
  return rows;
}
