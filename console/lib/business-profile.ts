// Declarative business profile: one YAML file per tenant at
// businesses/<slug>.yaml in the platform repo. Adding a new field is one
// entry in the PROFILE_SCHEMA array below — the form regenerates
// automatically. Existing profiles with missing fields render empty; new
// fields default to blank.

import yaml from "js-yaml";
import { getFileSha, putFile, isConfigured } from "@/lib/github";

// ─── Schema ───────────────────────────────────────────────────────────────

export type FieldKind =
  | "text"
  | "textarea"
  | "url"
  | "email"
  | "color"
  | "number"
  | "select"
  | "money";

export type Field = {
  path: string;               // dotted path in the profile object (e.g. "brand.primary_color")
  label: string;
  hint?: string;
  kind: FieldKind;
  required?: boolean;
  options?: string[];         // for kind=select
  placeholder?: string;
};

export type Section = {
  key: string;                // stable id for the section (used in DOM ids)
  title: string;
  description?: string;
  fields: Field[];
};

// Ordered top-to-bottom in the form.
export const PROFILE_SCHEMA: Section[] = [
  {
    key: "identity",
    title: "Identity",
    description: "The legal + naming basics that pin the business to reality.",
    fields: [
      { path: "identity.legal_name", label: "Legal name (LLC)", kind: "text", required: true, placeholder: "Pypes LLC" },
      { path: "identity.display_name", label: "Display name", kind: "text", required: true, placeholder: "Pypes" },
      { path: "identity.primary_domain", label: "Primary domain", kind: "url", placeholder: "https://pypes.dev" },
      { path: "identity.support_email", label: "Support email", kind: "email", placeholder: "jared@pypes.dev" },
      { path: "identity.sales_email", label: "Sales email", kind: "email", placeholder: "sales@pypes.dev" },
      { path: "identity.founded_year", label: "Founded", kind: "number", placeholder: "2024" },
      { path: "identity.headquarters", label: "Headquarters", kind: "text", placeholder: "Salt Lake City, UT" },
    ],
  },
  {
    key: "brand",
    title: "Brand",
    description: "Visual identity. Colors + typography flow into landing pages, emails, and the console.",
    fields: [
      { path: "brand.tagline", label: "Tagline", kind: "text", placeholder: "AI-native infrastructure for job seekers." },
      { path: "brand.logo_url", label: "Logo URL", kind: "url", placeholder: "https://pypes.dev/logo.svg", hint: "Public URL or path in the repo." },
      { path: "brand.wordmark_url", label: "Wordmark URL", kind: "url", placeholder: "https://pypes.dev/wordmark.svg" },
      { path: "brand.primary_color", label: "Primary color", kind: "color", placeholder: "#10b981" },
      { path: "brand.secondary_color", label: "Secondary color", kind: "color", placeholder: "#0a0a0a" },
      { path: "brand.accent_color", label: "Accent color", kind: "color", placeholder: "#f59e0b" },
      { path: "brand.font_family", label: "Font family", kind: "text", placeholder: "Inter" },
    ],
  },
  {
    key: "offer",
    title: "Offer",
    description: "The primary thing this business sells. Multi-offer support comes later.",
    fields: [
      { path: "offer.name", label: "Offer name", kind: "text", placeholder: "Flagship coaching program" },
      { path: "offer.one_liner", label: "One-liner", kind: "text", placeholder: "Land your next job in 90 days." },
      { path: "offer.description", label: "Description", kind: "textarea", placeholder: "Full description of what this offer includes." },
      { path: "offer.price", label: "Price", kind: "money", placeholder: "16000", hint: "Whole dollars. E.g. 16000 for $16k." },
      { path: "offer.price_cadence", label: "Price cadence", kind: "select", options: ["one_time", "monthly", "annual"], placeholder: "one_time" },
      { path: "offer.stripe_price_id", label: "Stripe price ID", kind: "text", placeholder: "price_1ABC…" },
      { path: "offer.stripe_product_id", label: "Stripe product ID", kind: "text", placeholder: "prod_ABC…" },
      { path: "offer.cta_text", label: "CTA text", kind: "text", placeholder: "Apply now" },
    ],
  },
  {
    key: "copy",
    title: "Copy",
    description: "Voice + messaging. Reused across the landing page, emails, and legal docs.",
    fields: [
      { path: "copy.hero_headline", label: "Hero headline", kind: "text", placeholder: "The fastest path to a new job." },
      { path: "copy.hero_subheadline", label: "Hero subheadline", kind: "textarea", placeholder: "Two-line elaboration under the hero." },
      { path: "copy.about", label: "About", kind: "textarea", placeholder: "Who you are and why you built this." },
      { path: "copy.how_it_works", label: "How it works", kind: "textarea", placeholder: "Numbered steps or a paragraph." },
      { path: "copy.voice_notes", label: "Voice + tone", kind: "textarea", placeholder: "Direct. Warm. Never corporate.", hint: "Used to steer AI copywriting agents." },
    ],
  },
  {
    key: "legal",
    title: "Legal",
    description: "LLC filing details + policy links. Links can be anywhere — Notion, Google Doc, or a page on your site.",
    fields: [
      { path: "legal.jurisdiction", label: "Jurisdiction", kind: "text", placeholder: "Utah, USA" },
      { path: "legal.entity_type", label: "Entity type", kind: "select", options: ["LLC", "C-Corp", "S-Corp", "Sole Prop", "Partnership"], placeholder: "LLC" },
      { path: "legal.ein", label: "EIN", kind: "text", placeholder: "XX-XXXXXXX" },
      { path: "legal.registered_agent", label: "Registered agent", kind: "text" },
      { path: "legal.terms_url", label: "Terms of Service URL", kind: "url" },
      { path: "legal.privacy_url", label: "Privacy Policy URL", kind: "url" },
      { path: "legal.refund_policy_url", label: "Refund policy URL", kind: "url" },
    ],
  },
  {
    key: "integrations",
    title: "Integrations",
    description: "External IDs only — no secrets. Secrets live in External Secrets Operator (per-tenant vault).",
    fields: [
      { path: "integrations.ghl_location_id", label: "GoHighLevel location ID", kind: "text" },
      { path: "integrations.n8n_workflow_ids", label: "n8n workflow IDs", kind: "textarea", hint: "Comma-separated or one per line." },
      { path: "integrations.meta_pixel_id", label: "Meta pixel ID", kind: "text" },
      { path: "integrations.google_analytics_id", label: "Google Analytics measurement ID", kind: "text", placeholder: "G-XXXXXXX" },
      { path: "integrations.posthog_project_key", label: "PostHog project key (public)", kind: "text", placeholder: "phc_…", hint: "Public write key only. Personal API keys go in ExternalSecrets." },
      { path: "integrations.resend_audience_id", label: "Resend audience ID", kind: "text" },
      { path: "integrations.slack_webhook_channel", label: "Slack alert channel", kind: "text", placeholder: "#pypes-ops" },
    ],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────

// The profile is a plain JSON-serializable tree. We deliberately don't
// generate a discriminated union type from the schema — it's easier to keep
// the schema declarative in one file if we work with plain records.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BusinessProfile = Record<string, any>;

// ─── Path helpers ────────────────────────────────────────────────────────

export function getAtPath(obj: BusinessProfile, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function setAtPath(obj: BusinessProfile, path: string, value: unknown): BusinessProfile {
  const clone = structuredClone(obj);
  const keys = path.split(".");
  let cursor = clone as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (cursor[key] == null || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1];
  if (value === "" || value == null) {
    delete cursor[lastKey];
  } else {
    cursor[lastKey] = value;
  }
  return clone;
}

// ─── YAML round-trip ──────────────────────────────────────────────────────

export function serializeProfile(profile: BusinessProfile): string {
  const header =
    "# Business profile — declarative source of truth for this tenant.\n" +
    "# Edited via console/[tenant]/profile OR by hand + commit.\n" +
    "# Schema: console/lib/business-profile.ts\n\n";
  return header + yaml.dump(profile, { sortKeys: false, lineWidth: 100, noRefs: true });
}

export function parseProfile(text: string): BusinessProfile {
  const parsed = yaml.load(text);
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as BusinessProfile;
}

// ─── Git round-trip ──────────────────────────────────────────────────────

export function profilePath(slug: string): string {
  return `businesses/${slug}.yaml`;
}

// Fetch the profile YAML from GitHub raw. Returns null if the file doesn't
// exist yet (new tenant). Throws on network errors.
export async function loadProfile(slug: string): Promise<BusinessProfile | null> {
  if (!isConfigured()) return null;
  const owner = process.env.GITHUB_REPO!.split("/")[0];
  const repo = process.env.GITHUB_REPO!.split("/")[1];
  const branch = process.env.GITHUB_BRANCH ?? "main";
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${profilePath(slug)}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub raw ${url} → ${res.status}`);
  const text = await res.text();
  return parseProfile(text);
}

export async function saveProfile(slug: string, profile: BusinessProfile): Promise<{ commitSha: string }> {
  const path = profilePath(slug);
  const existingSha = await getFileSha(path);
  const commit = await putFile({
    path,
    content: serializeProfile(profile),
    message: existingSha
      ? `chore(${slug}): update business profile`
      : `feat(${slug}): initialize business profile`,
    sha: existingSha ?? undefined,
  });
  return { commitSha: commit.commitSha };
}
