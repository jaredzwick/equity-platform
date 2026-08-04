import Link from "next/link";
import SignInButton from "@/components/SignInButton";
import { getSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getSession().catch(() => null);
  const signedIn = Boolean(session?.login);

  return (
    <div className="mx-auto max-w-4xl px-6 py-24">
      <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
        One-command Kubernetes platform for the sub-agency model.
      </h1>
      <p className="mt-6 text-lg text-[color:var(--color-muted)] max-w-2xl">
        Run multiple businesses on shared infra. Boot locally in 3 min. Provision new apps
        from the UI &mdash; every change is a git commit, every rollback is a{" "}
        <code className="text-sm px-1 py-0.5 rounded bg-white/5">git revert</code>.
      </p>

      <div className="mt-10 flex flex-wrap gap-3">
        {signedIn ? (
          <Link
            href="/onboarding"
            className="rounded-md bg-[color:var(--color-accent)] px-5 py-2.5 text-white font-medium hover:opacity-90"
          >
            Continue setup &rarr;
          </Link>
        ) : (
          <SignInButton />
        )}
        <Link
          href="/docs"
          className="rounded-md border border-[color:var(--color-border)] px-5 py-2.5 font-medium hover:bg-white/5"
        >
          Read the docs
        </Link>
      </div>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        <Feature
          title="Fork &amp; boot"
          body="Sign in with GitHub, we fork the platform repo to your account. Clone it, run ./local/up.sh, cluster is up in 90 seconds."
        />
        <Feature
          title="Provision from the UI"
          body="Fill a form to spin up a new business or app. The console writes YAML to your fork; ArgoCD reconciles."
        />
        <Feature
          title="Git-native rollback"
          body="Every change is a commit. Revert lands via GitHub's one-click revert PR. ArgoCD walks the cluster back."
        />
      </div>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] p-5">
      <h3 className="font-medium" dangerouslySetInnerHTML={{ __html: title }} />
      <p className="mt-2 text-sm text-[color:var(--color-muted)]">{body}</p>
    </div>
  );
}
