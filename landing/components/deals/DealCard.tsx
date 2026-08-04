"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Deal } from "@/lib/deals-shared";
import { fmtMoney, fmtMultiple, fmtFitScore, daysSince } from "@/lib/format";

// DealCard — one row in the /deals browse grid. Renders the full
// financials + fit chip + thesis snippet + industry/geo/origin chips
// + a "View deal" CTA (public) + a "Save" button that opens sign-in
// for unauth visitors.
//
// Flippa-style badges: NEW (published within 7 days) + HIGH FIT
// (deal_fit_score >= 8). Both are cheap trust/urgency signals that
// don't require any new data collection.
export function DealCard({
  deal,
  isAuth,
  isSaved,
  onToggleSave,
}: {
  deal: Deal;
  isAuth: boolean;
  isSaved: boolean;
  onToggleSave: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const industry = deal.normalized_industry || deal.industry || "";
  const fit = fmtFitScore(deal.deal_fit_score);
  const askingPrice = fmtMoney(deal.asking_price);
  const revenue = fmtMoney(deal.annual_revenue);
  const profit = fmtMoney(deal.annual_profit);
  const multiple = fmtMultiple(deal.sde_multiple);
  const daysAgo = daysSince(deal.published_at);
  const isNew = daysAgo <= 7;
  const isHighFit = (deal.deal_fit_score ?? 0) >= 8;

  const handleSave = () => {
    if (!isAuth) {
      // Unauth click → GitHub OAuth. Post-signup redirects back to /deals
      // via the callback's has_buy_box branching. The "save" intent is
      // lost on the round-trip (localStorage would preserve it but the
      // wedge is small enough that "sign in first, then browse and save"
      // is acceptable UX).
      startTransition(() => {
        router.push(`/api/auth/login?redirect=${encodeURIComponent("/deals")}`);
      });
      return;
    }
    onToggleSave();
  };

  const detailHref = deal.slug ? `/deal/${deal.slug}` : deal.source_url || "#";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur transition-all hover:border-yellow-400/40 hover:bg-black/60">
      {/* Badge row */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
        {isHighFit && (
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-yellow-300">
            <span aria-hidden>★</span> HIGH FIT · {fit}
          </span>
        )}
        {!isHighFit && fit && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/70">
            FIT {fit}
          </span>
        )}
        {isNew && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-emerald-300">
            <span
              aria-hidden
              className="relative flex h-1.5 w-1.5"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            NEW
          </span>
        )}
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/70">
          {deal.origin === "online" ? "ONLINE" : "SMB"}
        </span>
        {industry && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/70">
            {industry}
          </span>
        )}
      </div>

      {/* Name + location */}
      <div className="mb-4">
        <Link
          href={detailHref}
          className="text-lg font-semibold leading-tight text-white group-hover:text-yellow-300 md:text-xl"
        >
          {deal.name}
        </Link>
        {deal.location && (
          <p className="mt-1 text-xs text-white/50">{deal.location}</p>
        )}
      </div>

      {/* Financials grid */}
      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
        {askingPrice && (
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-white/40">
              Asking
            </dt>
            <dd className="font-semibold text-white">{askingPrice}</dd>
          </div>
        )}
        {revenue && (
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-white/40">
              Revenue
            </dt>
            <dd className="font-semibold text-white">{revenue}</dd>
          </div>
        )}
        {profit && (
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-white/40">
              Profit
            </dt>
            <dd className="font-semibold text-white">{profit}</dd>
          </div>
        )}
        {multiple && (
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-white/40">
              SDE
            </dt>
            <dd className="font-semibold text-white">{multiple}</dd>
          </div>
        )}
      </dl>

      {/* Thesis snippet — first 180 chars */}
      {deal.thesis && (
        <p className="mb-5 line-clamp-2 text-sm leading-relaxed text-white/70">
          {deal.thesis}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href={detailHref}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-2 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
        >
          View deal
          <span aria-hidden>→</span>
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          aria-pressed={isSaved}
          className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
            isSaved
              ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
              : "border-white/15 bg-white/5 text-white/80 hover:border-white/40 hover:text-white"
          }`}
        >
          <span aria-hidden>{isSaved ? "★" : "☆"}</span>
          {isAuth ? (isSaved ? "Saved" : "Save") : "Sign in to save"}
        </button>
      </div>
    </article>
  );
}
