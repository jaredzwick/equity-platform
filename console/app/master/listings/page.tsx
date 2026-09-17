import Link from "next/link";
import { fetchPublicDeals, type PublicDeal } from "@/lib/lamboapp-public-deals";

export const dynamic = "force-dynamic";

// /master/listings — public deal browser. Same source as
// www.lamboapp.com/deals: pypes GET /lamboapp/public/deals/search. No
// ADMIN_LAMBOAPP_TOKEN required — this used to be a moderation surface for
// the paid /sell flow, but the operator asked for the unauthed browse
// experience instead. The admin table + unpublish route still live in
// the codebase for the eventual moderator role.

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Number.isFinite(Number(pageParam)) ? Math.max(1, Number(pageParam)) : 1;
  const response = await fetchPublicDeals({ q, page, page_size: 20 });

  return (
    <div className="space-y-6 px-6 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--color-fg)]">
            Deals
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            Live search across every AI-scored SMB listing.{" "}
            <a
              href="https://www.lamboapp.com/deals"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline"
            >
              Same feed as lamboapp.com/deals ↗
            </a>
          </p>
        </div>
        {response && (
          <div className="text-sm text-[color:var(--color-muted)]">
            <span className="text-lg font-semibold text-[color:var(--color-fg)]">
              {formatCount(response.total)}
            </span>{" "}
            deals
          </div>
        )}
      </header>

      <SearchBar initialQuery={q ?? ""} />

      {response === null ? (
        <ErrorPanel />
      ) : response.items.length === 0 ? (
        <EmptyPanel q={q} />
      ) : (
        <>
          <DealGrid deals={response.items} />
          <Pagination page={page} total={response.total} pageSize={response.page_size} q={q} />
        </>
      )}
    </div>
  );
}

function SearchBar({ initialQuery }: { initialQuery: string }) {
  return (
    <form action="/master/listings" method="get" className="flex gap-2">
      <input
        name="q"
        defaultValue={initialQuery}
        placeholder="Search name or thesis…"
        className="flex-1 rounded border border-[color:var(--color-border)] bg-white/5 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Search
      </button>
      {initialQuery && (
        <Link
          href="/master/listings"
          className="rounded border border-[color:var(--color-border)] px-4 py-2 text-sm text-[color:var(--color-muted)] hover:bg-white/5 hover:text-[color:var(--color-fg)]"
        >
          Clear
        </Link>
      )}
    </form>
  );
}

function DealGrid({ deals }: { deals: PublicDeal[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {deals.map((d) => (
        <DealCard key={d.id} deal={d} />
      ))}
    </div>
  );
}

function DealCard({ deal }: { deal: PublicDeal }) {
  const industry = deal.normalized_industry || deal.industry || "";
  const fit = deal.deal_fit_score !== undefined ? deal.deal_fit_score.toFixed(1) : null;
  const isHighFit = (deal.deal_fit_score ?? 0) >= 8;
  const daysAgo =
    deal.published_at !== undefined
      ? Math.floor((Date.now() - deal.published_at * 1000) / 86_400_000)
      : null;
  const isNew = daysAgo !== null && daysAgo <= 7;
  const detailHref = deal.slug
    ? `https://www.lamboapp.com/deal/${deal.slug}`
    : deal.source_url;

  return (
    <article className="rounded-lg border border-[color:var(--color-border)] bg-white/[0.02] p-4 hover:border-emerald-700/60 hover:bg-emerald-950/10 transition">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
        {fit && (
          <span
            className={
              isHighFit
                ? "rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-amber-300"
                : "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/70"
            }
          >
            {isHighFit ? "★ HIGH FIT · " : "FIT "}{fit}
          </span>
        )}
        {isNew && (
          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
            NEW
          </span>
        )}
        {deal.origin && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/70">
            {deal.origin.toUpperCase()}
          </span>
        )}
        {industry && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/70">
            {industry}
          </span>
        )}
      </div>
      <div className="mb-3">
        {detailHref ? (
          <a
            href={detailHref}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold leading-tight text-[color:var(--color-fg)] hover:text-emerald-400"
          >
            {deal.name}
          </a>
        ) : (
          <div className="text-sm font-semibold leading-tight text-[color:var(--color-fg)]">
            {deal.name}
          </div>
        )}
        {deal.location && (
          <div className="mt-0.5 text-xs text-[color:var(--color-muted)]">{deal.location}</div>
        )}
      </div>
      <dl className="mb-3 grid grid-cols-4 gap-x-3 gap-y-1 text-xs">
        <MoneyStat label="Asking" value={deal.asking_price} />
        <MoneyStat label="Revenue" value={deal.annual_revenue} />
        <MoneyStat label="Profit" value={deal.annual_profit} />
        <MultiStat label="SDE" value={deal.sde_multiple} />
      </dl>
      {deal.thesis && (
        <p className="text-xs text-[color:var(--color-muted)] line-clamp-2">{deal.thesis}</p>
      )}
    </article>
  );
}

function MoneyStat({ label, value }: { label: string; value: number | undefined }) {
  if (value === undefined || value === null) return null;
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</dt>
      <dd className="font-semibold">{formatMoney(value)}</dd>
    </div>
  );
}

function MultiStat({ label, value }: { label: string; value: number | undefined }) {
  if (value === undefined || value === null) return null;
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wider text-[color:var(--color-muted)]">{label}</dt>
      <dd className="font-semibold">{value.toFixed(1)}x</dd>
    </div>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  q,
}: {
  page: number;
  total: number;
  pageSize: number;
  q?: string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage <= 1) return null;
  const build = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    return `/master/listings${params.toString() ? "?" + params.toString() : ""}`;
  };
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-[color:var(--color-muted)]">
      <div>
        Page {page} of {lastPage}
      </div>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={build(page - 1)}
            className="rounded border border-[color:var(--color-border)] px-3 py-1.5 hover:bg-white/5 hover:text-[color:var(--color-fg)]"
          >
            ← Prev
          </Link>
        )}
        {page < lastPage && (
          <Link
            href={build(page + 1)}
            className="rounded border border-[color:var(--color-border)] px-3 py-1.5 hover:bg-white/5 hover:text-[color:var(--color-fg)]"
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}

function ErrorPanel() {
  return (
    <div className="rounded border border-red-500/40 bg-red-950/40 p-4 text-sm">
      <div className="font-semibold text-red-200">Couldn&rsquo;t load deals.</div>
      <div className="mt-1 text-xs text-red-200/70">
        The pypes deploy may be down or rate-limiting. Set{" "}
        <code>PYPES_API_URL</code> in <code>console/.env.local</code> if you&rsquo;re
        pointing at a non-default backend.
      </div>
    </div>
  );
}

function EmptyPanel({ q }: { q?: string }) {
  return (
    <div className="rounded border border-[color:var(--color-border)] bg-white/[0.02] p-8 text-center text-sm text-[color:var(--color-muted)]">
      {q ? (
        <>
          No deals match <span className="text-[color:var(--color-fg)]">&ldquo;{q}&rdquo;</span>.{" "}
          <Link href="/master/listings" className="text-emerald-400 hover:underline">
            Clear search
          </Link>
        </>
      ) : (
        "No deals in the feed right now."
      )}
    </div>
  );
}

function formatCount(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "K";
  return "$" + n.toLocaleString();
}
