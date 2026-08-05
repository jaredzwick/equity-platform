// Client-safe types + constants for the /deals browse UI. Kept
// separate from lib/deals.ts (which is server-only because it holds
// the fetch that reads env vars). Any client component that needs to
// read filter state, sort options, or the industry chip list imports
// from HERE, not from lib/deals.

export type Deal = {
  id: string;
  slug: string;
  name: string;
  industry?: string;
  normalized_industry?: string;
  source_url?: string;
  origin: "online" | "smb";
  asking_price?: number;
  annual_revenue?: number;
  annual_profit?: number;
  sde_multiple?: number;
  location?: string;
  deal_fit_score?: number;
  thesis?: string;
  published_at: number;
};

export type DealsResponse = {
  items: Deal[];
  total: number;
  page: number;
  page_size: number;
};

export type DealsSort =
  | "fit"
  | "newest"
  | "asking_asc"
  | "asking_desc"
  | "rev_desc";

export type DealFiltersState = {
  q?: string;
  industries?: string[];
  origins?: ("online" | "smb")[];
  locations?: string[];
  asking_min?: number;
  asking_max?: number;
  revenue_min?: number;
  revenue_max?: number;
  profit_min?: number;
  profit_max?: number;
  sde_multiple_max?: number;
  min_business_age_years?: number;
  sort?: DealsSort;
  page?: number;
  page_size?: number;
};

// Industry chips for the filter panel. Each chip has:
//   - value: the raw Haiku normalized_industry string (used as the API
//     filter param — exact match on deals.normalized_industry).
//   - label: human-readable display (Title Case, spaces, punctuation).
//
// Sourced 2026-08-04 from a full-corpus scan (all 104 published deals):
//   ecommerce 35 · other 27 · saas 23 · content_site 15 · agency 3 · service_business 1
// "other" is intentionally hidden — it's a garbage-bucket value that
// isn't useful for buyer filtering. Refresh this list when adding new
// broker sources or when the Haiku enricher prompt changes.
export type IndustryChip = { value: string; label: string };

export const INDUSTRY_CHIPS: readonly IndustryChip[] = [
  { value: "ecommerce", label: "E-commerce" },
  { value: "saas", label: "SaaS" },
  { value: "content_site", label: "Content / Blog" },
  { value: "agency", label: "Agency" },
  { value: "service_business", label: "Services" },
];

export const VALID_SORTS: readonly DealsSort[] = [
  "fit",
  "newest",
  "asking_asc",
  "asking_desc",
  "rev_desc",
];
