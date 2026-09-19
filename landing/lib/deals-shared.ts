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

// Quick-pick location chips for the /deals filter. Values are the
// exact-case tokens sent to the pypes /public/deals/search `locations`
// param — the backend matches them as substrings but is case-sensitive
// in practice, so we pin the casing here to avoid the "nevada" vs
// "Nevada" zero-result surprise a free-form input would create.
//
// List biased toward the US SMB acquisition market (top-15 states by
// small-business density), with Remote, Canada, UK, and EU included
// for the international corpus.
export type LocationChip = { value: string; label: string };

export const LOCATION_CHIPS: readonly LocationChip[] = [
  { value: "Remote", label: "Remote" },
  { value: "United States", label: "USA" },
  { value: "California", label: "California" },
  { value: "Texas", label: "Texas" },
  { value: "Florida", label: "Florida" },
  { value: "New York", label: "New York" },
  { value: "Illinois", label: "Illinois" },
  { value: "Pennsylvania", label: "Pennsylvania" },
  { value: "Ohio", label: "Ohio" },
  { value: "Georgia", label: "Georgia" },
  { value: "North Carolina", label: "North Carolina" },
  { value: "Michigan", label: "Michigan" },
  { value: "New Jersey", label: "New Jersey" },
  { value: "Virginia", label: "Virginia" },
  { value: "Washington", label: "Washington" },
  { value: "Arizona", label: "Arizona" },
  { value: "Massachusetts", label: "Massachusetts" },
  { value: "Tennessee", label: "Tennessee" },
  { value: "Colorado", label: "Colorado" },
  { value: "Nevada", label: "Nevada" },
  { value: "Oregon", label: "Oregon" },
  { value: "Utah", label: "Utah" },
  { value: "Canada", label: "Canada" },
  { value: "United Kingdom", label: "UK" },
  { value: "European Union", label: "EU" },
];

// Preset asking-price buckets for the filter. Client-only state — these
// intentionally do NOT emit crawlable <Link>s so they don't cannibalize
// the hand-authored /deals/under/[slug] pSEO pages. Each bucket sets
// asking_min/asking_max URL params on the /deals search route.
export type PriceBucket = {
  slug: string;
  label: string;
  min?: number;
  max?: number;
};

export const PRICE_BUCKET_CHIPS: readonly PriceBucket[] = [
  { slug: "u100k", label: "< $100k", max: 100_000 },
  { slug: "100k-500k", label: "$100k–$500k", min: 100_000, max: 500_000 },
  { slug: "500k-1m", label: "$500k–$1M", min: 500_000, max: 1_000_000 },
  { slug: "1m-5m", label: "$1M–$5M", min: 1_000_000, max: 5_000_000 },
  { slug: "5m-plus", label: "$5M+", min: 5_000_000 },
];

// activePriceBucketSlug: reverse-lookup — given the current filter's
// asking_min/max, find the bucket slug that matches exactly. Used by
// the UI to render the selected segmented state without duplicating
// bucket edges.
export function activePriceBucketSlug(
  min: number | undefined,
  max: number | undefined,
): string | undefined {
  return PRICE_BUCKET_CHIPS.find((b) => b.min === min && b.max === max)?.slug;
}
