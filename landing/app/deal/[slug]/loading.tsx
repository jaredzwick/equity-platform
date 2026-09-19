// Streamed skeleton for /deal/[slug] — mirrors the real page's above-
// the-fold structure so the user gets a stable layout while the pypes
// public-deals fetch resolves. Kept close to the shipped visual (fit
// chip → title → 4-stat row → chip row → thesis block) so the paint
// doesn't jump when the real content arrives.
export default function LoadingDealDetail() {
  return (
    <article
      className="mx-auto max-w-4xl px-6 py-16 md:py-24"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mb-8 flex items-center gap-2 text-xs text-white/30">
        <span>LamboApp</span>
        <span>/</span>
        <span>Deals</span>
        <span>/</span>
        <span className="text-white/50">Loading…</span>
      </div>

      <div className="mb-6 h-8 w-40 animate-pulse rounded-full bg-white/10" />
      <div className="h-10 w-3/4 animate-pulse rounded-md bg-white/10 md:h-12" />
      <div className="mt-3 h-6 w-1/2 animate-pulse rounded-md bg-white/5" />

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
            <div className="mt-2 h-6 w-3/4 animate-pulse rounded bg-white/15" />
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-6 w-20 animate-pulse rounded-full border border-white/10 bg-white/5"
          />
        ))}
      </div>

      <div className="mt-10 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-white/[0.08]" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-white/[0.08]" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.08]" />
      </div>
    </article>
  );
}
