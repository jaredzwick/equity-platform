// Parse whatever a human types into the "Business URL" field into a coherent
// { slug, name, namespace } triple. Users type a mix of shapes:
//
//   "https://myshop.com"          → myshop
//   "myshop.com"                  → myshop
//   "www.myshop.com"              → myshop
//   "app.myshop.co.uk"            → myshop
//   "app.myshop.co.uk/some/path"  → myshop
//   "myshop"                      → myshop  (bare slug, no dots)
//   "Hiring Funnel"               → hiring-funnel  (free-text fallback)
//
// The parser is deliberately best-effort. When it can't confidently derive
// a slug, it returns { ok: false }; the caller shows the user the raw input
// echoed back and asks them to try a domain. Anything that lands in the
// action layer must have already parsed cleanly.

// Two-letter ccTLDs where the second-to-last label is the "real" TLD suffix
// (co.uk, com.au, ...). Small allowlist covers 95% of what we'll see;
// unknown compound TLDs degrade to "second-to-last label as slug" which is
// still reasonable most of the time.
const COMPOUND_TLDS = new Set([
  "co.uk", "co.nz", "co.jp", "co.kr", "co.in", "co.za",
  "com.au", "com.br", "com.mx", "com.sg", "com.hk",
  "org.uk", "org.au",
  "ac.uk", "gov.uk",
  "com.co", "net.co",
]);

// Kebab regex: same one used by the slug validator.
const KEBAB = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

// Reserved slugs that would collide with route names.
const RESERVED_SLUGS = new Set(["master", "api", "docs", "www", "app", "admin"]);

export type ParsedBusiness =
  | {
      ok: true;
      slug: string;
      name: string;       // Title-cased display name
      namespace: string;  // ${slug}-prod
      source: "domain" | "slug" | "freetext";
    }
  | { ok: false; reason: string };

function toKebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitle(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Strip protocol + path from a URL-ish string, return just the hostname.
function extractHostname(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // If it has a protocol, use URL. If it doesn't but looks like a URL
  // (has a dot or a slash), synthesize one so the URL parser accepts it.
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProto);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Given a hostname like "app.myshop.co.uk", return the slug label.
// Strips common leading prefixes (www., app.) and compound TLDs at the end.
function domainToSlug(hostname: string): string | null {
  if (!hostname) return null;
  // Strip leading www.
  let host = hostname.replace(/^www\./, "");
  // Strip a single leading "app." subdomain (super common for admin URLs).
  host = host.replace(/^app\./, "");

  const labels = host.split(".").filter(Boolean);
  if (labels.length === 0) return null;
  if (labels.length === 1) {
    // Just a single-label input like "myshop" — treat as slug directly.
    return toKebab(labels[0]);
  }

  // Peek at the last two labels. If they form a compound TLD, take the
  // third-from-last as the slug. Otherwise take the second-from-last.
  const lastTwo = labels.slice(-2).join(".");
  const slugLabel = COMPOUND_TLDS.has(lastTwo)
    ? labels[labels.length - 3]
    : labels[labels.length - 2];
  if (!slugLabel) return null;
  return toKebab(slugLabel);
}

export function parseBusinessInput(raw: string): ParsedBusiness {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return { ok: false, reason: "Enter a business URL or name." };

  // Path A: looks URL-shaped (has a scheme, a dot, or a slash) → domain parse.
  const looksDomainLike =
    /^https?:\/\//i.test(trimmed) || trimmed.includes(".") || trimmed.includes("/");

  let slug: string | null = null;
  let source: "domain" | "slug" | "freetext" = "freetext";

  if (looksDomainLike) {
    const host = extractHostname(trimmed);
    if (host) {
      slug = domainToSlug(host);
      source = host.split(".").length > 1 ? "domain" : "slug";
    }
  }

  // Path B: no dots → treat as a slug or free-text name.
  if (!slug) {
    slug = toKebab(trimmed);
    source = /\s/.test(trimmed) ? "freetext" : "slug";
  }

  if (!slug || !KEBAB.test(slug)) {
    return {
      ok: false,
      reason:
        "Couldn't derive a slug from that. Try a domain like myshop.com, or a plain name like hiring-funnel.",
    };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return {
      ok: false,
      reason: `"${slug}" is reserved. Pick a different URL or name.`,
    };
  }

  const name = toTitle(slug);
  const namespace = `${slug}-prod`;
  return { ok: true, slug, name, namespace, source };
}
