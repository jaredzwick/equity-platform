import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchDeals } from "@/lib/deals";
import { getSession } from "@/lib/session";
import { DealBrowseList } from "@/components/deals/DealBrowseList";
import { fmtCount, fmtMoney } from "@/lib/format";
import {
  PRICE_BUCKETS,
  findPriceBucket,
  breadcrumbJsonLd,
  itemListJsonLd,
  medianAsking,
  medianRevenue,
  robotsFor,
  indexabilityFor,
  SITE_URL,
} from "@/lib/pseo";

// /deals/under/[bucket] — price-bucket landings for high-intent queries
// like "businesses for sale under 500k". Buckets are enumerated in
// lib/pseo.ts to keep the URL space finite and defensible.
//
// Same indexability rules as industry pages: 0 → 404, 1-2 → noindex,
// ≥3 → indexed. Live-stat interpolation makes each page distinct even
// though the buckets share structural boilerplate.

export const revalidate = 3600;

export function generateStaticParams() {
  return PRICE_BUCKETS.map((b) => ({ slug: b.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const bucket = findPriceBucket(slug);
  if (!bucket) {
    return { title: "Price range not found", robots: { index: false, follow: false } };
  }
  const url = `${SITE_URL}/deals/under/${bucket.slug}`;
  const response = await fetchDeals({
    asking_max: bucket.askingMax,
    sort: "fit",
    page_size: 20,
  });
  const total = response?.total ?? 0;
  const median = response?.items ? medianAsking(response.items) : undefined;
  const suffix =
    total >= 3
      ? ` ${fmtCount(total)} live listings${median ? `, median ask ${fmtMoney(median)}` : ""}.`
      : "";
  return {
    title: bucket.metaTitle,
    description: bucket.metaDescription + suffix,
    alternates: { canonical: url },
    robots: robotsFor(total),
    openGraph: {
      title: bucket.metaTitle,
      description: bucket.metaDescription + suffix,
      url,
      type: "website",
      siteName: "LamboApp",
    },
    twitter: {
      card: "summary_large_image",
      title: bucket.h1,
      description: bucket.metaDescription,
    },
  };
}

export default async function PriceBucketPage({ params }: PageProps) {
  const { slug } = await params;
  const bucket = findPriceBucket(slug);
  if (!bucket) notFound();

  const [response, session] = await Promise.all([
    fetchDeals({
      asking_max: bucket.askingMax,
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
  const url = `${SITE_URL}/deals/under/${bucket.slug}`;

  // Curated cross-links: adjacent buckets + a couple of industries.
  // Not a mesh of every combination — that reads as a link farm.
  const currentIx = PRICE_BUCKETS.findIndex((b) => b.slug === bucket.slug);
  const adjacent = [
    PRICE_BUCKETS[currentIx - 1],
    PRICE_BUCKETS[currentIx + 1],
  ].filter((b): b is (typeof PRICE_BUCKETS)[number] => Boolean(b));

  const breadcrumb = breadcrumbJsonLd([
    { name: "LamboApp", url: SITE_URL },
    { name: "Deals", url: `${SITE_URL}/deals` },
    { name: bucket.label, url },
  ]);
  const list = itemListJsonLd({ name: bucket.h1, url, deals });

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
      <main className="mx-auto max-w-6xl px-4 py-8 pt-24 md:px-6 md:py-12 md:pt-32">
        <nav className="mb-6 text-xs text-white/40">
          <Link href="/" className="hover:text-white">LamboApp</Link>
          <span className="mx-2">/</span>
          <Link href="/deals" className="hover:text-white">Deals</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">{bucket.label}</span>
        </nav>

        <header className="mb-8 space-y-3">
          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">
            {bucket.h1}
          </h1>
          {total >= 3 && (
            <p className="text-sm text-white/60 md:text-base">
              <span className="font-semibold text-white">
                {fmtCount(total)} live listings
              </span>{" "}
              {median && (
                <>· median asking{" "}
                  <span className="font-semibold text-white">{fmtMoney(median)}</span>
                </>
              )}
              {medianRev && (
                <>{" "}· median revenue{" "}
                  <span className="font-semibold text-white">{fmtMoney(medianRev)}</span>
                </>
              )}
              {" "}· as of {asOf}
            </p>
          )}
        </header>

        <section className="mb-10 rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
          <p className="text-white/80 leading-relaxed">{bucket.intro}</p>
        </section>

        {deals.length === 0 ? (
          <EmptyPanel label={bucket.label} />
        ) : (
          <>
            <div className="mb-4 flex items-baseline justify-between px-1">
              <h2 className="text-lg font-semibold text-white">
                Live listings {bucket.label}
              </h2>
              <Link
                href={`/deals?asking_max=${bucket.askingMax}&sort=fit`}
                className="text-xs text-yellow-300 hover:text-yellow-200"
              >
                Open in full filter view →
              </Link>
            </div>
            <DealBrowseList deals={deals} isAuth={isAuth} />
          </>
        )}

        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">Browse other price ranges</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {adjacent.map((a) => (
              <Link
                key={a.slug}
                href={`/deals/under/${a.slug}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 backdrop-blur hover:border-yellow-400/40 hover:text-yellow-200"
              >
                Under {a.label.replace("under ", "")} →
              </Link>
            ))}
            <Link
              href="/deals"
              className="rounded-full border border-yellow-400/30 bg-yellow-400/[0.05] px-4 py-2 text-sm text-yellow-200 backdrop-blur hover:border-yellow-400/60"
            >
              All prices →
            </Link>
          </div>
        </section>

        {!isAuth && deals.length > 0 && (
          <div className="mt-16 rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.05] p-6 text-center backdrop-blur">
            <p className="text-lg font-semibold text-white">
              Get new {bucket.label} listings texted to you
            </p>
            <p className="mt-2 text-sm text-white/60">
              Drop your name and number. We&rsquo;ll text you when a new
              listing matches your price range.
            </p>
            <Link
              href="/signup"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.02]"
            >
              Get on the list →
            </Link>
          </div>
        )}
      </main>
    </>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur">
      <h2 className="text-lg font-bold text-white">
        No live listings {label} right now.
      </h2>
      <p className="mt-2 text-sm text-white/60">
        Sign up to get texted when new inventory hits, or{" "}
        <Link href="/deals" className="text-yellow-300 hover:text-yellow-200">
          browse all deals
        </Link>
        .
      </p>
    </div>
  );
}
