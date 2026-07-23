import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

// Session shape — stored encrypted in the client cookie.
export type Session = {
  // GitHub user access token (from the App's OAuth device flow). This is a
  // user-to-server token: can act on any repo where the App is installed AND
  // that the user has access to.
  githubToken?: string;
  // Cached user info so we don't hit /user on every page load.
  login?: string;
  avatarUrl?: string;
  // Refresh-token support for GitHub Apps that opt into short-lived tokens.
  // Left as-is for now — default GitHub App tokens don't expire.
  expiresAt?: number;
};

// SESSION_PASSWORD must be a 32+ char string in .env.local. Any non-empty
// value is accepted at type-check time; iron-session validates length at
// runtime.
function password(): string {
  const p = process.env.SESSION_PASSWORD;
  if (!p) {
    // Fallback for local dev — DO NOT ship this to prod. Encoded so it isn't
    // useful as a real secret if it leaks.
    return "equity-console-dev-only-do-not-ship-min-32-chars";
  }
  return p;
}

export const sessionOptions: SessionOptions = {
  password: password(),
  cookieName: "equity-console-session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

// Server-side helper for reading the session from a Server Component or
// Route Handler.
export async function getSession(): Promise<IronSession<Session>> {
  const store = await cookies();
  return getIronSession<Session>(store, sessionOptions);
}
