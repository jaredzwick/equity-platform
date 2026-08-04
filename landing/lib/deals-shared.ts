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

// Curated industry chips for the filter panel. Refresh from
// SELECT normalized_industry, COUNT(*) FROM deals WHERE published_at IS NOT NULL
// GROUP BY 1 ORDER BY 2 DESC LIMIT 20 whenever inventory shape shifts.
export const INDUSTRY_CHIPS: readonly string[] = [
  "SaaS",
  "E-commerce",
  "Content / Blog",
  "Amazon FBA",
  "Digital Products",
  "Mobile App",
  "Marketplace",
  "Newsletter",
  "Services",
  "HVAC",
  "Restaurant",
  "Marketing Agency",
  "Fitness",
  "Landscaping",
  "Auto Repair",
  "Manufacturing",
  "Distribution",
  "Real Estate",
];

export const VALID_SORTS: readonly DealsSort[] = [
  "fit",
  "newest",
  "asking_asc",
  "asking_desc",
  "rev_desc",
];
