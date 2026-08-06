// Shared helpers for programmatic-SEO landing pages (industry, price,
// eventually location). One goal: keep every generated page defensible
// against Google's scaled-content-abuse + doorway-pages policies.
// Rules encoded here (per research 2026-08-06 against Google Search
// Central docs at developers.google.com/search/docs/essentials/spam-policies
// and the March-2024 core+spam update guidance):
//   1. 0 deals matching → 404 (soft-404 avoidance).
//   2. 1–2 deals → render the page but robots.noindex; not sitemapped.
//   3. ≥3 deals → indexable; unique H1/title/meta/intro that interpolates
//      the live count + median asking price + representative deal names.
//   4. Every page carries ItemList + BreadcrumbList JSON-LD only.
//      Product/Offer/AggregateRating are AVOIDED on third-party listings
//      because we're not the seller (would trigger "Spammy structured
//      markup" manual actions per Google's Product SD guidelines).
//   5. Related-facet cross-links are curated (max ~6), not combinatorial.
//   6. Sitemap generation defers to canIndex() so noindex pages are never
//      listed.

import type { Deal } from "@/lib/deals-shared";

export const SITE_URL = "https://www.lamboapp.com";

// Minimum deal count for a page to be indexed. Below this we still
// render (so someone linked to it doesn't hit a 404) but the page is
// noindex and won't appear in the sitemap.
export const INDEX_MIN_DEALS = 3;

export type Indexability = "index" | "noindex" | "notfound";

export function indexabilityFor(count: number): Indexability {
  if (count <= 0) return "notfound";
  if (count < INDEX_MIN_DEALS) return "noindex";
  return "index";
}

// -------- Industry facet --------

// Every industry rendered is enumerated here. New industries need an
// entry (with hand-authored intro copy) before generateStaticParams
// will emit them — this is intentional to keep the pages defensible.
// Values match the Haiku enricher's `normalized_industry` output;
// verify with a corpus scan before adding.
export type IndustryDef = {
  slug: string; // URL slug
  apiValue: string; // exact match against Deal.normalized_industry
  label: string; // "SaaS" — used in H1/title
  labelPlural: string; // "SaaS businesses" — used in prose
  h1: string;
  metaTitle: string;
  metaDescription: string; // ~140 chars; count/median get appended if desired
  intro: string; // ~120-word intro paragraph. NOT auto-generated.
  buyerNotes: string[]; // 3–4 buyer-side "what to look for" bullets.
  faq: { q: string; a: string }[];
};

export const INDUSTRIES: IndustryDef[] = [
  {
    slug: "saas",
    apiValue: "saas",
    label: "SaaS",
    labelPlural: "SaaS businesses",
    h1: "SaaS businesses for sale",
    metaTitle: "SaaS businesses for sale — fit-scored & thesis-summarized",
    metaDescription:
      "Every live SaaS listing across 30+ brokers, read by Claude, scored for fit, summarized in one paragraph. Filter by revenue, SDE multiple, and buyer notes.",
    intro:
      "SaaS acquisitions live and die on churn, gross margin, and customer concentration — three numbers most broker listings bury. LamboApp pulls every live SaaS listing across major broker networks (Empire Flippers, Flippa, Acquire.com, Quiet Light, MicroAcquisitions, and others), reads the listing with Claude, and surfaces the SDE multiple, red flags, and growth signals in a single view. Below is the live inventory — every deal has a fit score (0–10), a one-paragraph thesis, and a link to the original broker page so you can go straight to LOI. No email gate to browse.",
    buyerNotes: [
      "MRR + churn: any listing without a churn number is a red flag — assume it's above 5%/mo until proven otherwise.",
      "Customer concentration: if the top 3 customers are >30% of revenue, the multiple should be discounted.",
      "Migration risk: is the codebase readable? Are docs current? Founder-only tribal knowledge shreds valuations post-close.",
      "Founder time: SDE assumes an owner-operator. Adjust for a hired CEO if you plan to be absentee.",
    ],
    faq: [
      {
        q: "What's a fair SDE multiple for a small SaaS?",
        a: "Micro-SaaS (<$500k ARR) typically transacts at 2.5–4× SDE; mid-market SaaS ($500k–$5M ARR) at 4–6×; anything higher usually reflects a strategic buyer or unusually clean unit economics. LamboApp's `sde_multiple_computed` field lets you sort the corpus and see where a given deal falls versus the median.",
      },
      {
        q: "Which brokers list SaaS businesses?",
        a: "The largest US-facing sources are Empire Flippers, Flippa, Acquire.com (formerly MicroAcquire), Quiet Light Brokerage, FE International, and MicroAcquisitions. LamboApp scrapes all of them plus regional brokers and surfaces every live listing in one search.",
      },
      {
        q: "Do you verify the numbers on the listing?",
        a: "No — the revenue, profit, and MRR come straight from the broker page. Our AI enrichment ranks and summarizes but does not audit. Always require a quality-of-earnings review before wiring.",
      },
    ],
  },
  {
    slug: "ecommerce",
    apiValue: "ecommerce",
    label: "E-commerce",
    labelPlural: "e-commerce businesses",
    h1: "E-commerce businesses for sale",
    metaTitle: "E-commerce businesses for sale — Shopify, FBA, DTC",
    metaDescription:
      "Live inventory across 30+ brokers. Every Shopify, Amazon FBA, and DTC listing scored for fit, with red flags on ad dependency, supplier risk, and margin.",
    intro:
      "E-commerce acquisitions look easy on the surface — SDE + inventory, plug in a new operator, print money — but the failure modes are specific: ad-account concentration, supplier lock-in, seasonal working-capital swings, and brand-safety exposure on marketplaces. LamboApp pulls every live e-commerce listing from Empire Flippers, Flippa, Quiet Light, and the smaller broker networks, then has Claude read each one for the risks that don't show up in the P&L. Below is the current inventory. Every listing has a fit score, a one-paragraph thesis, red flags, and a direct link to the broker.",
    buyerNotes: [
      "Ad channel concentration: >70% traffic from paid Meta is a valuation discount, not a growth story.",
      "Inventory basis: is asking price inclusive or on top of inventory? A $500k asking with $200k inventory is really $700k enterprise value.",
      "Supplier risk: single-source manufacturing (especially in China) needs a diligence line item, not a footnote.",
      "Amazon-only brands: check the Brand Registry status, IP ownership, and account health rating before signing.",
    ],
    faq: [
      {
        q: "What's a typical multiple for an e-commerce business?",
        a: "DTC e-commerce transacts at 2.5–4× SDE for sub-$1M SDE brands; Amazon FBA brands typically 3–5× SDE; content-driven e-commerce (with organic traffic moats) can hit 4–6×. Multiples compressed hard in 2023–2024 and have partially recovered.",
      },
      {
        q: "How do you flag ad-dependent listings?",
        a: "Claude reads the marketing-channel breakdown in the listing prospectus (when disclosed) and flags any brand where paid ads are the majority of traffic without a compensating retention/repeat-purchase story. Look for the 'ad concentration' red flag on the deal detail page.",
      },
      {
        q: "Can you filter to Shopify vs FBA only?",
        a: "Not yet as a dedicated facet — use the search bar with `shopify` or `amazon fba` and combine with the E-commerce industry filter. A first-class facet is on the roadmap.",
      },
    ],
  },
  {
    slug: "content-site",
    apiValue: "content_site",
    label: "Content site",
    labelPlural: "content sites",
    h1: "Content sites & blogs for sale",
    metaTitle: "Content sites & blogs for sale — organic-traffic assets",
    metaDescription:
      "Every live content-site listing across the top brokers. Fit-scored with red flags on HCU exposure, backlink profile, and monetization concentration.",
    intro:
      "Content-site acquisitions were the darling of the 2019–2022 acquisition-entrepreneur boom, then Google's Helpful Content Update and successive core updates torched valuations for anyone caught relying on thin AI-templated pages. The surviving deals are the ones with genuine topical authority, real editorial history, and diversified monetization (display + affiliate + info product). LamboApp pulls every live content-site listing across the major broker networks, reads each one, and flags the HCU risk, backlink concentration, and traffic-source dependency before you commit. Below is the current inventory.",
    buyerNotes: [
      "HCU exposure: check the last 12 months of traffic. Any site that lost >40% in the March 2024 or subsequent updates is a value trap.",
      "Backlink profile: how many referring domains are private-blog-network junk? Ahrefs Domain Rating without qualitative review is a lie.",
      "Monetization mix: display-ad-only sites live and die on Ezoic/Mediavine RPMs. A diversified mix (affiliate + product) is worth a materially higher multiple.",
      "Editorial history: is there a real content calendar? Or was this a 'AI-generated pSEO' play that Google will demote further?",
    ],
    faq: [
      {
        q: "What's a fair multiple for a content site in 2026?",
        a: "Post-HCU, expect 2–3× SDE for display-ad-heavy sites and 3–4× for diversified content brands with organic search moats. Anything above 4× typically reflects rare qualities (owner brand, product tie-in, or an unusually clean traffic history).",
      },
      {
        q: "How do you detect HCU-damaged sites?",
        a: "LamboApp's enrichment flags sites where the listing prospectus mentions traffic drops in 2023–2025 or where the broker discloses month-over-month declines. It doesn't run its own SEO audit — you should still pull Ahrefs and SimilarWeb before signing an LOI.",
      },
      {
        q: "Are AI-generated content sites worth anything?",
        a: "In our view, no — but the market disagrees at the low end. Sub-$50k listings with obvious AI-templated content still transact. LamboApp surfaces them but tends to score them low on fit.",
      },
    ],
  },
  {
    slug: "agency",
    apiValue: "agency",
    label: "Agency",
    labelPlural: "agencies",
    h1: "Agencies for sale — digital, marketing, and services",
    metaTitle: "Agencies for sale — marketing, dev, and services shops",
    metaDescription:
      "Live listings of digital, marketing, and services agencies. Fit-scored, with red flags on client concentration, founder dependency, and retainer mix.",
    intro:
      "Agencies are the most owner-operator-dependent asset class we track. Multiples reflect that — 1.5–3× SDE is the norm, and anything higher usually requires long-tenured retainer clients, a repeatable delivery process, and a second-in-command who won't leave post-close. LamboApp pulls every live agency listing across brokers and reads each one for the two questions that matter most: what percentage of revenue is retainer versus project, and how many hours does the founder still work in the business. Below is the current inventory.",
    buyerNotes: [
      "Retainer mix: aim for >60% retainer revenue on 12-month or longer contracts. Project shops don't sustain multiples.",
      "Client concentration: any client above 20% of revenue is a discount to the multiple. Above 40% is a walk-away.",
      "Founder role: if the founder is selling and still doing delivery, you're buying a job. Adjust SDE to a hired equivalent.",
      "Team retention: what's the plan to keep the top 2–3 delivery leads? A 30-day earn-out is not a retention plan.",
    ],
    faq: [
      {
        q: "What multiple should I pay for an agency?",
        a: "1.5–3× SDE is the honest range for a sub-$5M-revenue agency. 3–4× requires either a specialized vertical, unusually sticky retainers, or a genuine second-in-command. Anything above that is a strategic buyer or a bad deal.",
      },
      {
        q: "How do you flag founder-dependent agencies?",
        a: "Our enrichment looks at the disclosed staff count vs. revenue and flags cases where the founder appears in every case study or is the only named senior. If the listing doesn't disclose a hired-CEO adjustment, we compute one and surface it as a red flag.",
      },
    ],
  },
  {
    slug: "service-business",
    apiValue: "service_business",
    label: "Service business",
    labelPlural: "service businesses",
    h1: "Service businesses for sale",
    metaTitle: "Service businesses for sale — trades, home services & more",
    metaDescription:
      "Live inventory of service-business listings — trades, home services, professional services. Fit-scored with red flags on licensing and staff.",
    intro:
      "The 'boring business' thesis — HVAC, plumbing, landscaping, cleaning, laundromats — has driven a lot of acquisition-entrepreneur money in the last five years, and for good reason: predictable cash flow, real-world moats, and multiples that haven't been bid up by strategic tech buyers. LamboApp aggregates service-business listings across brokers and flags the specifics that matter: license transferability, staff retention, and equipment condition. Below is the current inventory. Note that many of the best service-business deals never hit online brokers — this is the discoverable subset.",
    buyerNotes: [
      "License transfer: some trades require the buyer to hold the qualifying license personally. Confirm before LOI, not after.",
      "Staff & tenure: crew stability is 60% of the business value. Ask for tenure by role, not just headcount.",
      "Equipment condition & age: capex needs in year 1 can eat the entire SDE. Get a mechanic to inspect anything you'd depreciate.",
      "Recurring vs one-time: HVAC service contracts are gold; one-time install revenue is not.",
    ],
    faq: [
      {
        q: "Why are service businesses cheaper than SaaS?",
        a: "Multiples reflect risk-adjusted operator effort. A service business needs a full-time operator in a specific geography with specific licenses; SaaS can be run from anywhere with a laptop. The asset class trade-off shows up in the SDE multiple — 2–4× vs 4–6×.",
      },
      {
        q: "Can I use SBA financing for a service-business acquisition?",
        a: "Yes — service businesses are the SBA-7(a) bread-and-butter. Most brokers can point you to lenders who pre-qualify deals. LamboApp doesn't originate loans; check with a broker like Guidant or Live Oak.",
      },
    ],
  },
];

export function findIndustry(slug: string): IndustryDef | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

// -------- Price-bucket facet --------

// Buyer-intent phrase — matches queries like "businesses for sale
// under 500k". Every bucket is a single upper-bound; lower bound is 0.
// Fewer, meaningful buckets > combinatorial permutations.
export type PriceBucketDef = {
  slug: string; // URL slug, e.g. "under-500k"
  askingMax: number; // API filter value
  label: string; // "under $500k"
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
};

export const PRICE_BUCKETS: PriceBucketDef[] = [
  {
    slug: "50k",
    askingMax: 50_000,
    label: "under $50k",
    h1: "Businesses for sale under $50,000",
    metaTitle: "Businesses for sale under $50k — small-ticket acquisitions",
    metaDescription:
      "Live listings of businesses asking under $50,000. Micro-acquisitions, side-project buys, and starter deals — every one fit-scored and thesis-summarized.",
    intro:
      "Sub-$50k listings are typically micro-SaaS, small content sites, or hobbyist e-commerce shops. Realistic buyer expectations: the seller is often exiting because the business no longer justifies their time, not because it's failing — but that also means the growth trajectory usually needs owner-operator focus to reignite. LamboApp surfaces every live listing under $50k across the major brokers and flags whether the price reflects genuine value or a distress signal.",
  },
  {
    slug: "100k",
    askingMax: 100_000,
    label: "under $100k",
    h1: "Businesses for sale under $100,000",
    metaTitle: "Businesses for sale under $100k — small acquisitions",
    metaDescription:
      "Live inventory of businesses asking under $100,000. Small-ticket SaaS, e-commerce, and content sites — fit-scored with a thesis and red flags per deal.",
    intro:
      "The sub-$100k tier is where most first-time acquisition entrepreneurs enter the market. Cash-only deals, no SBA paperwork, close in weeks not months. The tradeoff: multiples are compressed because the buyer pool is deep, and the businesses often depend heavily on a single operator's tacit knowledge. LamboApp surfaces every live listing under $100k and flags the operator-dependency risk on each one.",
  },
  {
    slug: "250k",
    askingMax: 250_000,
    label: "under $250k",
    h1: "Businesses for sale under $250,000",
    metaTitle: "Businesses for sale under $250k — starter acquisitions",
    metaDescription:
      "Every live listing asking under $250,000, across 30+ brokers. Fit-scored, thesis-summarized, red-flagged. Filter by industry and revenue.",
    intro:
      "The $100k–$250k range is a sweet spot for full-time operators buying their first business: SBA-financeable (usually 10%–15% down), large enough to support a real salary, small enough to buy without a full LBO stack. LamboApp aggregates every live listing in this range across the major broker networks and flags the deals where the asking price versus SDE multiple actually makes sense.",
  },
  {
    slug: "500k",
    askingMax: 500_000,
    label: "under $500k",
    h1: "Businesses for sale under $500,000",
    metaTitle: "Businesses for sale under $500k — SBA-financeable deals",
    metaDescription:
      "Live inventory of businesses under $500k asking. SBA-friendly, owner-operator scale. Every deal fit-scored, with a thesis and red flags.",
    intro:
      "Sub-$500k acquisitions are the SBA-7(a) sweet spot: 10% down, 10-year amortization, and enough scale to support a hired manager if you don't want to run it day-to-day. Most search-funders start their deal-flow reviews at this range. LamboApp surfaces every live listing under $500k across the major brokers and scores each for fit against a first-time-buyer profile.",
  },
  {
    slug: "1m",
    askingMax: 1_000_000,
    label: "under $1M",
    h1: "Businesses for sale under $1 million",
    metaTitle: "Businesses for sale under $1M — search-fund-scale acquisitions",
    metaDescription:
      "Live listings under $1M asking. Real operating businesses, SBA-eligible, fit-scored. Filter by industry, revenue, and SDE multiple.",
    intro:
      "The under-$1M range is where most solo search-funders and small acquisition entrepreneurs concentrate. Big enough for a real operating team, small enough to close with a personal guarantee and SBA leverage. LamboApp aggregates every live listing in this range across broker networks and highlights the ones where the SDE multiple + growth signals + red-flag profile add up to a buy signal.",
  },
  {
    slug: "5m",
    askingMax: 5_000_000,
    label: "under $5M",
    h1: "Businesses for sale under $5 million",
    metaTitle: "Businesses for sale under $5M — lower-mid-market acquisitions",
    metaDescription:
      "Live inventory of lower-mid-market business listings under $5M asking. Fit-scored, with a thesis and red flags on each deal.",
    intro:
      "The under-$5M range crosses out of pure SBA territory into lower-mid-market: often a mix of seller financing, SBA-plus-mezz, and small-PE structures. Multiples here tend to be higher (4–6× SDE common in traded services and SaaS) because the buyer pool is thinner and diligence is heavier. LamboApp aggregates every live listing under $5M and flags the deals where the fundamentals justify the multiple.",
  },
];

export function findPriceBucket(slug: string): PriceBucketDef | undefined {
  return PRICE_BUCKETS.find((b) => b.slug === slug);
}

// -------- Live-stat computation --------

// medianAsking: pulled from the deal list on the page. Not a
// corpus-wide statistic — it's whatever's currently visible on THIS
// page, so the intro copy matches what the visitor sees below.
export function medianAsking(deals: Deal[]): number | undefined {
  const vals = deals
    .map((d) => d.asking_price)
    .filter((v): v is number => typeof v === "number" && v > 0)
    .sort((a, b) => a - b);
  if (vals.length === 0) return undefined;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : Math.round((vals[mid - 1] + vals[mid]) / 2);
}

// medianRevenue: same story, for the annual-revenue axis. Useful in
// intro copy where multiple/margin discussion needs a scale anchor.
export function medianRevenue(deals: Deal[]): number | undefined {
  const vals = deals
    .map((d) => d.annual_revenue)
    .filter((v): v is number => typeof v === "number" && v > 0)
    .sort((a, b) => a - b);
  if (vals.length === 0) return undefined;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : Math.round((vals[mid - 1] + vals[mid]) / 2);
}

// -------- JSON-LD builders --------

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

// ItemList of the visible deals. Kept intentionally simple — no
// Product/Offer sub-items, no AggregateRating, because we're not the
// seller and Google penalizes marking third-party listings as our own
// offers. The list serves the "carousel"/collection rich-result path.
export function itemListJsonLd(opts: {
  name: string;
  url: string;
  deals: Deal[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    url: opts.url,
    numberOfItems: opts.deals.length,
    itemListElement: opts.deals.slice(0, 20).map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/deal/${d.slug}`,
      name: d.name,
    })),
  };
}

// FAQPage schema (safe — no restrictions on inclusion, just no rich
// result surface as of the Aug-2023 change).
export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

// Robots directives helper: encodes the "3-result minimum" policy in
// one place so pages, sitemap, and any future crawlers agree.
export function robotsFor(count: number) {
  const ix = indexabilityFor(count);
  return ix === "index"
    ? { index: true, follow: true }
    : { index: false, follow: true };
}
