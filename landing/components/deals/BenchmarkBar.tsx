export type IndustryBenchmark = {
  industry_name: string;
  median_sde_multiple: number;
  median_asking_price: number;
  median_annual_profit: number;
  median_annual_revenue: number;
  sample_count: number;
};

// BenchmarkBar — "This deal 2.5x vs industry median 3.2x — 22% below market"
// Compares the deal's SDE multiple against the median of enriched deals
// in the same normalized_industry (deal_industry_benchmarks VIEW).
//
// Lower multiple = cheaper for the cash flow being bought, so we color
// "below market" green ("Priced below peers" is a buy signal) and
// "above market" red. Even split is neutral.
export function BenchmarkBar({
  benchmark,
  dealMultiple,
}: {
  benchmark: IndustryBenchmark;
  dealMultiple: number | undefined;
}) {
  if (!dealMultiple || dealMultiple <= 0) return null;
  const median = benchmark.median_sde_multiple;
  if (!median || median <= 0) return null;

  const pctDiff = ((dealMultiple - median) / median) * 100;
  const absPct = Math.abs(pctDiff).toFixed(0);
  const isBelow = pctDiff < -2;
  const isAbove = pctDiff > 2;
  const verdict = isBelow
    ? { label: `${absPct}% below industry median`, color: "text-emerald-300", bar: "bg-emerald-400" }
    : isAbove
    ? { label: `${absPct}% above industry median`, color: "text-red-300", bar: "bg-red-400" }
    : { label: "in line with industry median", color: "text-white/70", bar: "bg-white/40" };

  // Chart: 0× — median × 2 range so the deal + median both land on-scale.
  const scaleMax = Math.max(median * 2, dealMultiple * 1.1);
  const dealPct = Math.min(100, (dealMultiple / scaleMax) * 100);
  const medianPct = Math.min(100, (median / scaleMax) * 100);

  return (
    <section className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="text-xs font-mono uppercase tracking-widest text-white/50">
          Industry comp · {humanize(benchmark.industry_name)}
        </div>
        <div className="text-xs text-white/40">
          n={benchmark.sample_count}
        </div>
      </div>

      <div className="relative h-9 w-full overflow-hidden rounded-lg bg-white/[0.05]">
        <div
          className={`absolute left-0 top-0 h-full ${verdict.bar} opacity-70`}
          style={{ width: `${dealPct}%` }}
          aria-hidden
        />
        <div
          className="absolute top-0 h-full w-px bg-white/80"
          style={{ left: `${medianPct}%` }}
          aria-hidden
        />
        <div
          className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono uppercase tracking-wider text-white/50"
          style={{ left: `${medianPct}%` }}
        >
          median {median.toFixed(1)}x
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            This deal
          </div>
          <div className={`text-2xl font-semibold ${verdict.color}`}>
            {dealMultiple.toFixed(1)}x
          </div>
        </div>
        <div className={`text-sm ${verdict.color}`}>{verdict.label}</div>
      </div>
    </section>
  );
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
