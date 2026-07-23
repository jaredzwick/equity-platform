// Client-safe schema + types for the master agency config. No server-only
// imports — bundled into the AgencyEditor client component.
//
// Server-only counterpart (lib/agency.ts) has load/save + YAML round-trip.
//
// One file per platform: agency.yaml at the repo root. Holds master-level
// integration credentials + defaults that apply to newly created tenants.

// Reuse the same field/section types as the business profile — deliberately
// shared, so a single "schema-driven editor" pattern serves both.
export type {
  Field,
  Section,
  FieldKind,
} from "@/lib/business-profile-schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgencyConfig = Record<string, any>;

import type { Section } from "@/lib/business-profile-schema";
import { getAtPath, setAtPath } from "@/lib/business-profile-schema";
export { getAtPath, setAtPath };

export const AGENCY_PATH = "agency.yaml";

export const AGENCY_SCHEMA: Section[] = [
  {
    key: "identity",
    title: "Agency identity",
    description: "The master org that owns every business under this platform.",
    fields: [
      { path: "identity.legal_name", label: "Legal name", kind: "text", required: true, placeholder: "Pypes LLC" },
      { path: "identity.display_name", label: "Display name", kind: "text", placeholder: "Pypes" },
      { path: "identity.primary_domain", label: "Primary domain", kind: "url", placeholder: "https://pypes.dev", hint: "Your agency landing page + SaaS host." },
      { path: "identity.contact_email", label: "Contact email", kind: "email", placeholder: "hello@pypes.dev" },
      { path: "identity.headquarters", label: "Headquarters", kind: "text", placeholder: "Salt Lake City, UT" },
    ],
  },
  {
    key: "posthog",
    title: "PostHog (product analytics)",
    description: "One org, per-tenant projects. Personal API key lets console auto-create a project per new business.",
    fields: [
      { path: "posthog.host", label: "Host", kind: "url", placeholder: "https://us.posthog.com" },
      { path: "posthog.org_id", label: "Org ID", kind: "text", placeholder: "01H0000000000000000000" },
      { path: "posthog.personal_api_key_ref", label: "Personal API key (ExternalSecret name)", kind: "text", placeholder: "posthog-personal-api-key", hint: "Console reads the actual key from this ExternalSecret; the secret lives in the cluster vault, not in git." },
    ],
  },
  {
    key: "resend",
    title: "Resend (transactional email)",
    description: "One Resend account grows a shared deliverability reputation; per-tenant sending domains attach to it.",
    fields: [
      { path: "resend.api_key_ref", label: "API key (ExternalSecret name)", kind: "text", placeholder: "resend-api-key" },
      { path: "resend.default_from_domain", label: "Default from domain", kind: "text", placeholder: "pypes.dev" },
      { path: "resend.webhook_secret_ref", label: "Webhook signing secret (ExternalSecret name)", kind: "text", placeholder: "resend-webhook-secret" },
    ],
  },
  {
    key: "stripe",
    title: "Stripe (payments)",
    description: "'Per-tenant' recommended: separate Stripe account per LLC for clean tax + books. 'Shared' uses one account with per-tenant products.",
    fields: [
      { path: "stripe.mode", label: "Mode", kind: "select", options: ["per_tenant", "shared_account"], placeholder: "per_tenant" },
      { path: "stripe.master_api_key_ref", label: "Master API key (only if shared mode)", kind: "text", placeholder: "stripe-master-api-key" },
      { path: "stripe.default_currency", label: "Default currency", kind: "select", options: ["usd", "eur", "gbp", "cad", "aud"], placeholder: "usd" },
    ],
  },
  {
    key: "meta",
    title: "Meta (ads + pixel)",
    description: "Business Manager holds per-tenant ad accounts + pixels. IDs only; credentials via ExternalSecret.",
    fields: [
      { path: "meta.business_id", label: "Business Manager ID", kind: "text" },
      { path: "meta.system_user_token_ref", label: "System user token (ExternalSecret name)", kind: "text", placeholder: "meta-system-user-token" },
    ],
  },
  {
    key: "google",
    title: "Google (Ads + Business Profile)",
    description: "Google Business Profile provides local presence + Google Ads billing. One MCC (Manager Account) can hold per-tenant client accounts.",
    fields: [
      { path: "google.mcc_customer_id", label: "Ads MCC customer ID", kind: "text", placeholder: "123-456-7890" },
      { path: "google.developer_token_ref", label: "Ads developer token (ExternalSecret name)", kind: "text", placeholder: "google-ads-developer-token" },
      { path: "google.oauth_refresh_token_ref", label: "OAuth refresh token (ExternalSecret name)", kind: "text", placeholder: "google-oauth-refresh-token" },
      { path: "google.business_profile_account_id", label: "Business Profile account ID", kind: "text", placeholder: "accounts/1234567890" },
    ],
  },
  {
    key: "slack",
    title: "Slack (ops notifications)",
    description: "Your ops workspace. Per-tenant channels get created on new-business setup.",
    fields: [
      { path: "slack.workspace_url", label: "Workspace URL", kind: "url", placeholder: "https://pypes.slack.com" },
      { path: "slack.bot_token_ref", label: "Bot token (ExternalSecret name)", kind: "text", placeholder: "slack-bot-token", hint: "chat:write + channels:manage scopes required for auto-channel creation." },
      { path: "slack.default_alert_channel", label: "Default alert channel", kind: "text", placeholder: "#agency-alerts" },
    ],
  },
  {
    key: "defaults",
    title: "New-business defaults",
    description: "Applied to new tenants unless overridden per-business.",
    fields: [
      { path: "defaults.subdomain_pattern", label: "Subdomain pattern", kind: "text", placeholder: "{slug}.pypes.dev", hint: "{slug} = tenant slug. E.g. myshop.pypes.dev." },
      { path: "defaults.support_email_pattern", label: "Support email pattern", kind: "text", placeholder: "support+{slug}@pypes.dev" },
      { path: "defaults.primary_color", label: "Default brand primary color", kind: "color", placeholder: "#10b981" },
      { path: "defaults.font_family", label: "Default font", kind: "text", placeholder: "Inter" },
    ],
  },
];
