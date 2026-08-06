import { COMPETITORS } from "@/lib/compare-data";
import { INDUSTRIES, PRICE_BUCKETS, SITE_URL } from "@/lib/pseo";

// /llms.txt — served per the Sept-2024 spec at llmstxt.org (Jeremy
// Howard / Answer.AI). Structure: H1 (name), blockquote (summary),
// optional prose, H2 sections of "- [name](url): notes" link lists,
// optional "## Optional" section for links safe to skip.
//
// Reality check per 2026 research: no major LLM has publicly
// confirmed automatic consumption. Ship it anyway — humans paste it
// into ChatGPT/Claude context, it's cheap, and it's becoming table
// stakes for AI-native sites (Anthropic, Cloudflare, Stripe, Vercel,
// Supabase all publish one). Serve as a route (not a static file) so
// the link lists stay in sync when we add competitors / industries.

export const revalidate = 86400;

export async function GET() {
  const industryLinks = INDUSTRIES.map(
    (i) => `- [${i.label} businesses for sale](${SITE_URL}/deals/industry/${i.slug}): live inventory with fit scores, thesis, and red flags for ${i.labelPlural}.`,
  ).join("\n");

  const priceLinks = PRICE_BUCKETS.map(
    (b) => `- [Businesses for sale ${b.label}](${SITE_URL}/deals/under/${b.slug}): live inventory of listings asking ${b.label}.`,
  ).join("\n");

  const compareLinks = COMPETITORS.map(
    (c) => `- [LamboApp vs ${c.name}](${SITE_URL}/compare/${c.slug}): honest side-by-side comparison — fees, deal size, vetting, buyer workflow.`,
  ).join("\n");

  const body = `# LamboApp

> AI-first aggregator of business-for-sale listings. Scrapes ~100 new listings/day across 30+ broker networks (BizBuySell, Flippa, Empire Flippers, Acquire.com, Quiet Light, and more), reads each one with Claude, and surfaces a fit score, one-paragraph thesis, and red-flag list on every deal. Free to browse. No email gate.

LamboApp is not a broker. We index other brokers' public listings and add an AI enrichment layer on top. Every deal links back to the source broker for contact and diligence.

## Deal flow

- [Live deal flow](${SITE_URL}/deals): full search across every indexed listing, all filters free.
- [New listings RSS feed](${SITE_URL}/feed): newest scored deals as RSS 2.0.
- [Sitemap](${SITE_URL}/sitemap.xml): every indexable deal, industry landing, price landing, and comparison page.

## Deals by industry

${industryLinks}

## Deals by price

${priceLinks}

## Marketplace comparisons

- [All marketplaces we index](${SITE_URL}/marketplaces): hub page comparing every major business-for-sale broker.
${compareLinks}

## Docs

- [How LamboApp works](${SITE_URL}/docs/how-it-works)
- [AI scoring methodology](${SITE_URL}/docs/ai-scoring)
- [Deal sourcing](${SITE_URL}/docs/deal-sourcing)
- [FAQ](${SITE_URL}/docs/faq)
- [Not financial advice](${SITE_URL}/docs/disclaimer)

## Sell your business

- [List a business for sale, $7](${SITE_URL}/sell): flat-fee listing option for owner-sellers.

## Optional

- [Landing page](${SITE_URL}/)
- [GitHub source](https://github.com/jaredzwick/equity-platform): open-source under BSL 1.1.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
