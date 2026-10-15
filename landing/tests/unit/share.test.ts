import { describe, expect, it } from "vitest";
import {
  buildShareText,
  destinationUrl,
  nativeSharePayload,
  partnerEmailBody,
  partnerEmailSubject,
  shareUrl,
  type ShareableDeal,
} from "@/lib/share";

const DEAL: ShareableDeal = {
  slug: "profitable-b2b-industrial-services-business-abcd1234",
  name: "Profitable B2B Industrial Services Business",
  asking_price: 1_200_000,
  annual_revenue: 850_000,
  annual_profit: 320_000,
  deal_fit_score: 8.5,
  thesis:
    "Niche B2B services operator with 15 years of relationships, recurring maintenance contracts, and an owner-operator transition plan already drafted. 2.1x SDE multiple on $320K profit; the asking price looks reasonable given the moat.",
  location: "Southeast, USA",
};

describe("shareUrl", () => {
  it("appends UTM params per channel", () => {
    const u = new URL(shareUrl(DEAL, "twitter"));
    expect(u.pathname).toBe(`/deal/${DEAL.slug}`);
    expect(u.searchParams.get("utm_source")).toBe("share");
    expect(u.searchParams.get("utm_medium")).toBe("twitter");
    expect(u.searchParams.get("utm_campaign")).toBe("deal_page");
    expect(u.searchParams.get("utm_content")).toBe(DEAL.slug);
  });

  it("differentiates utm_medium per channel", () => {
    const channels = ["twitter", "linkedin", "whatsapp", "email", "copy"] as const;
    const media = channels.map((c) => new URL(shareUrl(DEAL, c)).searchParams.get("utm_medium"));
    expect(new Set(media).size).toBe(channels.length);
  });

  it("URL-encodes slug with special characters", () => {
    const d: ShareableDeal = { ...DEAL, slug: "has spaces & punct" };
    const u = new URL(shareUrl(d, "copy"));
    expect(u.pathname).toBe("/deal/has%20spaces%20%26%20punct");
  });
});

describe("buildShareText", () => {
  it("includes headline + truncated thesis + URL when thesis is long", () => {
    const text = buildShareText(DEAL, "twitter");
    expect(text).toContain(DEAL.name);
    expect(text).toContain("$1.2M");
    expect(text).toContain("8.5/10 fit");
    // Thesis is longer than 180 chars → must truncate with ellipsis.
    expect(text).toContain("…");
    expect(text).toContain("https://www.lamboapp.com/deal/");
  });

  it("preserves short thesis without truncation", () => {
    const shortThesis = "Short thesis under limit.";
    const d: ShareableDeal = { ...DEAL, thesis: shortThesis };
    const text = buildShareText(d, "twitter");
    expect(text).toContain(`"${shortThesis}"`);
    expect(text).not.toContain("…");
  });

  it("omits the thesis line when thesis is undefined", () => {
    const d: ShareableDeal = { ...DEAL, thesis: null };
    const text = buildShareText(d, "twitter");
    const lines = text.split("\n");
    expect(lines).toHaveLength(3); // headline, blank, url
    expect(lines[0]).toContain(DEAL.name);
    expect(lines[1]).toBe("");
    expect(lines[2]).toMatch(/^https:\/\/www\.lamboapp\.com\/deal\//);
  });

  it("renders N/A for null fit score", () => {
    const d: ShareableDeal = { ...DEAL, deal_fit_score: null };
    expect(buildShareText(d, "copy")).toContain("N/A/10 fit");
  });

  it("renders em dash for null asking price", () => {
    const d: ShareableDeal = { ...DEAL, asking_price: null };
    expect(buildShareText(d, "copy")).toContain("asking —,");
  });
});

describe("destinationUrl", () => {
  it("twitter — intent URL with text and via", () => {
    const url = destinationUrl(DEAL, "twitter");
    expect(url).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=/);
    expect(url).toContain("via=lamboapp");
    expect(url).toContain(encodeURIComponent(DEAL.name));
  });

  it("linkedin — share-offsite with URL only, no text param", () => {
    const url = destinationUrl(DEAL, "linkedin");
    expect(url).toMatch(/^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=/);
    expect(url).not.toContain("text=");
  });

  it("whatsapp — wa.me with text param", () => {
    const url = destinationUrl(DEAL, "whatsapp");
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(url).toContain(encodeURIComponent(DEAL.name));
  });

  it("email — mailto with subject + body", () => {
    const url = destinationUrl(DEAL, "email");
    expect(url).toMatch(/^mailto:\?subject=/);
    expect(url).toContain("body=");
    const subject = decodeURIComponent(url.split("subject=")[1].split("&body=")[0]);
    expect(subject).toContain(DEAL.name);
  });
});

describe("partnerEmailBody", () => {
  it("includes all stats and thesis", () => {
    const body = partnerEmailBody(DEAL);
    expect(body).toContain(DEAL.name);
    expect(body).toContain(DEAL.location!);
    expect(body).toContain("$1.2M");
    expect(body).toContain("$850K");
    expect(body).toContain("$320K");
    expect(body).toContain("8.5/10");
    expect(body).toContain(DEAL.thesis!);
    expect(body).toContain("https://www.lamboapp.com/deal/");
    expect(body).toContain("utm_medium=email");
  });

  it("omits location parens when location is missing", () => {
    const d: ShareableDeal = { ...DEAL, location: null };
    const body = partnerEmailBody(d);
    // "Looking at NAME." — no parens after NAME
    expect(body).toMatch(new RegExp(`^Looking at ${DEAL.name.replace(/[-\\]/g, "\\$&")}\\.`, "m"));
  });

  it("omits thesis block when thesis is undefined", () => {
    const d: ShareableDeal = { ...DEAL, thesis: null };
    const body = partnerEmailBody(d);
    expect(body).not.toContain("Thesis:");
  });
});

describe("partnerEmailSubject", () => {
  it("includes the deal name", () => {
    expect(partnerEmailSubject(DEAL)).toContain(DEAL.name);
  });
});

describe("nativeSharePayload", () => {
  it("returns title, text, url for navigator.share()", () => {
    const p = nativeSharePayload(DEAL);
    expect(p.title).toBe(DEAL.name);
    expect(p.url).toContain("https://www.lamboapp.com/deal/");
    expect(p.text).toContain(DEAL.name);
  });
});
