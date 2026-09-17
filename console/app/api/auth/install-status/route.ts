import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { checkAppInstall } from "@/lib/github-oauth";
import { resolveTargetRepo, BackupDisabledError } from "@/lib/github";

export const runtime = "nodejs";

// GET /api/auth/install-status
//
// Which repo the sidebar checks the App-install against. Uses the same
// precedence chain as /master/github and every write path
// (resolveTargetRepo → backup config first). Previously read
// session.targetRepo directly with a hardcoded fallback, which drifted
// from the /master/github view whenever a stale session.targetRepo lingered
// (e.g. left over from an earlier UPSTREAM_REPO / GITHUB_REPO value).

export async function GET() {
  const session = await getSession();
  if (!session.githubToken || !session.login) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  let targetRepo: string;
  try {
    const target = await resolveTargetRepo();
    targetRepo = `${target.owner}/${target.name}`;
  } catch (e) {
    if (e instanceof BackupDisabledError) {
      // Backup disabled and no other target resolvable — nothing to check.
      return NextResponse.json({
        checking: false,
        error: "No backup target configured. Enable GitHub backup in Agency → GitHub.",
      });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  try {
    const status = await checkAppInstall(session.githubToken, targetRepo);
    return NextResponse.json(status);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg, targetRepo }, { status: 500 });
  }
}
