import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDealBySlug, type Deal } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 300;

const SITE_URL = "https://lamboapp.com";

type PageProps = { params: Promise<{ slug: string }> };

// Per-deal metadata for SEO (title, description, canonical, OG, twitter).
// Falls back to sensible defaults if a field is null.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const deal = await getDealBySlug(slug).catch(() => null);
  if (!deal) {
    return { title: "Deal not found", robots: { index: false, follow: false } };
  }
  const title = deal.seo_title ?? deal.name;
  const description =
    deal.seo_description ??
    `${deal.name} — asking ${money(deal.asking_price)}, ${deal.origin} business. AI fit score: ${deal.deal_fit_score ?? "N/A"}.`;
  const url = `${SITE_URL}/deal/${deal.seo_slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "LamboApp",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    other: {
      "deal:fit_score": String(deal.deal_fit_score ?? ""),
      "deal:origin": deal.origin,
      "deal:asking_price": String(deal.asking_price ?? ""),
    },
  };
}

export default async function DealPage({ params }: PageProps) {
  const { slug } = await params;
  const deal = await getDealBySlug(slug).catch(() => null);
  if (!deal) notFound();

  const fitScore = deal.deal_fit_score ?? 0;
  const verdict =
    fitScore >= 7 ? { label: "Buy signal", color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/30" }
    : fitScore >= 5 ? { label: "Investigate", color: "text-yellow-300", bg: "bg-yellow-500/10 border-yellow-500/30" }
    : { label: "Pass", color: "text-red-300", bg: "bg-red-500/10 border-red-500/30" };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: deal.name,
    description: deal.seo_description ?? deal.thesis ?? deal.name,
    url: `${SITE_URL}/deal/${deal.seo_slug}`,
    offers: deal.asking_price
      ? {
          "@type": "Offer",
          priceCurrency: deal.currency ?? "USD",
          price: deal.asking_price,
          availability: "https://schema.org/InStock",
          url: deal.source_url,
        }
      : undefined,
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: fitScore,
      bestRating: 10,
      worstRating: 0,
      ratingCount: 1,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <article className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        {/* Breadcrumb */}
        <nav className="mb-8 text-xs text-white/40">
          <Link href="/" className="hover:text-white">LamboApp</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Deal</span>
        </nav>

        {/* Verdict + title */}
        <div className={`mb-6 inline-flex items-center gap-3 rounded-full border ${verdict.bg} px-4 py-1.5`}>
          <span className={`text-sm font-bold uppercase tracking-wide ${verdict.color}`}>
            {verdict.label}
          </span>
          <span className="text-white/40">·</span>
          <span className="text-sm text-white/80">
            Fit score: <strong className={verdict.color}>{fitScore.toFixed(1)}</strong> / 10
          </span>
        </div>

        <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
          {deal.name}
        </h1>

        {/* Financial snapshot */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Asking" value={money(deal.asking_price)} />
          <Stat label="Annual revenue" value={money(deal.annual_revenue)} />
          <Stat label="Annual profit" value={money(deal.annual_profit)} />
          <Stat label="SDE multiple" value={deal.sde_multiple_computed ? `${deal.sde_multiple_computed.toFixed(1)}x` : "—"} />
        </div>

        {/* Meta chips */}
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
          <Chip>{deal.origin === "smb" ? "🏭 SMB" : "💻 Online"}</Chip>
          {deal.normalized_industry && <Chip>{humanize(deal.normalized_industry)}</Chip>}
          {deal.location && <Chip>📍 {deal.location}</Chip>}
          <Chip>Source: {deal.source}</Chip>
        </div>

        {/* Thesis */}
        {deal.thesis && (
          <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <div className="mb-3 text-xs font-mono uppercase tracking-widest text-yellow-400">
              The thesis
            </div>
            <p className="text-lg leading-relaxed text-white/90">{deal.thesis}</p>
          </section>
        )}

        {/* Red flags + Growth signals grid */}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {Array.isArray(deal.red_flags) && deal.red_flags.length > 0 && (
            <section className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-6">
              <div className="mb-3 text-xs font-mono uppercase tracking-widest text-red-400">
                🚩 Red flags
              </div>
              <ul className="space-y-2 text-sm text-white/80">
                {deal.red_flags.map((flag, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-red-400">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {Array.isArray(deal.growth_signals) && deal.growth_signals.length > 0 && (
            <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-6">
              <div className="mb-3 text-xs font-mono uppercase tracking-widest text-emerald-400">
                📈 Growth signals
              </div>
              <ul className="space-y-2 text-sm text-white/80">
                {deal.growth_signals.map((sig, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-emerald-400">•</span>
                    <span>{sig}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* SEO body HTML (Haiku-generated) */}
        {deal.seo_body_html && (
          <section
            className="prose prose-invert mt-12 max-w-none prose-p:text-white/80 prose-p:leading-relaxed prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: deal.seo_body_html }}
          />
        )}

        {/* CTA — go to broker listing */}
        <section className="mt-16 rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-500/15 via-orange-500/10 to-red-500/10 p-8">
          <h2 className="text-2xl font-semibold text-white">Ready to make a move?</h2>
          <p className="mt-2 text-white/70">
            LamboApp surfaces the deal. The broker holds the intake. Do your own diligence —
            our fit score is a starting point, not a green light.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={deal.source_url}
              target="_blank"
              rel="noreferrer nofollow"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg transition hover:shadow-orange-500/60"
            >
              View listing on {hostFromUrl(deal.source_url)} →
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.08]"
            >
              ← See more deals
            </Link>
          </div>
        </section>

        {/* Disclaimer */}
        <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/40">
          <strong className="text-white/60">Not financial advice.</strong> LamboApp scrapes public
          broker listings, runs Claude Haiku across them, and surfaces the ones our rubric ranks
          highly. The thesis, red flags, and growth signals are AI-generated from the listing text
          alone. Numbers come from the broker (unverified). Do your own diligence, hire a lawyer,
          hire an accountant, don&rsquo;t wire until an LOI + QoE clears.
        </div>
      </article>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-white/70">
      {children}
    </span>
  );
}

function money(n: number | null): string {
  if (n === null || n === undefined || !Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function hostFromUrl(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ""); }
  catch { return "broker"; }
}
