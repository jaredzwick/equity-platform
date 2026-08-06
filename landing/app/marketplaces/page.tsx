import type { Metadata } from "next";
import Link from "next/link";
import { COMPETITORS } from "@/lib/compare-data";
import { INDUSTRIES, PRICE_BUCKETS, breadcrumbJsonLd, SITE_URL } from "@/lib/pseo";

// /marketplaces — hub page: overview of every major broker/marketplace
// we scrape + a comparison link to each. Ranks for queries like
// "business for sale marketplaces", "alternatives to bizbuysell",
// "best broker for online business acquisition". Also serves as an
// internal-linking hub feeding /compare/[slug] pages and back to /deals.
//
// This page is a legit reference — every entry is a real broker in our
// source set. If we drop a source (or add one), update COMPETITORS.

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Business-for-sale marketplaces — 2026 comparison hub",
  description:
    "Every major business-for-sale marketplace and broker, compared honestly. BizBuySell, Flippa, Empire Flippers, Acquire, Quiet Light — fees, deal size, vetting, buyer workflow.",
  alternates: { canonical: `${SITE_URL}/marketplaces` },
  openGraph: {
    title: "Business-for-sale marketplaces — 2026 comparison hub",
    description:
      "Compare BizBuySell, Flippa, Empire Flippers, Acquire, Quiet Light — fees, deal size, vetting, workflow. Free, no email gate.",
    url: `${SITE_URL}/marketplaces`,
    siteName: "LamboApp",
    type: "website",
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  "smb-broker": "SMB marketplaces",
  "online-broker": "Online-business marketplaces",
  "curated-marketplace": "Curated / vetted marketplaces",
};

export default function MarketplacesPage() {
  const breadcrumb = breadcrumbJsonLd([
    { name: "LamboApp", url: SITE_URL },
    { name: "Marketplaces", url: `${SITE_URL}/marketplaces` },
  ]);

  const grouped = COMPETITORS.reduce<
    Record<string, typeof COMPETITORS>
  >((acc, c) => {
    (acc[c.category] ||= []).push(c);
    return acc;
  }, {});

  const asOf = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 pt-24 md:px-6 md:py-12 md:pt-32">
        <nav className="mb-6 text-xs text-white/40">
          <Link href="/" className="hover:text-white">LamboApp</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">Marketplaces</span>
        </nav>

        <header className="mb-10 space-y-3">
          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">
            Business-for-sale marketplaces — the honest comparison hub
          </h1>
          <p className="text-sm text-white/40">
            Reviewed {asOf} · {COMPETITORS.length} platforms covered
          </p>
        </header>

        <section className="mb-12 rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.05] p-6 backdrop-blur">
          <div className="text-xs font-mono uppercase tracking-widest text-yellow-300">
            TL;DR
          </div>
          <p className="mt-2 text-white/90 leading-relaxed">
            There is no single &ldquo;best&rdquo; marketplace — each fits a
            different buyer profile and deal size. Main-street SMB buyers go
            to <strong>BizBuySell</strong>. Sub-$5M online-business buyers
            split between <strong>Empire Flippers</strong> (vetted, premium
            multiples), <strong>Acquire.com</strong> (SaaS-heavy, founder
            intros), and <strong>Flippa</strong> (broadest but noisiest).
            $500k-plus online deals often go through <strong>Quiet
            Light</strong> (advisor-led). LamboApp indexes all of them, adds
            an AI fit score to every listing, and puts them in one ranked
            view so you don&rsquo;t browse five marketplaces separately.
          </p>
        </section>

        {Object.entries(grouped).map(([cat, list]) => (
          <section key={cat} className="mb-14">
            <h2 className="mb-6 text-xl font-semibold text-white">
              {CATEGORY_LABEL[cat] || cat}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((c) => (
                <article
                  key={c.slug}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition-colors hover:border-yellow-400/40"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-bold text-white">{c.name}</h3>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer nofollow"
                      className="text-xs text-white/40 hover:text-white/70"
                    >
                      {new URL(c.url).host.replace(/^www\./, "")} ↗
                    </a>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/70">
                    {c.tagline}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/compare/${c.slug}`}
                      className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-3 py-1.5 text-xs font-semibold text-black"
                    >
                      LamboApp vs {c.name} →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}

        {/* Cross-links: internal-linking hub for pSEO industry + price
            landing pages. Curated, not combinatorial — the same shape
            Google rewards on aggregator sites. */}
        <section className="mt-16 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-4 text-xl font-semibold text-white">By industry</h2>
            <div className="flex flex-wrap gap-2">
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
            <h2 className="mb-4 text-xl font-semibold text-white">By price</h2>
            <div className="flex flex-wrap gap-2">
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
      </main>
    </>
  );
}
