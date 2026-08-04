// ListingPreviewCard — visual preview of what a paid seller listing looks
// like once it's live at /deal/{slug}. Static (no fetch) so it renders
// on first paint; mirrors the columns + chip layout of the real
// /deal/[slug] page enough for a seller to recognize what they're paying
// for. Values are illustrative — no fake dashboard promises.

export default function ListingPreviewCard() {
  return (
    <div className="relative">
      {/* Browser chrome for context — helps sellers see "this is the live URL" */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl shadow-orange-500/10 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-red-500/70" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
          <span className="h-3 w-3 rounded-full bg-green-500/70" />
          <div className="ml-3 flex-1 truncate rounded-md bg-white/5 px-3 py-1 text-xs text-white/50">
            lamboapp.com/deal/your-business-a1b2c3d4
          </div>
        </div>

        {/* Deal detail — mirrors the real /deal/[slug] layout */}
        <div className="space-y-5 p-6">
          {/* Header chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-2.5 py-1 text-[11px] font-medium text-yellow-200">
              PASS · Fit score 8.6/10
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70">
              Online
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70">
              SaaS
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/70">
              Austin, TX
            </span>
          </div>

          {/* Business name */}
          <h3 className="text-2xl font-semibold tracking-tight text-white">
            Your Business Here
          </h3>

          {/* Stats grid — matches the columns on the real deal page */}
          <div className="grid grid-cols-4 gap-3 border-y border-white/[0.06] py-4">
            <PreviewStat label="ASKING" value="$150k" accent />
            <PreviewStat label="REVENUE" value="$80k" />
            <PreviewStat label="PROFIT" value="$45k" />
            <PreviewStat label="SDE MULT" value="3.3x" />
          </div>

          {/* Thesis */}
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-yellow-400/80">
              The Thesis
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-white/80">
              Recurring SaaS revenue with defensible SEO moat. Growing 15% YoY on
              organic + paid. Owner works ~5hrs/wk — clean handoff to a buyer.
            </p>
          </div>

          {/* Signal chips — mirrors red_flags + growth_signals sections */}
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-md border border-red-400/20 bg-red-400/[0.03] p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-red-300/80">
                Red flags
              </div>
              <p className="mt-1 text-white/60">Concentration risk: 2 customers = 55% of rev</p>
            </div>
            <div className="rounded-md border border-emerald-400/20 bg-emerald-400/[0.03] p-3">
              <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-300/80">
                Growth signals
              </div>
              <p className="mt-1 text-white/60">Enterprise pipeline valued at $200k</p>
            </div>
          </div>

          {/* Buyer CTA */}
          <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/[0.06] p-3 text-center">
            <div className="text-xs font-semibold text-yellow-200">
              Buyer sees: &ldquo;Request DD packet →&rdquo;
            </div>
          </div>
        </div>
      </div>

      {/* Sticker overlay — "what buyers see" */}
      <div className="absolute -top-3 -right-3 rotate-3 rounded-lg bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-black shadow-lg shadow-orange-500/40">
        Live preview
      </div>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[9px] font-mono uppercase tracking-widest text-white/40">
        {label}
      </div>
      <div
        className={
          "mt-1 text-lg font-semibold " +
          (accent ? "text-yellow-300" : "text-white")
        }
      >
        {value}
      </div>
    </div>
  );
}
