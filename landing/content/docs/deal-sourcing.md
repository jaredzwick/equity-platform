---
title: "Deal sourcing — how LamboApp screens 30+ brokers"
description: "How the deal scanner ingests listings from BizBuySell, Flippa, Empire Flippers, Quiet Light and 26 other brokers into a single normalized feed."
keywords: ["deal sourcing", "BizBuySell", "Flippa", "Empire Flippers", "Quiet Light", "business listings", "SMB acquisition"]
category: "Concepts"
summary: "Scrapes 30+ brokers on a schedule, normalizes the schema, deduplicates, hands each listing to the AI scorer."
icon: "scan"
order: 2
lastmod: "2026-08-04"
---

# Deal sourcing

LamboApp is a screener, not a listing site. It doesn't host the listings — it reads them from the sources that already exist and normalizes them into one feed.

## The sources

Roughly 30+ business-for-sale brokers, updated on rolling schedules. The big ones:

- **BizBuySell** — the largest general-purpose SMB marketplace.
- **Flippa** — mostly digital/web/SaaS/apps.
- **Empire Flippers** — vetted content sites and e-commerce.
- **Quiet Light** — brokered digital businesses, higher end.
- **Website Closers** — full-service brokered digital businesses.

Plus specialty brokers for laundromats, HVAC, dental practices, and other verticals.

## The pipeline

1. **Scan** — scheduled jobs pull each broker's public listing feed (or scrape the HTML index page where no feed exists).
2. **Normalize** — every listing gets mapped to a shared schema: `slug`, `asking_price`, `sde`, `revenue`, `industry`, `location`, `established`, `broker`, `listing_url`.
3. **Deduplicate** — the same business is often listed on multiple brokers. Dedup is keyed on domain + numeric fingerprint (asking price + SDE within a tolerance window).
4. **Score** — every new listing goes to the AI scorer. See [AI scoring](/docs/ai-scoring).
5. **Publish** — scored listings appear at `/deal/<slug>` on the landing site with the thesis, the red flags, and a link back to the original listing.

## What you see as a user

On the landing site: a ranked deal feed, filtered by industry, SDE multiple, asking price, and geographic scope. Every deal links to:

- The AI thesis (why this is worth looking at).
- The red flags the AI caught.
- The original listing on the broker's site (we don't compete with them — we drive traffic to them).

## What we don't do

- We don't scrape MLS/private deal networks. The scanner respects `robots.txt` and only reads public listings.
- We don't broker deals. You reach out to the broker directly using the link on the listing.
- We don't take a commission. The value is in the screening, not the transaction.
- We don't republish full listing copy. The thesis is our own analysis; the raw listing content stays on the broker's site.

## Data freshness

Most brokers get scanned every 8 hours. High-volume sources (BizBuySell, Flippa) get scanned more often. A listing typically appears in the LamboApp feed within a few hours of being posted upstream.
