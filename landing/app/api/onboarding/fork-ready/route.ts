import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isForkReady } from "@/lib/github-fork";
import { upstreamRepo } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/onboarding/fork-ready
//
// Client (ForkStatusChip) polls this until the fork is confirmed. Response:
//   { authenticated: false }                        — no session, 401
//   { ready: true, targetRepo }                     — fork exists at
//                                                     {login}/{upstream-name}
//   { ready: false, needsFork: true, forkUrl, ... } — no fork yet; UI
//                                                     shows the manual
//                                                     "Fork on GitHub"
//                                                     button
//
// Derives the expected target repo from `{login}/{upstream-name}` — the
// session no longer carries targetRepo until the fork is confirmed here.
// Sets session.targetRepo the first time we detect the fork so downstream
// code (console writeback) can use it.
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.githubToken || !session.login) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  const upstream = upstreamRepo();
  const targetOwner = session.login;
  const targetName = upstream.name;
  const targetRepo = `${targetOwner}/${targetName}`;

  const ready = await isForkReady(session.githubToken, targetOwner, targetName);
  if (ready) {
    // Persist once so downstream code doesn't re-derive on every request.
    if (session.targetRepo !== targetRepo) {
      session.targetRepo = targetRepo;
      await session.save();
    }
    return NextResponse.json({ ready: true, targetRepo });
  }

  return NextResponse.json({
    ready: false,
    needsFork: true,
    targetRepo,
    upstream: `${upstream.owner}/${upstream.name}`,
    // Deep link to GitHub's fork UI — one-click "Create fork" for the user.
    forkUrl: `https://github.com/${upstream.owner}/${upstream.name}/fork`,
  });
}
