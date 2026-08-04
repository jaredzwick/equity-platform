import type { MetadataRoute } from "next";

// Deal-page sitemap. Pulls the slug + published_at feed from the Go API
// (mirrors the CJS pattern — no direct DB access from Next.js).
// The API paginates at 5000/request; we walk pages until Total is reached.

const SITE_URL = "https://www.lamboapp.com";
const PYPES_API_URL =
  process.env.NEXT_PUBLIC_PYPES_API_URL ?? "https://api.pypes.dev";

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
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/docs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  ];

  const deals = await fetchAllDealSlugs();
  const dealRoutes: MetadataRoute.Sitemap = deals.map((d) => ({
    url: `${SITE_URL}/deal/${d.slug}`,
    lastModified: d.published_at ? new Date(d.published_at * 1000) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...dealRoutes];
}
