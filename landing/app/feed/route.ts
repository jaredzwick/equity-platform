import { fetchDeals } from "@/lib/deals";
import { SITE_URL } from "@/lib/pseo";

// /feed — RSS 2.0 feed of the newest scored deals. Two audiences:
//   1. Newsreader users who want a passive feed of new inventory.
//   2. Search-engine / LLM crawlers that use RSS as a freshness
//      signal (particularly Bing, which powers ChatGPT search).
//
// Cached 15 min at the edge — new listings hit the feed within one
// enrichment cycle without hammering the origin API.

export const revalidate = 900;

const FEED_LIMIT = 50;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const res = await fetchDeals({ sort: "newest", page_size: FEED_LIMIT });
  const deals = res?.items ?? [];
  const now = new Date().toUTCString();

  const items = deals
    .map((d) => {
      const link = `${SITE_URL}/deal/${d.slug}`;
      const pubDate = d.published_at
        ? new Date(d.published_at * 1000).toUTCString()
        : now;
      const summary = d.thesis || "No AI thesis yet — click through for the full listing.";
      const category = d.normalized_industry || d.industry || "";
      return `    <item>
      <title>${esc(d.name)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      ${category ? `<category>${esc(category)}</category>` : ""}
      <description>${esc(summary)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>LamboApp — new business-for-sale listings, scored</title>
    <link>${SITE_URL}/deals</link>
    <atom:link href="${SITE_URL}/feed" rel="self" type="application/rss+xml"/>
    <description>Every new business-for-sale listing across 30+ brokers, read by Claude, scored for fit, summarized in one paragraph.</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <ttl>15</ttl>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
