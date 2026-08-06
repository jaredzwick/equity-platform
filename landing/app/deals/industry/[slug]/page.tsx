import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchDeals } from "@/lib/deals";
import { getSession } from "@/lib/session";
import { DealBrowseList } from "@/components/deals/DealBrowseList";
import { fmtCount, fmtMoney } from "@/lib/format";
import {
  INDUSTRIES,
  findIndustry,
  breadcrumbJsonLd,
  itemListJsonLd,
  faqJsonLd,
  medianAsking,
  medianRevenue,
  robotsFor,
  indexabilityFor,
  SITE_URL,
} from "@/lib/pseo";

// /deals/industry/[slug] — one indexable landing per industry facet.
// Enumerated in lib/pseo.ts so a new industry needs hand-authored copy
// before the route exists. That's intentional: the whole point of the
// pSEO strategy is that every page has enough unique substance to
// defend against Google's scaled-content-abuse policy.
//
// Rendering: server-side, revalidate hourly. Inventory is the primary
// content — the intro copy is a hand-authored ~120 words and every
// live stat (count, medians) comes from the actual API response so the
// prose matches what the visitor sees below.
//
// Indexability: <3 matching deals → robots noindex; 0 deals → notFound()
// (soft-404 avoidance). Sitemap generator must not include noindex
// pages — enforced by consulting indexabilityFor() there too.

export const revalidate = 3600;

export function generateStaticParams() {
  return INDUSTRIES.map((i) => ({ slug: i.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const industry = findIndustry(slug);
  if (!industry) {
    return { title: "Industry not found", robots: { index: false, follow: false } };
  }
  const url = `${SITE_URL}/deals/industry/${industry.slug}`;
  const response = await fetchDeals({
    industries: [industry.apiValue],
    sort: "fit",
    page_size: 20,
  });
  const total = response?.total ?? 0;
  const median = response?.items ? medianAsking(response.items) : undefined;
  // Live-data suffix on meta description keeps every industry's snippet
  // distinct without duplicating hand-authored prose. Skipped when the
  // page is thin so the copy doesn't lie ("225 listings" when we noindex).
  const suffix =
    total >= 3
      ? ` ${fmtCount(total)} live listings${median ? `, median ask ${fmtMoney(median)}` : ""}.`
      : "";
  return {
    title: industry.metaTitle,
    description: industry.metaDescription + suffix,
    alternates: { canonical: url },
    robots: robotsFor(total),
    openGraph: {
      title: industry.metaTitle,
      description: industry.metaDescription + suffix,
      url,
      type: "website",
      siteName: "LamboApp",
    },
    twitter: {
      card: "summary_large_image",
      title: industry.h1,
      description: industry.metaDescription,
    },
  };
}

export default async function IndustryPage({ params }: PageProps) {
  const { slug } = await params;
  const industry = findIndustry(slug);
  if (!industry) notFound();

  const [response, session] = await Promise.all([
    fetchDeals({
      industries: [industry.apiValue],
      sort: "fit",
      page_size: 20,
    }),
    getSession().catch(() => null),
  ]);

  const deals = response?.items ?? [];
  const total = response?.total ?? 0;
  const isAuth = Boolean(session?.login);
  const ix = indexabilityFor(total);
  if (ix === "notfound") notFound();

  const median = medianAsking(deals);
  const medianRev = medianRevenue(deals);
  const url = `${SITE_URL}/deals/industry/${industry.slug}`;

  const relatedIndustries = INDUSTRIES.filter((i) => i.slug !== industry.slug).slice(0, 4);

  const breadcrumb = breadcrumbJsonLd([
    { name: "LamboApp", url: SITE_URL },
    { name: "Deals", url: `${SITE_URL}/deals` },
    { name: industry.label, url },
  ]);
  const list = itemListJsonLd({ name: industry.h1, url, deals });
  const faq = faqJsonLd(industry.faq);

  // As-of freshness marker per GEO research (dated content is
  // preferentially cited by ChatGPT/Perplexity).
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(list) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
      <main className="mx-auto max-w-6xl px-4 py-8 pt-24 md:px-6 md:py-12 md:pt-32">
        {/* Breadcrumb */}
        <nav className="mb-6 text-xs text-white/40">
          <Link href="/" className="hover:text-white">LamboApp</Link>
          <span className="mx-2">/</span>
          <Link href="/deals" className="hover:text-white">Deals</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">{industry.label}</span>
        </nav>

        {/* Hero — H1 + live stat block */}
        <header className="mb-8 space-y-3">
          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">
            {industry.h1}
          </h1>
          {total >= 3 && (
            <p className="text-sm text-white/60 md:text-base">
              <span className="font-semibold text-white">
                {fmtCount(total)} live listings
              </span>{" "}
              {median && (
                <>
                  · median asking{" "}
                  <span className="font-semibold text-white">{fmtMoney(median)}</span>
                </>
              )}
              {medianRev && (
                <>
                  {" "}· median revenue{" "}
                  <span className="font-semibold text-white">{fmtMoney(medianRev)}</span>
                </>
              )}
              {" "}· as of {asOf}
            </p>
          )}
        </header>

        {/* TL;DR intro (GEO research: TL;DR + statistics improve LLM
            citation rate; hand-authored per industry to stay defensible
            under scaled-content-abuse policy) */}
        <section className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <p className="text-white/80 leading-relaxed">{industry.intro}</p>
        </section>

        {/* Live inventory — the primary content of the page */}
        {deals.length === 0 ? (
          <EmptyPanel label={industry.labelPlural} />
        ) : (
          <>
            <div className="mb-4 flex items-baseline justify-between px-1">
              <h2 className="text-lg font-semibold text-white">
                Live {industry.label} listings
              </h2>
              <Link
                href={`/deals?industries=${encodeURIComponent(industry.apiValue)}`}
                className="text-xs text-yellow-300 hover:text-yellow-200"
              >
                Open in full filter view →
              </Link>
            </div>
            <DealBrowseList deals={deals} isAuth={isAuth} />
          </>
        )}

        {/* Buyer notes (unique data per industry) */}
        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">
            What to look for when buying {industry.labelPlural}
          </h2>
          <ul className="mt-4 space-y-3 text-white/80">
            {industry.buyerNotes.map((note, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-yellow-400" />
                <span className="leading-relaxed">{note}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ (real questions, hand-authored answers — no dupes across
            industries; feeds FAQPage JSON-LD above) */}
        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">
            {industry.label} acquisition FAQ
          </h2>
          <div className="mt-4 space-y-4">
            {industry.faq.map((qa, i) => (
              <details
                key={i}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur"
              >
                <summary className="cursor-pointer text-sm font-semibold text-white">
                  {qa.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{qa.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Related-facet block — curated, not combinatorial. Both an
            internal-linking play and a reader utility. */}
        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">
            Browse other business types
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {relatedIndustries.map((r) => (
              <Link
                key={r.slug}
                href={`/deals/industry/${r.slug}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 backdrop-blur hover:border-yellow-400/40 hover:text-yellow-200"
              >
                {r.label} →
              </Link>
            ))}
            <Link
              href="/deals"
              className="rounded-full border border-yellow-400/30 bg-yellow-400/[0.05] px-4 py-2 text-sm text-yellow-200 backdrop-blur hover:border-yellow-400/60"
            >
              All deals →
            </Link>
          </div>
        </section>

        {!isAuth && deals.length > 0 && <SignupNudge industry={industry.label} />}
      </main>
    </>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur">
      <h2 className="text-lg font-bold text-white">
        No live {label} listings right now.
      </h2>
      <p className="mt-2 text-sm text-white/60">
        We scrape 30+ brokers hourly — new inventory posts throughout the day.
        Sign up to get texted when a matching listing appears, or{" "}
        <Link href="/deals" className="text-yellow-300 hover:text-yellow-200">
          browse all industries
        </Link>
        .
      </p>
    </div>
  );
}

function SignupNudge({ industry }: { industry: string }) {
  return (
    <div className="mt-16 rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.05] p-6 text-center backdrop-blur">
      <p className="text-lg font-semibold text-white">
        Get new {industry} listings texted to you
      </p>
      <p className="mt-2 text-sm text-white/60">
        Drop your name and number. We&rsquo;ll text you when a new {industry}{" "}
        listing hits our scoring threshold.
      </p>
      <Link
        href="/signup"
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02]"
      >
        Get on the list →
      </Link>
    </div>
  );
}
