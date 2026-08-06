import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  COMPETITORS,
  findCompetitor,
  LAMBO_SELF_DESCRIPTION,
} from "@/lib/compare-data";
import { breadcrumbJsonLd, faqJsonLd, SITE_URL } from "@/lib/pseo";

// /compare/[competitor] — side-by-side comparison pages against major
// business-for-sale marketplaces (BizBuySell, Flippa, Empire Flippers,
// Acquire, Quiet Light). Targets high-intent buyer queries:
// "flippa vs empire flippers", "alternative to bizbuysell", etc.
//
// Structure follows the GEO-optimized template documented in the
// research report (Aggarwal et al. KDD 2024, plus the Ahrefs/Semrush
// AI Overviews studies): TL;DR / direct-answer paragraph at the top,
// side-by-side table with 6-10 rows, pros/cons + "choose X if"
// bullets, verdict paragraph, FAQ block with FAQPage JSON-LD.
//
// Editorial policy: every "choose them if" section is genuinely honest
// — LLMs preferentially cite comparison pages that call their own
// weaknesses. See lib/compare-data.ts for the source of truth.

export const revalidate = 86400; // Daily — data changes rarely.

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const c = findCompetitor(slug);
  if (!c) {
    return { title: "Comparison not found", robots: { index: false, follow: false } };
  }
  const url = `${SITE_URL}/compare/${c.slug}`;
  const title = `LamboApp vs ${c.name} — honest comparison for buyers`;
  const description = `${c.name} vs LamboApp: fees, deal size, vetting, AI enrichment, buyer workflow. Honest side-by-side with "choose them if" recommendations.`;
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
  };
}

export default async function ComparePage({ params }: PageProps) {
  const { slug } = await params;
  const c = findCompetitor(slug);
  if (!c) notFound();

  const url = `${SITE_URL}/compare/${c.slug}`;
  const breadcrumb = breadcrumbJsonLd([
    { name: "LamboApp", url: SITE_URL },
    { name: "Compare", url: `${SITE_URL}/marketplaces` },
    { name: `vs ${c.name}`, url },
  ]);
  const faq = faqJsonLd(c.faq);

  // Related competitors — everything except the current one, capped at 4.
  const related = COMPETITORS.filter((x) => x.slug !== c.slug).slice(0, 4);

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
      />
      <article className="mx-auto max-w-4xl px-6 py-16 md:py-24">
        <nav className="mb-8 text-xs text-white/40">
          <Link href="/" className="hover:text-white">LamboApp</Link>
          <span className="mx-2">/</span>
          <Link href="/marketplaces" className="hover:text-white">Marketplaces</Link>
          <span className="mx-2">/</span>
          <span className="text-white/60">vs {c.name}</span>
        </nav>

        <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
          LamboApp vs {c.name}
        </h1>
        <p className="mt-3 text-sm text-white/40">
          Comparison methodology · last reviewed {asOf}
        </p>

        {/* TL;DR — first 60 words, distinctive class per GEO research */}
        <div className="tldr mt-8 rounded-2xl border border-yellow-400/30 bg-yellow-400/[0.06] p-6 backdrop-blur">
          <div className="text-xs font-mono uppercase tracking-widest text-yellow-300">
            TL;DR
          </div>
          <p className="mt-2 text-white/90 leading-relaxed">{c.verdict}</p>
        </div>

        {/* What each thing is */}
        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold text-white">What is LamboApp?</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              {LAMBO_SELF_DESCRIPTION}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-lg font-semibold text-white">What is {c.name}?</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{c.tagline}</p>
          </div>
        </section>

        {/* Side-by-side comparison table — the single most-cited element */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-white">
            LamboApp vs {c.name} — side-by-side
          </h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr>
                  <th className="p-4 text-left font-semibold text-white/60">Dimension</th>
                  <th className="p-4 text-left font-semibold text-yellow-300">LamboApp</th>
                  <th className="p-4 text-left font-semibold text-white">{c.name}</th>
                </tr>
              </thead>
              <tbody>
                {c.rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <td className="p-4 font-medium text-white/60">{row.label}</td>
                    <td className="p-4 text-white/90">{row.lambo}</td>
                    <td className="p-4 text-white/90">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* "Choose X if" bullets */}
        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 p-6">
            <h3 className="text-lg font-semibold text-yellow-300">Choose LamboApp if</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              {c.chooseLamboIf.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-yellow-400">✓</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h3 className="text-lg font-semibold text-white">Choose {c.name} if</h3>
            <ul className="mt-4 space-y-3 text-sm text-white/80">
              {c.chooseThemIf.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-white/40">→</span>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">
            LamboApp vs {c.name} — FAQ
          </h2>
          <div className="mt-4 space-y-4">
            {c.faq.map((qa, i) => (
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

        {/* Related comparisons — internal linking */}
        <section className="mt-14">
          <h2 className="text-xl font-semibold text-white">Other marketplace comparisons</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/compare/${r.slug}`}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/80 backdrop-blur hover:border-yellow-400/40 hover:text-yellow-200"
              >
                vs {r.name} →
              </Link>
            ))}
            <Link
              href="/marketplaces"
              className="rounded-full border border-yellow-400/30 bg-yellow-400/[0.05] px-4 py-2 text-sm text-yellow-200 backdrop-blur hover:border-yellow-400/60"
            >
              All marketplaces →
            </Link>
          </div>
        </section>

        {/* Try LamboApp CTA */}
        <section className="mt-16 rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-500/15 via-orange-500/10 to-red-500/10 p-8">
          <h2 className="text-2xl font-semibold text-white">
            See {c.name} listings — plus every other broker — ranked
          </h2>
          <p className="mt-2 text-white/70">
            LamboApp is free to browse. No email gate. Every deal scored, every
            listing linkable back to the source broker.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/deals"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg transition hover:shadow-orange-500/60"
            >
              Browse the deal flow →
            </Link>
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer nofollow"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.08]"
            >
              Visit {c.name} →
            </a>
          </div>
        </section>
      </article>
    </>
  );
}
