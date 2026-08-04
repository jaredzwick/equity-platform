import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/user — returns the session's cached identity, or 401.
// Never returns the access token — that stays server-side.
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.login) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    login: session.login,
    avatarUrl: session.avatarUrl,
    targetRepo: session.targetRepo,
  });
}
