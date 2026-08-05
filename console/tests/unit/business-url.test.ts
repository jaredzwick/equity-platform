import { describe, expect, it } from "vitest";
import { parseBusinessInput } from "@/lib/business-url";

describe("parseBusinessInput — domains", () => {
  it("handles a bare .com domain", () => {
    const r = parseBusinessInput("myshop.com");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slug).toBe("myshop");
      expect(r.name).toBe("Myshop");
      expect(r.namespace).toBe("myshop-prod");
      expect(r.source).toBe("domain");
    }
  });

  it("handles a full https URL with path", () => {
    const r = parseBusinessInput("https://myshop.com/products");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("myshop");
  });

  it("strips www. prefix", () => {
    const r = parseBusinessInput("www.myshop.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("myshop");
  });

  it("strips app. subdomain", () => {
    const r = parseBusinessInput("app.myshop.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("myshop");
  });

  it("handles compound TLDs like .co.uk", () => {
    const r = parseBusinessInput("myshop.co.uk");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("myshop");
  });

  it("handles compound TLDs on subdomains", () => {
    const r = parseBusinessInput("app.myshop.co.uk");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("myshop");
  });

  it("handles compound TLDs with paths", () => {
    const r = parseBusinessInput("https://app.myshop.co.uk/some/path");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("myshop");
  });

  it("handles multi-word display names via kebab", () => {
    const r = parseBusinessInput("hiring-funnel.com");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slug).toBe("hiring-funnel");
      expect(r.name).toBe("Hiring Funnel");
      expect(r.namespace).toBe("hiring-funnel-prod");
    }
  });
});

describe("parseBusinessInput — bare slug and free text", () => {
  it("accepts a bare slug with no dots", () => {
    const r = parseBusinessInput("myshop");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slug).toBe("myshop");
      expect(r.source).toBe("slug");
    }
  });

  it("converts free-text names to kebab-case", () => {
    const r = parseBusinessInput("Hiring Funnel");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.slug).toBe("hiring-funnel");
      expect(r.name).toBe("Hiring Funnel");
      expect(r.source).toBe("freetext");
    }
  });

  it("strips punctuation from free-text names", () => {
    const r = parseBusinessInput("My Shop, LLC!");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.slug).toBe("my-shop-llc");
  });
});

describe("parseBusinessInput — rejections", () => {
  it("rejects empty input", () => {
    expect(parseBusinessInput("").ok).toBe(false);
    expect(parseBusinessInput("   ").ok).toBe(false);
  });

  it("rejects input that reduces to nothing kebab-able", () => {
    const r = parseBusinessInput("!!!");
    expect(r.ok).toBe(false);
  });

  it("rejects reserved slugs (route collisions)", () => {
    for (const reserved of ["master", "api", "docs", "www", "app", "admin"]) {
      const r = parseBusinessInput(reserved);
      expect(r.ok, `${reserved} should be reserved`).toBe(false);
    }
  });

  it("rejects a domain whose derived slug is reserved", () => {
    const r = parseBusinessInput("admin.com");
    expect(r.ok).toBe(false);
  });
});
