// share.ts — single source of truth for lamboapp deal-share text and URLs.
// Consumed by the ShareOverlay destinations and by the "Send to a partner"
// email CTA on /deal/[slug]. Keep this file pure (no React, no browser APIs)
// so Vitest can exercise every branch without a DOM.
//
// Templates are intentionally static — the enricher's `thesis` field already
// carries deal-specific voice, so we slice the first 180 chars rather than
// paying per-share LLM cost or risking hallucinated numbers in user-sent
// messages. A/B test alternate templates by swapping the strings here.
//
// LinkedIn note: share-offsite ignores the `text` param and renders purely
// from the destination URL's OG tags. buildShareUrl returns a text-less
// LinkedIn URL on purpose — don't "fix" it to pass text.

export type ShareChannel = "twitter" | "linkedin" | "whatsapp" | "email" | "copy";

export type ShareableDeal = {
  slug: string;
  name: string;
  asking_price?: number | null;
  annual_revenue?: number | null;
  annual_profit?: number | null;
  deal_fit_score?: number | null;
  thesis?: string | null;
  location?: string | null;
};

const SITE_URL = "https://www.lamboapp.com";
const THESIS_LIMIT = 180;

// Keep the UTM shape identical across channels so Grafana / Vercel Analytics
// can group on utm_source=share without caring which channel the click came
// from.
export function shareUrl(deal: ShareableDeal, channel: ShareChannel): string {
  const base = `${SITE_URL}/deal/${encodeURIComponent(deal.slug)}`;
  const params = new URLSearchParams({
    utm_source: "share",
    utm_medium: channel,
    utm_campaign: "deal_page",
    utm_content: deal.slug,
  });
  return `${base}?${params.toString()}`;
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function fmtFit(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "N/A";
  return n.toFixed(1);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

// buildShareText — the body copy used by X, WhatsApp, Email, and copy-link.
// LinkedIn ignores it (see file-level note).
export function buildShareText(deal: ShareableDeal, channel: ShareChannel): string {
  const url = shareUrl(deal, channel);
  const headline = `💰 ${deal.name} — asking ${fmtMoney(deal.asking_price)}, ${fmtFit(deal.deal_fit_score)}/10 fit`;
  const thesisLine = deal.thesis ? `"${truncate(deal.thesis, THESIS_LIMIT)}"` : null;
  return [headline, thesisLine, "", url].filter((l) => l !== null).join("\n");
}

// Longer email body for the "Send to a partner for a gut check" flow and the
// Email destination in the share overlay. One source so both triggers stay
// consistent.
export function partnerEmailBody(deal: ShareableDeal): string {
  const url = shareUrl(deal, "email");
  const lines = [
    `Looking at ${deal.name}${deal.location ? ` (${deal.location})` : ""}.`,
    "",
    `Asking:  ${fmtMoney(deal.asking_price)}`,
    `Revenue: ${fmtMoney(deal.annual_revenue)}`,
    `Profit:  ${fmtMoney(deal.annual_profit)}`,
    `Fit:     ${fmtFit(deal.deal_fit_score)}/10`,
  ];
  if (deal.thesis) {
    lines.push("", `Thesis: ${deal.thesis}`);
  }
  lines.push("", `Full breakdown: ${url}`);
  return lines.join("\n");
}

export function partnerEmailSubject(deal: ShareableDeal): string {
  return `Can you look at this deal? ${deal.name}`;
}

// destinationUrl — the href we send the user's browser to when they click a
// destination. For copy, consumers call writeToClipboard with shareUrl()
// directly, so this never returns a copy URL.
export function destinationUrl(deal: ShareableDeal, channel: Exclude<ShareChannel, "copy">): string {
  const text = buildShareText(deal, channel);
  const url = shareUrl(deal, channel);
  switch (channel) {
    case "twitter":
      // twitter.com/intent/tweet still works and redirects to x.com; use the
      // stable form in case we want to swap to x.com later.
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&via=lamboapp`;
    case "linkedin":
      // share-offsite ignores text; LinkedIn pulls the OG tags from the URL.
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(text)}`;
    case "email":
      return `mailto:?subject=${encodeURIComponent(partnerEmailSubject(deal))}&body=${encodeURIComponent(partnerEmailBody(deal))}`;
  }
}

// nativeSharePayload — what we pass to navigator.share on mobile when the API
// is supported. We leave the URL in text AND url so OSes that render only one
// (iOS older) still show it.
export function nativeSharePayload(deal: ShareableDeal): { title: string; text: string; url: string } {
  return {
    title: deal.name,
    text: buildShareText(deal, "copy"),
    url: shareUrl(deal, "copy"),
  };
}
