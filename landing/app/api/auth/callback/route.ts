import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken } from "@/lib/github-oauth-web";
import { fetchUser } from "@/lib/github-user";
import { getSession, stateCookieName } from "@/lib/session";
import { siteUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/callback?code=X&state=Y
//
// Sign-in ONLY. Fork provisioning moved to /onboarding — the OAuth flow
// used to auto-fork on this callback, but the fork API needs "Administration:
// write" on the App and often fails with 403 (bad first impression: user
// clicks "Sign in" and lands on an error page). The onboarding page now
// handles forking explicitly, with visible status + a manual fallback.
//
// Steps:
//   1. Verify state matches the cookie we set in /api/auth/login (CSRF).
//   2. Exchange code for a user access token.
//   3. Fetch user identity for the session chip.
//   4. Persist { githubToken, login, avatarUrl, githubId } in the session.
//      targetRepo is set later by /onboarding once the fork exists.
//   5. Redirect to /onboarding.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return redirectHome(`oauth_${oauthError}`);
  }
  if (!code || !state) {
    return redirectHome("missing_code_or_state");
  }

  const store = await cookies();
  const stateCookie = store.get(stateCookieName)?.value;
  if (!stateCookie || stateCookie !== state) {
    return redirectHome("csrf");
  }

  const tokenResult = await exchangeCodeForToken(code);
  if (!tokenResult.ok) {
    return redirectHome(`token_${tokenResult.error}`);
  }

  let user;
  try {
    user = await fetchUser(tokenResult.accessToken);
  } catch {
    return redirectHome("user_fetch_failed");
  }

  const session = await getSession();
  session.githubToken = tokenResult.accessToken;
  session.login = user.login;
  session.avatarUrl = user.avatarUrl;
  session.githubId = user.id;
  await session.save();

  const res = NextResponse.redirect(`${siteUrl()}/onboarding`);
  res.cookies.delete(stateCookieName);
  return res;
}

function redirectHome(errorCode: string, message?: string): NextResponse {
  const url = new URL(`${siteUrl()}/?error=${encodeURIComponent(errorCode)}`);
  if (message) url.searchParams.set("msg", message);
  const res = NextResponse.redirect(url);
  res.cookies.delete(stateCookieName);
  return res;
}
