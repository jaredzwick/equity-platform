import Link from "next/link";

export type ComparableDeal = {
  id: string;
  slug: string;
  name: string;
  asking_price?: number;
  deal_fit_score?: number;
  hero_image_url?: string;
};

// ComparablesStrip — 2-to-4 similar deals shown at the bottom of a
// detail page so visitors have somewhere to go next. Server component
// (no state), honors the existing `/deal/[slug]` URL contract.
export function ComparablesStrip({ comparables }: { comparables: ComparableDeal[] }) {
  if (!comparables || comparables.length === 0) return null;

  return (
    <section className="mt-16">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Similar deals</h2>
        <Link
          href="/deals"
          className="text-xs text-white/50 underline underline-offset-4 hover:text-yellow-200"
        >
          Browse all →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {comparables.map((c) => (
          <Link
            key={c.id}
            href={`/deal/${c.slug}`}
            className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition hover:border-yellow-400/40"
          >
            {c.hero_image_url ? (
              <img
                src={c.hero_image_url}
                alt=""
                loading="lazy"
                className="aspect-[16/9] w-full object-cover"
              />
            ) : (
              <div className="aspect-[16/9] w-full bg-gradient-to-br from-white/[0.05] to-white/[0.02]" />
            )}
            <div className="p-4">
              <div className="line-clamp-2 text-sm font-medium leading-snug text-white group-hover:text-yellow-200">
                {c.name}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                <span>{money(c.asking_price)}</span>
                {typeof c.deal_fit_score === "number" && c.deal_fit_score > 0 && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                    Fit {c.deal_fit_score.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
