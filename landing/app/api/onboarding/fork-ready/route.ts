import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isForkReady } from "@/lib/github-fork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/onboarding/fork-ready
// Client polls this until it returns { ready: true }. Uses the session's
// token to check GET /repos/{login}/{name}. Fork creation is async on
// GitHub's side (usually <30s, worst case 5 min).
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.githubToken || !session.targetRepo) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const [owner, name] = session.targetRepo.split("/");
  const ready = await isForkReady(session.githubToken, owner, name);
  return NextResponse.json({ ready, targetRepo: session.targetRepo });
}
