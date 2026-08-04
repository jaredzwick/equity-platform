import { redirect } from "next/navigation";
import Link from "next/link";
import CopyableCommand from "@/components/CopyableCommand";
import ForkStatusChip from "@/components/ForkStatusChip";
import InstallAppCta from "@/components/InstallAppCta";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session.login || !session.targetRepo) {
    redirect("/?error=not_authenticated");
  }

  const [owner, name] = session.targetRepo.split("/");
  const cloneCmd = `git clone https://github.com/${owner}/${name}.git`;
  const enterCmd = `cd ${name}`;
  const bootCmd = `./local/up.sh`;

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
        We&rsquo;ve forked the platform to your GitHub account. Here&rsquo;s how to boot it locally.
      </p>

      <section className="mt-8">
        <ForkStatusChip />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">1. Install the App on your fork</h2>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Gives the local console permission to commit YAML back to your fork.
        </p>
        <div className="mt-4">
          <InstallAppCta />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">2. Clone your fork</h2>
        <div className="mt-3 space-y-2">
          <CopyableCommand cmd={cloneCmd} />
          <CopyableCommand cmd={enterCmd} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium">3. Boot the platform</h2>
        <p className="mt-1 text-sm text-[color:var(--color-muted)]">
          Requires <code>docker</code>, <code>kind</code>, <code>kubectl</code>, and{" "}
          <code>helm</code>. Takes ~3 minutes.
        </p>
        <div className="mt-3">
          <CopyableCommand cmd={bootCmd} />
        </div>
        <p className="mt-3 text-sm text-[color:var(--color-muted)]">
          When it&rsquo;s up, start the console:{" "}
          <code className="text-[color:var(--color-fg)]">cd console &amp;&amp; npm install &amp;&amp; npm run dev</code>
          , then open <a href="http://localhost:3030" className="underline">http://localhost:3030</a>.
        </p>
      </section>

      <section className="mt-12 border-t border-[color:var(--color-border)] pt-6 text-sm text-[color:var(--color-muted)]">
        Stuck? See the{" "}
        <Link href="/docs" className="underline hover:text-[color:var(--color-fg)]">
          quickstart docs
        </Link>{" "}
        or file an issue at{" "}
        <a
          href={`https://github.com/${owner}/${name}/issues`}
          className="underline hover:text-[color:var(--color-fg)]"
          target="_blank"
          rel="noreferrer"
        >
          github.com/{owner}/{name}/issues
        </a>
        .
      </section>
    </div>
  );
}
