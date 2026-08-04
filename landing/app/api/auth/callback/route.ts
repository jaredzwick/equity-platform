import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken } from "@/lib/github-oauth-web";
import { fetchUser } from "@/lib/github-user";
import { ensureFork } from "@/lib/github-fork";
import { getSession, stateCookieName } from "@/lib/session";
import { siteUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/callback?code=X&state=Y
// End-to-end sign-in step:
//   1. Verify state matches the cookie we set in /api/auth/login (CSRF).
//   2. Exchange code for a user access token.
//   3. Fetch user identity for the session chip.
//   4. Fork upstream repo (idempotent).
//   5. Persist { githubToken, login, avatarUrl, targetRepo } in the session.
//   6. Redirect to /onboarding.
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

  const fork = await ensureFork(tokenResult.accessToken);
  if (!fork.ok) {
    return redirectHome(`fork_${fork.error}`);
  }

  const session = await getSession();
  session.githubToken = tokenResult.accessToken;
  session.login = user.login;
  session.avatarUrl = user.avatarUrl;
  session.githubId = user.id;
  session.targetRepo = fork.fullName;
  await session.save();

  const res = NextResponse.redirect(`${siteUrl()}/onboarding`);
  // Clear the state cookie now that we've consumed it.
  res.cookies.delete(stateCookieName);
  return res;
}

function redirectHome(errorCode: string): NextResponse {
  const url = new URL(`${siteUrl()}/?error=${encodeURIComponent(errorCode)}`);
  const res = NextResponse.redirect(url);
  res.cookies.delete(stateCookieName);
  return res;
}
