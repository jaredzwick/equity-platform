// Server-only client for the pypes public deal-search endpoint. No auth —
// pypes rate-limits by IP (60/min). Mirrors the shape used by
// landing/lib/deals.ts so anything we render matches www.lamboapp.com/deals.

import "server-only";

const PYPES_API_URL =
  process.env.PYPES_API_URL ??
  process.env.NEXT_PUBLIC_PYPES_API_URL ??
  "https://api.pypes.dev";

export type PublicDeal = {
  id: string;
  slug?: string;
  name: string;
  industry?: string;
  normalized_industry?: string;
  origin?: "online" | "smb";
  location?: string;
  asking_price?: number;
  annual_revenue?: number;
  annual_profit?: number;
  sde_multiple?: number;
  thesis?: string;
  deal_fit_score?: number;
  published_at?: number;
  source_url?: string;
};

export type PublicDealsResponse = {
  items: PublicDeal[];
  total: number;
  page: number;
  page_size: number;
};

export type PublicDealsFilters = {
  q?: string;
  page?: number;
  page_size?: number;
  sort?: string;
  industries?: string[];
  origins?: string[];
};

// Failure returns null so the caller can render an error card without a
// stack trace. The public endpoint is normally up; a null result means the
// pypes deploy is down or the URL env is misconfigured.
export async function fetchPublicDeals(
  filters: PublicDealsFilters = {},
): Promise<PublicDealsResponse | null> {
  const url = new URL(`${PYPES_API_URL}/lamboapp/public/deals/search`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.industries?.length)
    url.searchParams.set("industries", filters.industries.join(","));
  if (filters.origins?.length)
    url.searchParams.set("origins", filters.origins.join(","));
  if (filters.sort) url.searchParams.set("sort", filters.sort);
  url.searchParams.set("page", String(filters.page ?? 1));
  url.searchParams.set("page_size", String(filters.page_size ?? 20));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicDealsResponse;
  } catch {
    return null;
  }
}
