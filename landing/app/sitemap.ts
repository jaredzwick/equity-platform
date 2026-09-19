import type { MetadataRoute } from "next";
import { listDocsTopics } from "@/lib/docs-content";
import { fetchDeals } from "@/lib/deals";
import {
  INDUSTRIES,
  PRICE_BUCKETS,
  indexabilityFor,
} from "@/lib/pseo";
import { COMPETITORS } from "@/lib/compare-data";

// Deal-page sitemap. Pulls the slug + published_at feed from the Go API
// (mirrors the CJS pattern — no direct DB access from Next.js).
// The API paginates at 5000/request; we walk pages until Total is reached.
//
// Docs are added from the filesystem via listDocsTopics() — each markdown
// file's frontmatter `lastmod` becomes its sitemap lastModified.

const SITE_URL = "https://www.lamboapp.com";
const PYPES_API_URL =
  process.env.NEXT_PUBLIC_PYPES_API_URL ?? "https://api.pypes.dev";

// Cutover for the enricher body-length raise (200 → 1500 chars). Any deal
// published before this timestamp was written under the old thin-body
// prompt — Google was rejecting the resulting pages en masse (7,555
// "Discovered — currently not indexed" in GSC on 2026-09-16). We stop
// sitemapping them so Google isn't asked to re-evaluate low-quality URLs;
// the per-page noindex in /deal/[slug] then drops them from the index queue.
// New enrichments (published_at >= this) go through the 600-900 word
// prompt and are safe to sitemap.
//
// Follow-up: the un-publish SQL migration in docs will let the enricher
// re-process the old rows under the new prompt, at which point they'll
// have a fresh published_at above the cutover and re-enter the sitemap.
const SEO_GATE_CUTOVER_MS = Date.UTC(2026, 8, 17); // 2026-09-17 UTC

export const revalidate = 3600;

type ApiRow = { slug: string; published_at: number };
type ApiResp = { items: ApiRow[]; total: number };

async function fetchAllDealSlugs(): Promise<ApiRow[]> {
  const limit = 5000;
  const first = await fetchPage(0, limit);
  if (!first) return [];
  if (first.total <= first.items.length) return first.items;
  const rest: ApiRow[] = [];
  for (let offset = first.items.length; offset < first.total; offset += limit) {
    const page = await fetchPage(offset, limit);
    if (!page) break;
    rest.push(...page.items);
  }
  return [...first.items, ...rest];
}

async function fetchPage(offset: number, limit: number): Promise<ApiResp | null> {
  try {
    const res = await fetch(
      `${PYPES_API_URL}/lamboapp/public/deals?limit=${limit}&offset=${offset}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as ApiResp;
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const docs = await listDocsTopics();
  // Docs index lastmod tracks the most-recently-edited doc so updates propagate.
  const docsIndexLastmod = docs.reduce<Date>((max, d) => {
    const parsed = new Date(d.lastmod);
    return parsed > max ? parsed : max;
  }, new Date(0));

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/deals`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.95 },
    { url: `${SITE_URL}/marketplaces`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.85 },
    // Sell-side landing page (2026-08-04). High priority because it's
    // the sole entry point for the $7 seller intent — no supporting
    // pages, direct conversion target.
    { url: `${SITE_URL}/sell`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    {
      url: `${SITE_URL}/docs`,
      lastModified: isFinite(docsIndexLastmod.getTime()) && docsIndexLastmod.getTime() > 0 ? docsIndexLastmod : new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Comparison pages — static, evergreen, high commercial intent.
  const compareRoutes: MetadataRoute.Sitemap = COMPETITORS.map((c) => ({
    url: `${SITE_URL}/compare/${c.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // pSEO industry pages — only sitemap facets that pass indexability
  // (≥ INDEX_MIN_DEALS listings). Google-safe: never sitemap a noindex
  // page. Requires one API call per industry, but they're small and
  // cached at both edge and origin.
  const industryChecks = await Promise.all(
    INDUSTRIES.map(async (i) => {
      const r = await fetchDeals({
        industries: [i.apiValue],
        page_size: 1,
      });
      return { def: i, total: r?.total ?? 0 };
    }),
  );
  const industryRoutes: MetadataRoute.Sitemap = industryChecks
    .filter(({ total }) => indexabilityFor(total) === "index")
    .map(({ def }) => ({
      url: `${SITE_URL}/deals/industry/${def.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.75,
    }));

  // Price-bucket pages — same indexability discipline.
  const priceChecks = await Promise.all(
    PRICE_BUCKETS.map(async (b) => {
      const r = await fetchDeals({
        asking_max: b.askingMax,
        page_size: 1,
      });
      return { def: b, total: r?.total ?? 0 };
    }),
  );
  const priceRoutes: MetadataRoute.Sitemap = priceChecks
    .filter(({ total }) => indexabilityFor(total) === "index")
    .map(({ def }) => ({
      url: `${SITE_URL}/deals/under/${def.slug}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.75,
    }));

  const docsRoutes: MetadataRoute.Sitemap = docs.map((d) => ({
    url: `${SITE_URL}/docs/${d.slug}`,
    lastModified: new Date(d.lastmod),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const deals = await fetchAllDealSlugs();
  const dealRoutes: MetadataRoute.Sitemap = deals
    .filter((d) => d.published_at && d.published_at * 1000 >= SEO_GATE_CUTOVER_MS)
    .map((d) => ({
      url: `${SITE_URL}/deal/${d.slug}`,
      lastModified: new Date(d.published_at * 1000),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  return [
    ...staticRoutes,
    ...compareRoutes,
    ...industryRoutes,
    ...priceRoutes,
    ...docsRoutes,
    ...dealRoutes,
  ];
}
