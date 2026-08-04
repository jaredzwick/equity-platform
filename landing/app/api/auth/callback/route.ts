import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken } from "@/lib/github-oauth-web";
import { fetchUser } from "@/lib/github-user";
import { upsertBuyerByGithub } from "@/lib/lamboapp-backend";
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
//   3. Fetch user identity (id, login, name, avatar, email) via /user +
//      /user/emails fallback.
//   4. POST /lamboapp/buyers/upsert-by-github on the pypes Go API so a
//      buyers row exists (or is attached to an existing dogfood row by
//      email). This makes the /api/buyer/me proxy return data on the
//      next request rather than 404.
//   5. Persist identity in the iron-session.
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

  // Split GitHub's single-string "name" into first/last for the backend's
  // AppFields / display. Best-effort — nothing depends on parsing correctly.
  const firstName = user.name?.split(" ")[0] ?? "";
  const lastName = user.name?.split(" ").slice(1).join(" ") ?? "";

  // Backend upsert. When the user has a private email + declined the
  // email.readonly scope, user.email may be "" — the backend rejects
  // that with 422. In that case we bail before session.save() so the
  // next sign-in attempt (after they authorize email) can succeed.
  if (!user.email) {
    return redirectHome("missing_email", "grant email access on the GitHub App to continue");
  }

  const buyerResult = await upsertBuyerByGithub({
    githubId: user.id,
    githubLogin: user.login,
    email: user.email,
    avatarUrl: user.avatarUrl,
    firstName,
    lastName,
  });

  if (!buyerResult.ok) {
    // 409 = email owned by different github account. 422 = missing
    // required field. Both are recoverable — surface a message the
    // landing page can display.
    if (buyerResult.status === 409) {
      return redirectHome("email_owned", "this email is already linked to a different github account");
    }
    return redirectHome(`backend_${buyerResult.status}`, buyerResult.error);
  }

  const session = await getSession();
  session.githubToken = tokenResult.accessToken;
  session.login = user.login;
  session.avatarUrl = user.avatarUrl;
  session.githubId = user.id;
  session.name = user.name;
  session.email = user.email;
  session.buyerId = buyerResult.data.buyer_id;
  await session.save();

  // First-time buyer with no buy-box → onboarding. Returning buyer
  // with buy-box → dashboard (renders digest history + subscription).
  // has_buy_box is false for both new signups and attached dogfood
  // buyers who happened to lack a buy-box; both should hit onboarding.
  const target = buyerResult.data.has_buy_box ? "/dashboard" : "/onboarding";
  const res = NextResponse.redirect(`${siteUrl()}${target}`);
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
