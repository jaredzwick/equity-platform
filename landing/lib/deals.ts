import "server-only";

import { pypesApiUrl } from "@/lib/env";
import type { DealFiltersState, DealsResponse, DealsSort } from "@/lib/deals-shared";
import { VALID_SORTS } from "@/lib/deals-shared";

// Public deal-browse API client for /deals. Backs the RSC's parallel
// fetch. No auth needed — the pypes /lamboapp/public/deals/search
// endpoint is IP rate-limited (60/min per IP) rather than auth-gated,
// so unauth visitors get the same data as signed-in ones. Paywall lives
// on the ACTIONS (save, message seller in v2) not the query.
//
// Type/constant re-exports live in lib/deals-shared.ts so client
// components can consume them without pulling in the server-only fetch.
export type { Deal, DealsResponse, DealsSort, DealFiltersState } from "@/lib/deals-shared";
export { INDUSTRY_CHIPS } from "@/lib/deals-shared";

const VALID_ORIGINS = new Set(["online", "smb"]);

// parseDealFilters turns URL searchParams into a typed filter state.
// Multi-value filters (industries, origins, locations) accept
// comma-separated lists. Same convention as the backend endpoint,
// so serializing state → URL → backend is a straight passthrough.
export function parseDealFilters(
  params: Record<string, string | undefined>,
): DealFiltersState {
  const num = (v?: string): number | undefined => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const list = (v?: string): string[] | undefined =>
    v
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

  const originsRaw = list(params.origins);
  const origins = originsRaw?.filter((o): o is "online" | "smb" =>
    VALID_ORIGINS.has(o),
  );

  const sort = params.sort as DealsSort | undefined;
  const validSort = sort && VALID_SORTS.includes(sort) ? sort : undefined;

  return {
    q: params.q?.trim() || undefined,
    industries: list(params.industries),
    origins: origins?.length ? origins : undefined,
    locations: list(params.locations),
    asking_min: num(params.asking_min),
    asking_max: num(params.asking_max),
    revenue_min: num(params.revenue_min),
    revenue_max: num(params.revenue_max),
    profit_min: num(params.profit_min),
    profit_max: num(params.profit_max),
    sde_multiple_max: num(params.sde_multiple_max),
    min_business_age_years: num(params.min_business_age_years),
    sort: validSort,
    page: num(params.page) ? Math.max(1, num(params.page)!) : undefined,
    page_size: num(params.page_size),
  };
}

// fetchDeals calls the pypes public search endpoint. Returns null on
// any failure so the RSC renders an ErrorPanel rather than crashing.
export async function fetchDeals(
  filters: DealFiltersState,
): Promise<DealsResponse | null> {
  const url = new URL(`${pypesApiUrl()}/lamboapp/public/deals/search`);
  if (filters.q) url.searchParams.set("q", filters.q);
  if (filters.industries?.length)
    url.searchParams.set("industries", filters.industries.join(","));
  if (filters.origins?.length)
    url.searchParams.set("origins", filters.origins.join(","));
  if (filters.locations?.length)
    url.searchParams.set("locations", filters.locations.join(","));
  if (filters.asking_min !== undefined)
    url.searchParams.set("asking_min", String(filters.asking_min));
  if (filters.asking_max !== undefined)
    url.searchParams.set("asking_max", String(filters.asking_max));
  if (filters.revenue_min !== undefined)
    url.searchParams.set("revenue_min", String(filters.revenue_min));
  if (filters.revenue_max !== undefined)
    url.searchParams.set("revenue_max", String(filters.revenue_max));
  if (filters.profit_min !== undefined)
    url.searchParams.set("profit_min", String(filters.profit_min));
  if (filters.profit_max !== undefined)
    url.searchParams.set("profit_max", String(filters.profit_max));
  if (filters.sde_multiple_max !== undefined)
    url.searchParams.set("sde_multiple_max", String(filters.sde_multiple_max));
  if (filters.min_business_age_years !== undefined)
    url.searchParams.set(
      "min_business_age_years",
      String(filters.min_business_age_years),
    );
  if (filters.sort) url.searchParams.set("sort", filters.sort);
  if (filters.page) url.searchParams.set("page", String(filters.page));
  if (filters.page_size)
    url.searchParams.set("page_size", String(filters.page_size));

  try {
    const res = await fetch(url.toString(), {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as DealsResponse;
  } catch {
    return null;
  }
}
