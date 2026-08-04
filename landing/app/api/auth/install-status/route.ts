import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { githubAppSlug } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/install-status
// Reports whether the GitHub App is installed on the user's fork. Used by
// the onboarding page to render the "Install App" CTA vs a green ✓ chip.
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session.githubToken || !session.login || !session.targetRepo) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const appSlug = githubAppSlug();
  const [owner, repo] = session.targetRepo.split("/");
  const installUrl = `https://github.com/apps/${appSlug}/installations/new`;

  try {
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

    const candidateInstalls = data.installations.filter(
      (i) => i.account.login.toLowerCase() === owner.toLowerCase(),
    );

    if (candidateInstalls.length === 0) {
      return NextResponse.json({
        installed: false,
        targetRepo: session.targetRepo,
        installUrl,
      });
    }

    for (const inst of candidateInstalls) {
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
        (r) => r.full_name.toLowerCase() === session.targetRepo!.toLowerCase(),
      );
      if (match) {
        return NextResponse.json({
          installed: true,
          targetRepo: session.targetRepo,
          installationId: inst.id,
        });
      }
    }

    return NextResponse.json({
      installed: false,
      targetRepo: session.targetRepo,
      installUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
