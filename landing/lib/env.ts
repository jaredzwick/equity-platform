import "server-only";

// Typed access to required env vars. Every getter throws on first call in
// prod if the var is missing, so misconfigured deploys fail loudly at the
// first request instead of degrading silently. Never call these from client
// components or module top-level (they'd break `next build`).

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `${name} not set. See landing/.env.example.`,
    );
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

export function githubClientId(): string {
  return required("GITHUB_APP_CLIENT_ID");
}

export function githubClientSecret(): string {
  return required("GITHUB_APP_CLIENT_SECRET");
}

export function githubAppSlug(): string {
  return optional("GITHUB_APP_SLUG", "equity-console");
}

export function sessionPassword(): string {
  const v = process.env.SESSION_PASSWORD;
  if (!v || v.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_PASSWORD must be set to a 32+ char string in production.",
      );
    }
    return "landing-dev-only-do-not-ship-this-value-32ch";
  }
  return v;
}

export function upstreamRepo(): { owner: string; name: string } {
  const raw = optional("UPSTREAM_REPO", "jaredzwick/equity-platform");
  const [owner, name] = raw.split("/");
  if (!owner || !name) {
    throw new Error(`UPSTREAM_REPO must be owner/name (got: ${raw})`);
  }
  return { owner, name };
}

// Public — safe to expose via NEXT_PUBLIC_. Used to build OAuth redirect_uri.
export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!raw) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL not set (and no VERCEL_URL fallback available).",
    );
  }
  return raw.replace(/\/+$/, "");
}

export function callbackUrl(): string {
  return `${siteUrl()}/api/auth/callback`;
}
