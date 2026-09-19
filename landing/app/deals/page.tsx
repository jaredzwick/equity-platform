import type { Metadata } from "next";
import { fetchDeals, parseDealFilters } from "@/lib/deals";
import type { DealFiltersState } from "@/lib/deals-shared";
import {
  INDUSTRY_CHIPS,
  LOCATION_CHIPS,
  activePriceBucketSlug,
  PRICE_BUCKET_CHIPS,
} from "@/lib/deals-shared";
import { getSession } from "@/lib/session";
import { fmtCount, fmtMoney } from "@/lib/format";
import { DealFilters } from "@/components/deals/DealFilters";
import { DealBrowseList } from "@/components/deals/DealBrowseList";
import { DealPagination } from "@/components/deals/DealPagination";
import {
  INDUSTRIES,
  PRICE_BUCKETS,
  breadcrumbJsonLd,
  itemListJsonLd,
  SITE_URL,
} from "@/lib/pseo";
import Link from "next/link";

// /deals — public search-engine over enriched business-for-sale
// listings. Same architecture as careerjumpship/dashboard/jobs but
// tuned for the PE-buyer audience:
//   - Full grid, all filters, all pagination FREE (matches Flippa /
//     Acquire.com — gate the ACTION, not the query).
//   - Sign-in ("Save deal" button) is the sole conversion moment.
//   - Every deal detail page is public SEO (backed by GET
//     /lamboapp/public/deals/{slug}), so this /deals index just
//     provides discovery + filter UX on top of what's already indexed.
//
// Backend: GET /lamboapp/public/deals/search with the flat query-
// string shape. IP rate-limited (60/min per IP, 20 burst) so a
// scraper can't sweep the corpus.

export const metadata: Metadata = {
  title: "Deal flow — cash-flowing SMBs for sale | LamboApp",
  description:
    "Live search across ~100 new business-for-sale listings per day. Every deal ships with a fit score, a 1-paragraph thesis, and a red-flag list. Filter by industry, revenue, SDE multiple, and geography. Free to browse.",
  keywords: [
    "businesses for sale",
    "SMB acquisition",
    "buy a business",
    "SDE multiple",
    "search fund",
    "small business acquisition",
    "cash-flowing business",
    "buy an SMB",
    "acquire a business",
    "business for sale by owner",
  ],
  alternates: { canonical: "https://www.lamboapp.com/deals" },
  openGraph: {
    title: "Deal flow — cash-flowing SMBs for sale",
    description:
      "Live search across ~100 new listings per day. Every deal ships with a fit score, a thesis, and a red-flag list. Filter by industry, revenue, and multiple. Free to browse.",
    url: "https://www.lamboapp.com/deals",
    siteName: "LamboApp",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Deal flow — cash-flowing SMBs for sale",
    description:
      "~100 fresh listings/day. Every one scored. Every scam flagged. Filter and buy.",
  },
};

// Parallel + no-store: deals data changes on every enricher tick and
// the visitor's filters change per request. Any static caching would
// serve a stale grid.
export const dynamic = "force-dynamic";

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseDealFilters(params);
  const [response, session] = await Promise.all([
    fetchDeals(filters),
    getSession().catch(() => null),
  ]);
  const isAuth = Boolean(session?.login);

  const deals = response?.items ?? [];
  const total = response?.total ?? 0;
  const page = response?.page ?? 1;
  const pageSize = response?.page_size ?? 20;

  const breadcrumb = breadcrumbJsonLd([
    { name: "LamboApp", url: SITE_URL },
    { name: "Deals", url: `${SITE_URL}/deals` },
  ]);
  const list = itemListJsonLd({
    name: "Live business-for-sale deal flow",
    url: `${SITE_URL}/deals`,
    deals,
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 pt-24 md:px-6 md:py-12 md:pt-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(list) }}
      />
      {/* Hero — trimmed down so the search bar lands above the fold. */}
      <div className="mb-6 space-y-4 md:mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/[0.06] px-3 py-1 text-xs text-yellow-200/90 backdrop-blur">
          <span
            aria-hidden
            className="relative flex h-2 w-2"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
          </span>
          Fresh deals sourced hourly · AI-scored for fit
        </div>
        <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">
          {isAuth ? (
            <>
              <span className="text-white/70">Welcome back — </span>
              browse{" "}
              <span className="bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent">
                {fmtCount(total)} deals
              </span>
            </>
          ) : (
            <>
              Browse{" "}
              <span className="bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent">
                {fmtCount(total)} cash-flowing businesses
              </span>{" "}
              for sale
            </>
          )}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-white/60 md:text-base md:leading-relaxed">
          Search by industry, location, or price. Every deal AI-enriched
          with a fit score, one-paragraph thesis, red flags, and growth
          signals. Free to browse — sign in to save.
        </p>
      </div>

      {/* Filter panel (owns the hero search bar) */}
      <DealFilters initial={filters} isAuth={isAuth} />

      {/* Count + range */}
      <div className="mt-6 mb-4 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <p className="text-sm text-white/60">
          <span className="text-lg font-bold text-white">
            {fmtCount(total)}
          </span>{" "}
          {total === 1 ? "deal" : "deals"} match your filters
        </p>
        {deals.length > 0 && (
          <p className="text-xs text-white/40">
            Showing {(page - 1) * pageSize + 1}–
            {(page - 1) * pageSize + deals.length} of {fmtCount(total)}
          </p>
        )}
      </div>

      {/* List */}
      {response === null ? (
        <ErrorPanel />
      ) : deals.length === 0 ? (
        <EmptyPanel filters={filters} />
      ) : (
        <DealBrowseList deals={deals} isAuth={isAuth} />
      )}

      {/* Pager */}
      <DealPagination page={page} pageSize={pageSize} total={total} />

      {/* Facet hubs — internal-linking to pSEO industry + price landing
          pages. Curated (not combinatorial) per pSEO safety guidance:
          hub-and-spoke, no combinatorial mesh. */}
      <section className="mt-12 grid gap-8 border-t border-white/5 pt-10 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50">
            By industry
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {INDUSTRIES.map((i) => (
              <Link
                key={i.slug}
                href={`/deals/industry/${i.slug}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/80 hover:border-yellow-400/40 hover:text-yellow-200"
              >
                {i.label} →
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50">
            By price
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRICE_BUCKETS.map((b) => (
              <Link
                key={b.slug}
                href={`/deals/under/${b.slug}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/80 hover:border-yellow-400/40 hover:text-yellow-200"
              >
                Under ${b.slug} →
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Sign-up nudge (only for unauth, no active filters) — when the
          visitor is filtering, the "Text me matches" CTA lives in the
          filter bar next to Clear-all. Below-fold nudge only fires for
          people scrolling the full catalog with no intent captured. */}
      {!isAuth && deals.length > 0 && !anyFilter(filters) && (
        <div className="mt-8 rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.05] p-6 text-center backdrop-blur">
          <p className="text-lg font-semibold text-white">
            Get scored deals texted to you
          </p>
          <p className="mt-2 text-sm text-white/60">
            Drop your name and number. We&rsquo;ll text you when a new listing
            matches your industry, revenue, and multiple criteria.
          </p>
          <Link
            href="/signup"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02]"
          >
            Get on the list →
          </Link>
        </div>
      )}
    </main>
  );
}

function anyFilter(f: DealFiltersState): boolean {
  return (
    Boolean(f.q) ||
    (f.industries?.length ?? 0) > 0 ||
    (f.locations?.length ?? 0) > 0 ||
    (f.origins?.length ?? 0) > 0 ||
    f.asking_min !== undefined ||
    f.asking_max !== undefined ||
    f.revenue_min !== undefined ||
    f.revenue_max !== undefined ||
    f.profit_min !== undefined ||
    f.profit_max !== undefined ||
    f.sde_multiple_max !== undefined ||
    f.min_business_age_years !== undefined
  );
}

function ErrorPanel() {
  return (
    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-8 text-center">
      <p className="text-sm font-semibold text-red-200">
        Couldn&rsquo;t load deals right now.
      </p>
      <p className="mt-2 text-xs text-red-200/70">
        The backend may be redeploying or rate-limited. Try again in a minute.
      </p>
    </div>
  );
}

function EmptyPanel({ filters }: { filters: DealFiltersState }) {
  const drops = buildFilterDrops(filters);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur md:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-400/10 text-yellow-300">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-bold text-white">
        No deals match those filters.
      </h3>
      <p className="mt-2 text-sm text-white/60">
        Broaden your search by dropping one:
      </p>
      {drops.length > 0 ? (
        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          {drops.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs text-white/90 transition-colors hover:border-yellow-400/40 hover:text-yellow-200"
            >
              <span aria-hidden>×</span>
              Drop {d.label}
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/60">
          <Link
            href="/deals"
            className="font-semibold text-yellow-300 underline underline-offset-2 hover:text-yellow-200"
          >
            Clear all filters
          </Link>{" "}
          to see the full inventory.
        </p>
      )}
      {drops.length > 0 && (
        <p className="mt-6 text-xs text-white/40">
          Or{" "}
          <Link
            href="/deals"
            className="font-semibold text-white/70 underline underline-offset-2 hover:text-white"
          >
            clear all filters
          </Link>
          .
        </p>
      )}
    </div>
  );
}

// buildFilterDrops — one Link per active filter that removes it from
// the URL. Server-rendered so no-JS visitors can still recover from an
// empty state.
function buildFilterDrops(
  f: DealFiltersState,
): { label: string; href: string }[] {
  const drops: { label: string; href: string }[] = [];
  const base = { ...f, page: undefined, page_size: undefined };

  const link = (patch: Partial<DealFiltersState>): string => {
    const merged = { ...base, ...patch };
    const qs = filtersToQuery(merged);
    return qs ? `/deals?${qs}` : "/deals";
  };

  if (f.q) drops.push({ label: `search "${f.q}"`, href: link({ q: undefined }) });
  for (const ind of f.industries ?? []) {
    const chip = INDUSTRY_CHIPS.find((c) => c.value === ind);
    drops.push({
      label: chip?.label ?? ind,
      href: link({
        industries: (f.industries ?? []).filter((v) => v !== ind),
      }),
    });
  }
  for (const loc of f.locations ?? []) {
    const chip = LOCATION_CHIPS.find((c) => c.value === loc);
    drops.push({
      label: chip?.label ?? loc,
      href: link({
        locations: (f.locations ?? []).filter((v) => v !== loc),
      }),
    });
  }
  const bucketSlug = activePriceBucketSlug(f.asking_min, f.asking_max);
  if (bucketSlug) {
    const b = PRICE_BUCKET_CHIPS.find((x) => x.slug === bucketSlug);
    drops.push({
      label: `asking ${b?.label ?? ""}`,
      href: link({ asking_min: undefined, asking_max: undefined }),
    });
  } else {
    if (f.asking_min !== undefined)
      drops.push({
        label: `asking ≥ ${fmtMoney(f.asking_min)}`,
        href: link({ asking_min: undefined }),
      });
    if (f.asking_max !== undefined)
      drops.push({
        label: `asking ≤ ${fmtMoney(f.asking_max)}`,
        href: link({ asking_max: undefined }),
      });
  }
  if (f.revenue_min !== undefined)
    drops.push({
      label: `revenue floor`,
      href: link({ revenue_min: undefined }),
    });
  if (f.revenue_max !== undefined)
    drops.push({
      label: `revenue cap`,
      href: link({ revenue_max: undefined }),
    });
  if (f.profit_min !== undefined)
    drops.push({
      label: `profit floor`,
      href: link({ profit_min: undefined }),
    });
  if (f.profit_max !== undefined)
    drops.push({
      label: `profit cap`,
      href: link({ profit_max: undefined }),
    });
  if (f.sde_multiple_max !== undefined)
    drops.push({
      label: `SDE cap`,
      href: link({ sde_multiple_max: undefined }),
    });
  if (f.min_business_age_years !== undefined)
    drops.push({
      label: `min age`,
      href: link({ min_business_age_years: undefined }),
    });

  return drops;
}

function filtersToQuery(f: DealFiltersState): string {
  const usp = new URLSearchParams();
  if (f.q) usp.set("q", f.q);
  if (f.industries?.length) usp.set("industries", f.industries.join(","));
  if (f.origins?.length) usp.set("origins", f.origins.join(","));
  if (f.locations?.length) usp.set("locations", f.locations.join(","));
  if (f.asking_min !== undefined) usp.set("asking_min", String(f.asking_min));
  if (f.asking_max !== undefined) usp.set("asking_max", String(f.asking_max));
  if (f.revenue_min !== undefined) usp.set("revenue_min", String(f.revenue_min));
  if (f.revenue_max !== undefined) usp.set("revenue_max", String(f.revenue_max));
  if (f.profit_min !== undefined) usp.set("profit_min", String(f.profit_min));
  if (f.profit_max !== undefined) usp.set("profit_max", String(f.profit_max));
  if (f.sde_multiple_max !== undefined)
    usp.set("sde_multiple_max", String(f.sde_multiple_max));
  if (f.min_business_age_years !== undefined)
    usp.set("min_business_age_years", String(f.min_business_age_years));
  if (f.sort) usp.set("sort", f.sort);
  return usp.toString();
}
