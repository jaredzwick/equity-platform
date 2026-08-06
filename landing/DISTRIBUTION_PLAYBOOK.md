# Distribution playbook (off-site discovery)

Internal — companion to the SEO landing pages under `/deals/industry/*`, `/deals/under/*`, `/compare/*`, and `/marketplaces`. Last updated 2026-08-06. Every entry has (a) submission link, (b) angle to lead with, and (c) the discovery signal it feeds (traffic vs. links vs. LLM-recommendation).

## One-shot launches

| Channel | Angle | Signal |
| --- | --- | --- |
| **Product Hunt** (producthunt.com/posts/new) | "Claude reads 100 businesses-for-sale listings/day so you don't have to." Ship on a Tuesday, prep hunter + 5 supporters in advance. | Backlinks, PR pickup, LLM signal (PH is heavily crawled by search + AI). |
| **Hacker News — Show HN** | "Show HN: LamboApp — AI-scored dealflow across 30+ SMB brokers". Title format: `Show HN: {product} – {one-line}`. Best time: US morning, Tue–Thu. | Backlinks, developer audience, TechMeme pickup. |
| **Indie Hackers** (indiehackers.com/new-product) | Standard product post; follow with a `/interview` request once we have $1k MRR. | Founder community, milestone-based coverage. |
| **BetaList** (betalist.com/submit) | For the pre-launch phase — submit once /sell is polished. | Small audience but link + entity signal. |
| **AlternativeTo** (alternativeto.net) | Add as an alternative to BizBuySell, Flippa, Empire Flippers, Acquire.com. | High-intent buyer traffic + direct LLM-signal (LLMs cite AlternativeTo). |
| **G2** (g2.com) | Category: "Business Buying Platforms" — may not have an exact category; propose one. | Enterprise-grade entity signal, review flywheel. |
| **Capterra / GetApp** | Same category story. | B2B search signal. |
| **StackShare** (stackshare.io) | Tag with our stack (Next.js, Go, Claude, MinIO). | Developer discoverability. |

## Sub-reddits (ordered by signal-to-noise)

Post a link to a specific comparison page or deal-flow example, not the homepage. Follow each sub's self-promo rules — most require a real answer + link, not a link drop.

| Sub | Members (rough) | Angle |
| --- | --- | --- |
| r/SearchFund | ~5k | Direct fit — post the deal-flow aggregation angle. |
| r/Entrepreneur | ~4M | Broad. Frame as "how I aggregate 100 businesses-for-sale a day". |
| r/smallbusiness | ~2M | Buyer + seller sides both live here. |
| r/EtsySellers, r/AmazonFBA, r/FulfillmentByAmazon | Ecommerce-specific | Post from the "when you're ready to sell" angle. |
| r/SaaS | ~250k | Comparison angle to Acquire.com. |
| r/webdev, r/programming | Dev audience | Only when we have a technical/open-source angle worth sharing. |
| r/AcquisitionEntrepreneur | Small but on-nose | Direct submission. |
| r/juststart (Authority Hacker) | Content-site buyers | Post `/deals/industry/content-site` when we have inventory. |

Rules to follow: no drive-by link drops, always answer the OP's real question, disclose the affiliation in comments, wait 30+ days between posts to the same sub.

## Newsletters (paid placements + free mentions)

| Newsletter | Audience | Contact | Angle |
| --- | --- | --- | --- |
| **The Hustle** | 2M+ business readers | Sponsor page | Placement in "cool tools" section. |
| **When Then Zen** (Sieva Kozinsky) | Search fund audience | DM founder | Free share if angle is genuinely good. |
| **SMB Vibes** | SMB acquirers | Sponsor page | Sponsored placement. |
| **Empire Flippers Podcast / Newsletter** | Online-business buyers | Sponsor page | Sponsored placement — they compete but the traffic converts. |
| **Alex Cavoulacos / Contrarian Thinking** | Boring-business audience | Sponsor page | Sponsored placement — Codie Sanchez's list. |
| **The Fort** (Chris Powers) | Real estate + boring biz | Contact | Free share request. |
| **Small Bets** (Daniel Vassallo) | Micro-entrepreneurs | Contact | Free share for the sub-$50k audience. |

## Listicles + backlinks (SEO signal)

Search Google for each phrase, find the top-3 ranking articles, and email the author to be added:

- "flippa alternatives"
- "bizbuysell alternatives"
- "empire flippers alternatives"
- "acquire.com alternatives"
- "microacquire alternatives"
- "best marketplaces to buy an online business"
- "how to buy a saas business"
- "how to buy a laundromat" (and other high-volume "how to buy a X" queries)
- "ai tools for business acquisition"
- "small business acquisition tools"

Email template: brief pitch, disclose what we do, offer to write a paragraph they can drop in (make it easy on the author), link to specific comparison page (not homepage).

## GitHub

- Add topics to the repo: `search-fund`, `smb-acquisition`, `business-for-sale`, `acquisition-entrepreneurship`, `ai-agents`, `nextjs`, `claude`, `deal-sourcing`.
- Add a `awesome-*` submission to any existing awesome list (e.g., awesome-nextjs) if we have a genuinely reusable component.

## Wikidata (entity signal for LLMs + Google Knowledge Graph)

- Create a Wikidata Q-number for LamboApp once we have 2+ press mentions to cite.
- Fields: name, alias, official website, instance-of (business-for-sale marketplace), founder, inception date, headquartered in.
- This is the anchor Google / OpenAI / Anthropic actually use to disambiguate the entity — worth the 30 minutes.

## Bing Webmaster Tools

- Submit sitemap.xml to Bing (bing.com/webmasters). ChatGPT search runs on Bing's index, so this is a direct LLM-signal lever.
- Enable IndexNow (we already ping via n8n — verify Bing accepts the pings).

## What NOT to do

- No paid backlinks. Google catches them; the risk-adjusted return is negative.
- No comment-spam on high-DA blogs. Google's spam classifier is trained on exactly this pattern.
- No fake reviews on G2/Capterra. Product Hunt's fraud detection alone is enough to deranked us for a year.
- No generic-listicle submissions ("Top 100 startup tools"). Waste of time.
- No cold email to journalists without a real story. TechCrunch/Bloomberg won't cover "we launched a marketplace" — pitch a data story (e.g., "we analyzed 10,000 SMB listings and here's what we learned").

## Order of operations

1. Ship the pSEO pages (`/deals/industry/*`, `/deals/under/*`, `/compare/*`, `/marketplaces`).
2. Verify indexing in Google Search Console + Bing Webmaster.
3. Submit Product Hunt.
4. Submit AlternativeTo entries against BizBuySell / Flippa / Empire Flippers / Acquire.
5. Post Show HN once we have 30 days of Product Hunt traffic to reference.
6. Reddit rotation (one sub per week, high-effort post).
7. Backlink outreach to the top 20 "flippa alternative" listicles.
8. Create Wikidata entry.
9. Newsletter sponsorships once we have $10k MRR and a proven CAC to justify.
