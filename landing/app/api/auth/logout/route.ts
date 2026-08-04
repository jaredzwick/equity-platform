import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { siteUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/logout — destroys the session cookie and redirects home.
// POST (not GET) so a preflight fetch from a phishing page can't sign
// someone out via <img src>.
export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(siteUrl(), { status: 303 });
}
