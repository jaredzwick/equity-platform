import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// GET /api/auth/install-status
// Returns whether the equity-console App is installed on the user's target
// repo, and if not, the URL they should visit to install it.
//
// Uses the user's OAuth token to hit /user/installations, filters to the
// target repo. GitHub's user-to-server tokens include the list of
// installations the user has access to.

const APP_SLUG = "equity-console"; // must match the App name on github.com/apps/<slug>

export async function GET() {
  const session = await getSession();
  if (!session.githubToken || !session.login) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const targetRepo = session.targetRepo ?? `${session.login}/equity-platform`;
  const [owner, repo] = targetRepo.split("/");

  try {
    // Check installations the user has access to.
    const res = await fetch("https://api.github.com/user/installations", {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${session.githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`GET /user/installations → ${res.status}`);
    const data = (await res.json()) as {
      installations: Array<{ id: number; account: { login: string } }>;
    };

    // For each installation on the target account, check if it covers the
    // target repo.
    const installations = data.installations.filter(
      (i) => i.account.login.toLowerCase() === owner.toLowerCase(),
    );

    if (installations.length === 0) {
      return NextResponse.json({
        installed: false,
        targetRepo,
        installUrl: `https://github.com/apps/${APP_SLUG}/installations/new`,
      });
    }

    // Check if any installation covers the target repo. For "all repos" installs
    // we're done; for selected-repos installs we need to check the repo list.
    for (const inst of installations) {
      const reposRes = await fetch(
        `https://api.github.com/user/installations/${inst.id}/repositories`,
        {
          headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${session.githubToken}`,
            "X-GitHub-Api-Version": "2022-11-28",
          },
          cache: "no-store",
        },
      );
      if (!reposRes.ok) continue;
      const repos = (await reposRes.json()) as {
        repositories: Array<{ full_name: string }>;
      };
      const match = repos.repositories.some(
        (r) => r.full_name.toLowerCase() === targetRepo.toLowerCase(),
      );
      if (match) {
        return NextResponse.json({ installed: true, targetRepo, installationId: inst.id });
      }
    }

    return NextResponse.json({
      installed: false,
      targetRepo,
      installUrl: `https://github.com/apps/${APP_SLUG}/installations/new`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
