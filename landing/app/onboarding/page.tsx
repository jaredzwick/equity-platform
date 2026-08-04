import { redirect } from "next/navigation";
import Link from "next/link";
import OnboardingSteps from "@/components/OnboardingSteps";
import { getSession } from "@/lib/session";
import { upstreamRepo } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  // Only redirect when NOT signed in. Missing targetRepo is fine — the fork
  // step handles that case with a manual CTA.
  if (!session.login) {
    redirect("/?error=not_authenticated");
  }

  const upstream = upstreamRepo();
  // If the session already knows the fork, hand it to the client so the
  // clone/boot commands can render on first paint (no flicker while the
  // client polls fork-ready to re-confirm).
  const initialTargetRepo = session.targetRepo ?? null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">You&rsquo;re signed in.</h1>
        <div className="flex items-center gap-3">
          {session.avatarUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={session.avatarUrl} alt={session.login} className="h-6 w-6 rounded-full" />
          )}
          <span className="text-sm text-[color:var(--color-muted)]">{session.login}</span>
          <form action="/api/auth/logout" method="post">
            <button className="text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]">
              sign out
            </button>
          </form>
        </div>
      </div>

      <p className="mt-4 text-[color:var(--color-muted)]">
        Three quick steps to a running platform on your machine. We never touch your cluster —
        you run everything locally.
      </p>

      <OnboardingSteps
        upstream={`${upstream.owner}/${upstream.name}`}
        initialTargetRepo={initialTargetRepo}
        login={session.login}
      />

      <section className="mt-12 border-t border-[color:var(--color-border)] pt-6 text-sm text-[color:var(--color-muted)]">
        Stuck? See the{" "}
        <Link href="/docs" className="underline hover:text-[color:var(--color-fg)]">
          quickstart docs
        </Link>{" "}
        or file an issue at{" "}
        <a
          href={`https://github.com/${upstream.owner}/${upstream.name}/issues`}
          className="underline hover:text-[color:var(--color-fg)]"
          target="_blank"
          rel="noreferrer"
        >
          github.com/{upstream.owner}/{upstream.name}/issues
        </a>
        .
      </section>
    </div>
  );
}
