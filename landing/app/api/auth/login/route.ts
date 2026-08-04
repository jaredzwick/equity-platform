import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { authorizeUrl } from "@/lib/github-oauth-web";
import { stateCookieName, stateCookieMaxAge } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/login
// Generates a CSRF state, stashes it in a short-lived cookie, redirects the
// user to GitHub's authorize screen.
export async function GET(): Promise<NextResponse> {
  const state = randomBytes(32).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set({
    name: stateCookieName,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: stateCookieMaxAge,
  });
  return res;
}
