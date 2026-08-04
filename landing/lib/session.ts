import "server-only";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { sessionPassword } from "@/lib/env";

export type Session = {
  githubToken?: string;
  login?: string;
  avatarUrl?: string;
  githubId?: number;
  // Buyer-side identity: cached after the OAuth callback POSTs to
  // pypes /lamboapp/buyers/upsert-by-github. Any authed proxy route
  // reads githubId from here and forwards to the backend as
  // X-Buyer-Github-Id. name + email cached for the dashboard chip and
  // for PATCH /buy-box flows that don't need to re-hit GitHub.
  name?: string;
  email?: string;
  buyerId?: string;
  // Owner/name of the user's fork of the upstream template.
  targetRepo?: string;
};

// Short-lived cookie for the OAuth `state` CSRF token. Separate from the
// main session so it can be deleted after the callback without touching
// user identity.
export const stateCookieName = "equity-landing-oauth-state";
export const stateCookieMaxAge = 60 * 10; // 10 min

// Built lazily — reading env at module scope crashes `next build` when it
// collects data for /_not-found without production env vars set.
function sessionOptions(): SessionOptions {
  return {
    password: sessionPassword(),
    cookieName: "equity-landing-session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    },
  };
}

export async function getSession(): Promise<IronSession<Session>> {
  const store = await cookies();
  return getIronSession<Session>(store, sessionOptions());
}
