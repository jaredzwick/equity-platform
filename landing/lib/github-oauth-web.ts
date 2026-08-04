import "server-only";
import { githubClientId, githubClientSecret, callbackUrl } from "@/lib/env";

// GitHub App web OAuth flow. Docs:
//   https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app#using-the-web-application-flow-to-generate-a-user-access-token

export type TokenResult =
  | { ok: true; accessToken: string; tokenType: string; refreshToken?: string; scope: string }
  | { ok: false; error: string; description?: string };

// Exchange the ?code= from GitHub's redirect for a user access token.
// Never throws for GitHub-side errors — returns { ok: false } so callers
// can render a friendly message. Throws only for network failures.
export async function exchangeCodeForToken(code: string): Promise<TokenResult> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: githubClientId(),
      client_secret: githubClientSecret(),
      code,
      redirect_uri: callbackUrl(),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    return { ok: false, error: `http_${res.status}` };
  }

  const data = (await res.json()) as {
    access_token?: string;
    token_type?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (data.access_token) {
    return {
      ok: true,
      accessToken: data.access_token,
      tokenType: data.token_type ?? "bearer",
      refreshToken: data.refresh_token,
      scope: data.scope ?? "",
    };
  }

  return {
    ok: false,
    error: data.error ?? "unknown_error",
    description: data.error_description,
  };
}

// Build the URL to send the user to on click of "Sign in with GitHub".
// GitHub Apps do NOT take a `scope` param — permissions are set at
// install time.
export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: githubClientId(),
    redirect_uri: callbackUrl(),
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}
