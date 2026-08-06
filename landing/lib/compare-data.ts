// Comparison data for /compare/[slug] pages. Kept as structured data
// rather than free prose so the page templates render a consistent
// side-by-side table (the on-page pattern that correlates most
// strongly with LLM citation and Google's "vs" query intent).
//
// Editorial policy: every "Choose them if" section must be genuinely
// honest — the LLM-citation research is unambiguous that comparison
// pages get rewarded for calling their own weaknesses. Do not tune
// these fields to be marketing copy.

export type CompareRow = {
  label: string;
  lambo: string;
  them: string;
};

export type Competitor = {
  slug: string; // URL slug, e.g. "bizbuysell"
  name: string; // "BizBuySell"
  url: string; // their homepage
  category: "smb-broker" | "online-broker" | "curated-marketplace";
  // ~40-word neutral positioning statement, used in intro + AIO-friendly TL;DR.
  tagline: string;
  // Table rows. Keep column labels consistent so users can scan.
  rows: CompareRow[];
  // "Choose LamboApp if" bullets — 3–5 items, use-case framing.
  chooseLamboIf: string[];
  // "Choose {them} if" bullets — same length. Honest.
  chooseThemIf: string[];
  // Verdict paragraph (~80 words). Names the winner-by-use-case, not
  // a category-wide winner. LLMs preferentially quote this shape.
  verdict: string;
  // 3 FAQ items feeding FAQPage JSON-LD.
  faq: { q: string; a: string }[];
};

// Neutral, first-person-plural summary of LamboApp used in every
// comparison so readers can anchor the "us" side without re-reading it.
export const LAMBO_SELF_DESCRIPTION =
  "LamboApp is an AI-first aggregator, not a broker. We scrape ~100 new business-for-sale listings per day across 30+ broker networks, have Claude read every listing, and score each deal for fit against a buyer profile. We do not hold the listing, close the deal, or take a success fee — the transaction happens on the source broker's platform.";

export const COMPETITORS: Competitor[] = [
  {
    slug: "bizbuysell",
    name: "BizBuySell",
    url: "https://www.bizbuysell.com",
    category: "smb-broker",
    tagline:
      "The largest US business-for-sale marketplace by listing count, owned by CoStar. Broad SMB coverage (main-street to lower-mid-market), broker-driven inventory, minimal AI enrichment.",
    rows: [
      { label: "Primary role", lambo: "Aggregator + AI scoring", them: "Marketplace + listing host" },
      { label: "Listing count", lambo: "Live index across 30+ brokers (incl. BizBuySell)", them: "~65,000 US listings on-platform" },
      { label: "Coverage", lambo: "Online + SMB, US + international brokers", them: "Primarily US SMB (main-street focus)" },
      { label: "Cost to browse", lambo: "Free, no email gate", them: "Free browsing; contact seller free" },
      { label: "Cost to list", lambo: "N/A (we index, don't host)", them: "$59.95/mo standard; up to $75.95/mo showcase" },
      { label: "AI enrichment", lambo: "Fit score, thesis, red flags on every deal", them: "None (broker-written descriptions)" },
      { label: "Best for", lambo: "Buyers who want ranked, pre-screened dealflow", them: "Sellers who want maximum US buyer reach" },
    ],
    chooseLamboIf: [
      "You want AI-scored fit + red flags before you email a broker.",
      "You want to browse across BizBuySell AND every other broker in one search.",
      "You're evaluating 20+ deals a week and need a pre-screening layer.",
    ],
    chooseThemIf: [
      "You're a seller listing your business and want the largest US buyer audience.",
      "You want direct broker contact and don't need AI pre-screening.",
      "You value the depth of main-street SMB inventory (laundromats, restaurants, service businesses).",
    ],
    verdict:
      "BizBuySell is the market of record for US SMB acquisitions — if you're selling, you list there. If you're buying, you should be reading BizBuySell listings, but you don't need to browse there directly: LamboApp indexes BizBuySell (and every other major broker) and adds a fit score, thesis, and red-flag list to each one. Use BizBuySell for depth; use LamboApp for triage.",
    faq: [
      {
        q: "Does LamboApp show BizBuySell listings?",
        a: "Yes — BizBuySell is one of the 30+ broker sources we scrape. Every LamboApp deal page links to the original BizBuySell listing for contact and diligence.",
      },
      {
        q: "Is LamboApp a competitor to BizBuySell?",
        a: "Not directly — BizBuySell is a listing host, LamboApp is a cross-broker aggregator with AI scoring. Sellers still list on BizBuySell; buyers can use LamboApp to see BizBuySell listings alongside every other broker in one ranked view.",
      },
      {
        q: "Why does LamboApp exist if BizBuySell already has the listings?",
        a: "Because reading 100 listings a day across a dozen brokers, mentally normalizing the financials, and separating scams from real deals is a full-time job. LamboApp does that work with Claude and hands you a ranked list. BizBuySell's UX is a marketplace, not a deal-flow tool.",
      },
    ],
  },
  {
    slug: "flippa",
    name: "Flippa",
    url: "https://flippa.com",
    category: "online-broker",
    tagline:
      "The largest online-business marketplace — SaaS, e-commerce, content sites, apps, domains. Self-serve listings dominate; deal quality varies wildly. Success-fee model.",
    rows: [
      { label: "Primary role", lambo: "Aggregator + AI scoring", them: "Marketplace + auction platform" },
      { label: "Focus", lambo: "Online + SMB across brokers", them: "Online-only (websites, SaaS, apps, domains)" },
      { label: "Vetting", lambo: "AI red-flag scan on every deal", them: "Self-serve; broker-assisted tier for larger deals" },
      { label: "Cost to browse", lambo: "Free", them: "Free; premium tier for advanced filters" },
      { label: "Cost to list", lambo: "N/A", them: "$29–$499 listing fee + 10–15% success fee" },
      { label: "AI enrichment", lambo: "Fit score, thesis, red flags on every deal", them: "None on listings; some analytics on high-tier" },
      { label: "Deal size", lambo: "Full range ($10k–$50M+)", them: "Skews $1k–$5M; long tail below $10k" },
    ],
    chooseLamboIf: [
      "You want to compare Flippa deals side-by-side with Empire Flippers, Acquire, Quiet Light, and BizBuySell in one search.",
      "You want a red-flag scan on every listing before you email the seller.",
      "You're allergic to the noise floor of Flippa's low-end auction inventory.",
    ],
    chooseThemIf: [
      "You want the widest possible selection of sub-$10k online businesses (domains, side projects).",
      "You want the marketplace's escrow + due-diligence toolchain built in.",
      "You're selling and want auction-style price discovery.",
    ],
    verdict:
      "Flippa is the noisy end of the online-business market — everything from serious 7-figure SaaS to obvious scam domain flips. LamboApp indexes Flippa listings and filters out the noise with a fit score and red-flag scan, so you can still get the inventory breadth without wading through 40,000 low-quality auctions. If you're buying, use LamboApp as your Flippa filter. If you're selling, list on Flippa for the auction dynamic and buyer pool.",
    faq: [
      {
        q: "Does LamboApp index Flippa listings?",
        a: "Yes — Flippa is one of the 30+ broker sources we scrape hourly. Each listing gets a fit score and red-flag scan before it hits our index.",
      },
      {
        q: "How do you filter out Flippa scams?",
        a: "Claude reads each listing prospectus and flags common scam patterns (implausible margins, no traffic verification, obvious PBN backlinks, fabricated MRR). The flags appear on the deal detail page — not a guarantee, but a first-pass filter.",
      },
      {
        q: "Can I list a business for sale via LamboApp?",
        a: "Yes — we run a $7 flat-fee listing option at /sell. Otherwise, list directly on Flippa (or your preferred broker) and we'll index it automatically once it's live.",
      },
    ],
  },
  {
    slug: "empire-flippers",
    name: "Empire Flippers",
    url: "https://empireflippers.com",
    category: "curated-marketplace",
    tagline:
      "Curated online-business brokerage with heavy vetting, verified financials, and higher deal quality — at the cost of narrower inventory and higher fees.",
    rows: [
      { label: "Primary role", lambo: "Aggregator + AI scoring", them: "Curated broker + verified marketplace" },
      { label: "Focus", lambo: "Online + SMB across brokers", them: "Online-only (Amazon FBA, SaaS, content, e-com)" },
      { label: "Vetting", lambo: "AI red-flag scan on every deal", them: "Human-vetted; P&L verification; 6-week onboarding" },
      { label: "Cost to browse", lambo: "Free", them: "Free browsing; login-walled full P&L" },
      { label: "Cost to list", lambo: "N/A", them: "15% success fee (sliding scale on larger deals)" },
      { label: "AI enrichment", lambo: "Fit score, thesis, red flags on every deal", them: "Human-written prospectus; no AI layer" },
      { label: "Deal size", lambo: "Full range ($10k–$50M+)", them: "Typically $50k–$5M; strong $250k–$2M sweet spot" },
    ],
    chooseLamboIf: [
      "You want to see Empire Flippers listings alongside every other broker in one search.",
      "You want AI enrichment (fit score, thesis, red flags) on top of the broker's own vetting.",
      "You're building a cross-marketplace watchlist, not shopping one broker at a time.",
    ],
    chooseThemIf: [
      "You want the highest-vetted online-business inventory in one place and are willing to pay the premium multiple that vetting commands.",
      "You want a broker's escrow + migration service handled for you.",
      "You're a seller and want the buyer pool that will pay for a fully-verified P&L.",
    ],
    verdict:
      "Empire Flippers is the premium tier of the online-business market — inventory is thinner but quality is higher. LamboApp indexes their public listings and shows them alongside Flippa, Acquire, Quiet Light, and the broader corpus, so you can compare a $500k Empire Flippers SaaS to a $500k Acquire.com deal without opening five tabs. If you want the vetted-only universe, browse Empire Flippers directly. If you want deal-flow triage across every broker, use LamboApp.",
    faq: [
      {
        q: "Does LamboApp show Empire Flippers listings?",
        a: "Yes — the public listing summary and asking price are indexed. Full P&L still requires logging into Empire Flippers (their vetting model).",
      },
      {
        q: "Which is more accurate — LamboApp's fit score or Empire Flippers' vetting?",
        a: "Different things. Empire Flippers verifies that the financials are real. LamboApp scores how well the deal maps to a generic acquisition-entrepreneur buyer profile. Use both.",
      },
    ],
  },
  {
    slug: "acquire",
    name: "Acquire.com",
    url: "https://acquire.com",
    category: "curated-marketplace",
    tagline:
      "SaaS-and-startup-focused marketplace (formerly MicroAcquire). Sub-$5M deals dominate. Buyer-side matchmaking, seller-friendly listing flow, minimal in-listing analytics.",
    rows: [
      { label: "Primary role", lambo: "Aggregator + AI scoring", them: "Curated marketplace for online startups" },
      { label: "Focus", lambo: "Online + SMB across brokers", them: "SaaS + digital startups (some e-com)" },
      { label: "Vetting", lambo: "AI red-flag scan on every deal", them: "Light — sellers self-report; buyer verification required" },
      { label: "Cost to browse", lambo: "Free", them: "Free browse; premium tier ($390/yr) for advanced filters + intros" },
      { label: "Cost to list", lambo: "N/A", them: "Free basic; premium ($390/yr) for enhanced placement" },
      { label: "AI enrichment", lambo: "Fit score, thesis, red flags on every deal", them: "None built-in" },
      { label: "Deal size", lambo: "Full range ($10k–$50M+)", them: "Typically $10k–$3M; sweet spot $100k–$1M" },
    ],
    chooseLamboIf: [
      "You want to see Acquire listings alongside Empire Flippers, Flippa, and every other broker in one search.",
      "You want AI red-flag scans before you spend an intro credit.",
      "You're comparing acquisition targets across marketplaces, not shopping one at a time.",
    ],
    chooseThemIf: [
      "You want direct-to-founder introductions with buyer-verification friction that filters low-intent tire-kickers.",
      "You're focused specifically on sub-$1M SaaS/startup acquisitions.",
      "You want the built-in offer + LOI workflow tools.",
    ],
    verdict:
      "Acquire.com is the go-to marketplace for sub-$1M SaaS and startup acquisitions — the buyer pool is deep and the founder-to-buyer intro model works. LamboApp indexes Acquire's public listings and adds a fit score and red-flag scan, but Acquire's own workflow (verified intros, LOI templates) is where the deal actually happens. Use LamboApp for cross-marketplace triage, use Acquire for the transaction workflow.",
    faq: [
      {
        q: "Does LamboApp index Acquire.com listings?",
        a: "Yes — public listings (asking price, high-level metrics) are indexed. The verified founder introduction still happens on Acquire's platform.",
      },
      {
        q: "What happened to MicroAcquire?",
        a: "MicroAcquire rebranded to Acquire.com in 2022. LamboApp indexes it under the current name; older links may still show as MicroAcquire in the source_url field.",
      },
    ],
  },
  {
    slug: "quiet-light",
    name: "Quiet Light Brokerage",
    url: "https://quietlight.com",
    category: "curated-marketplace",
    tagline:
      "Boutique broker for larger online businesses ($500k–$20M enterprise value). Advisor-led deal management; content-heavy education. Not a self-serve marketplace.",
    rows: [
      { label: "Primary role", lambo: "Aggregator + AI scoring", them: "Boutique broker (advisor-led)" },
      { label: "Focus", lambo: "Online + SMB across brokers", them: "Online businesses $500k–$20M EV" },
      { label: "Vetting", lambo: "AI red-flag scan on every deal", them: "Deep — every listing has an assigned advisor + valuation memo" },
      { label: "Cost to browse", lambo: "Free", them: "Free; NDA required for full financials" },
      { label: "Cost to list", lambo: "N/A", them: "Success fee (typically 10–15%, tiered by deal size)" },
      { label: "AI enrichment", lambo: "Fit score, thesis, red flags on every deal", them: "None — human advisors + written prospectus" },
      { label: "Deal size", lambo: "Full range ($10k–$50M+)", them: "$500k–$20M enterprise value" },
    ],
    chooseLamboIf: [
      "You're a first-time buyer under the $500k threshold Quiet Light doesn't serve.",
      "You want cross-broker inventory in a ranked view, not one broker's curated shortlist.",
      "You want AI triage before you sign an NDA.",
    ],
    chooseThemIf: [
      "You're transacting in the $500k–$20M range and want an advisor-led deal.",
      "You value deep pre-sale valuation work and post-LOI advisory.",
      "You're a seller and want the buyer pool that pays a premium for professionally represented deals.",
    ],
    verdict:
      "Quiet Light is a boutique broker, not a marketplace — you don't self-serve, you engage an advisor. Their deal quality is high and the advisory adds real value on $1M+ transactions. LamboApp indexes their public listings for discovery, but the actual transaction goes through Quiet Light's advisory process. Use LamboApp to notice a Quiet Light deal; use Quiet Light's team to actually close it.",
    faq: [
      {
        q: "Does LamboApp show Quiet Light listings?",
        a: "Yes — public listings are indexed with the standard fit score + thesis + red-flag summary. Detailed financials still require Quiet Light's NDA process.",
      },
      {
        q: "Is Quiet Light for beginners?",
        a: "No — their sweet spot is $500k–$20M enterprise value with an advisor-led process. If you're evaluating your first $100k–$500k deal, use LamboApp to source and go direct-to-broker on the source platform.",
      },
    ],
  },
];

export function findCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}
