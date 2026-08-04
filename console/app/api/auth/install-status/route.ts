import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkAppInstall } from "@/lib/github-oauth";

export const runtime = "nodejs";

// GET /api/auth/install-status
// Returns whether the equity-console App is installed on the user's target
// repo, and if not, the URL they should visit to install it.

export async function GET() {
  const session = await getSession();
  if (!session.githubToken || !session.login) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const targetRepo = session.targetRepo ?? `${session.login}/equity-platform`;
  try {
    const status = await checkAppInstall(session.githubToken, targetRepo);
    return NextResponse.json(status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
