import type { Metadata } from "next";
import Link from "next/link";
import { fetchDeals, parseDealFilters } from "@/lib/deals";
import { getSession } from "@/lib/session";
import { fmtCount } from "@/lib/format";
import { DealFilters } from "@/components/deals/DealFilters";
import { DealBrowseList } from "@/components/deals/DealBrowseList";
import { DealPagination } from "@/components/deals/DealPagination";

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
  title: "Browse deals — cash-flowing businesses for sale",
  description:
    "Filter thousands of enriched business-for-sale listings by industry, revenue, SDE multiple, and geography. AI-scored fit ratings on every deal. Free to browse.",
  alternates: { canonical: "https://www.lamboapp.com/deals" },
  openGraph: {
    title: "Browse deals — lamboapp.com",
    description:
      "AI-scored business-for-sale listings, filterable by industry, revenue, SDE multiple, and geography.",
    url: "https://www.lamboapp.com/deals",
    type: "website",
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 pt-24 md:px-6 md:py-12 md:pt-32">
      {/* Hero */}
      <div className="mb-8 space-y-3">
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
        <p className="max-w-2xl text-sm text-white/60 md:text-base">
          Every deal enriched by AI: SDE multiple, red flags, growth signals,
          and a fit score you can trust. Sign in to save deals to your buy-box
          and get a weekly digest of new matches.
        </p>
      </div>

      {/* Filter panel */}
      <DealFilters initial={filters} />

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
        <EmptyPanel />
      ) : (
        <DealBrowseList deals={deals} isAuth={isAuth} />
      )}

      {/* Pager */}
      <DealPagination page={page} pageSize={pageSize} total={total} />

      {/* Sign-in nudge (only for unauth) */}
      {!isAuth && deals.length > 0 && (
        <div className="mt-8 rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.05] p-6 text-center backdrop-blur">
          <p className="text-lg font-semibold text-white">
            Save deals + get a weekly buy-box digest
          </p>
          <p className="mt-2 text-sm text-white/60">
            Sign in with GitHub. We&rsquo;ll send you a weekly email of new
            deals matching your industry, revenue, and multiple criteria.
          </p>
          <Link
            href="/api/auth/login"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02]"
          >
            Sign in with GitHub →
          </Link>
        </div>
      )}
    </main>
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

function EmptyPanel() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center backdrop-blur">
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
        Try widening one — drop the SDE cap, expand the revenue range, or clear
        an industry chip. Or{" "}
        <Link
          href="/deals"
          className="font-semibold text-yellow-300 underline underline-offset-2 hover:text-yellow-200"
        >
          clear all filters
        </Link>
        .
      </p>
    </div>
  );
}
