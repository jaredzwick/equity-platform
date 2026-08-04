import Link from "next/link";
import SignInButton from "@/components/SignInButton";

export const metadata = {
  title: "Docs — equity-platform",
  description: "How the hosted onramp works, and what happens after you sign in.",
};

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 prose-invert">
      <h1 className="text-3xl font-semibold tracking-tight">Quickstart</h1>
      <p className="mt-4 text-[color:var(--color-muted)]">
        The equity-platform is a one-command Kubernetes stack for running multiple
        businesses on shared local infrastructure. The hosted onramp does one thing:
        gives you your own fork of the platform repo and walks you through booting it.
      </p>

      <h2 className="mt-10 text-xl font-medium">The 30-second version</h2>
      <ol className="mt-3 list-decimal list-inside space-y-1 text-sm">
        <li>Sign in with GitHub.</li>
        <li>We fork <code>jaredzwick/equity-platform</code> to your account.</li>
        <li>Install the equity-console GitHub App on your fork.</li>
        <li>
          <code>git clone</code> your fork, then <code>./local/up.sh</code>.
        </li>
        <li>
          <code>cd console &amp;&amp; npm run dev</code> → open{" "}
          <a href="http://localhost:3030" className="underline">localhost:3030</a>.
        </li>
      </ol>

      <div className="mt-8">
        <SignInButton label="Start — sign in with GitHub" />
      </div>

      <h2 className="mt-14 text-xl font-medium">Prerequisites</h2>
      <ul className="mt-3 list-disc list-inside space-y-1 text-sm">
        <li>Docker Desktop (or Colima) running</li>
        <li>Node.js 20+</li>
        <li>
          Homebrew for macOS: <code>brew install kind kubectl helm</code>
        </li>
      </ul>

      <h2 className="mt-14 text-xl font-medium">How it works</h2>
      <p className="mt-3 text-sm">
        Sign-in triggers a standard GitHub OAuth web flow against our GitHub App. On
        callback we <code>POST /repos/{"{"}upstream{"}"}/forks</code> — GitHub creates a
        fork under your account (or returns the existing one). We store your access
        token and fork name in an encrypted session cookie and redirect you to{" "}
        <Link href="/onboarding" className="underline">/onboarding</Link>.
      </p>
      <p className="mt-3 text-sm">
        The App install step is separate from sign-in. It grants your local console
        permission to write YAML back to your fork over the GitHub API. Without it,
        every provisioning action fails with a 404.
      </p>

      <h2 className="mt-14 text-xl font-medium">Why we don&rsquo;t host the whole platform</h2>
      <p className="mt-3 text-sm">
        The console talks directly to a live Kubernetes cluster via the k8s API. Vercel
        is serverless — no cluster, no persistent connections. We keep sign-in and
        onboarding on Vercel; everything that touches your cluster stays on your
        machine. If you want a fully hosted control plane, get in touch.
      </p>

      <h2 className="mt-14 text-xl font-medium">Troubleshooting</h2>
      <dl className="mt-3 space-y-4 text-sm">
        <div>
          <dt className="font-medium">Fork is stuck &ldquo;preparing&rdquo;</dt>
          <dd className="mt-1 text-[color:var(--color-muted)]">
            GitHub fork creation is async — usually &lt;30s, sometimes up to 5 min. If
            it&rsquo;s still stuck after that, refresh the onboarding page. If the fork
            appears on your GitHub account but not here, sign out and back in to
            refresh the session.
          </dd>
        </div>
        <div>
          <dt className="font-medium">CSRF error after sign-in</dt>
          <dd className="mt-1 text-[color:var(--color-muted)]">
            Your browser blocked the state cookie (usually strict privacy extensions).
            Try again in a normal (non-private) window.
          </dd>
        </div>
        <div>
          <dt className="font-medium">Local console shows &ldquo;GitHub write failed: 404&rdquo;</dt>
          <dd className="mt-1 text-[color:var(--color-muted)]">
            The App isn&rsquo;t installed on your fork. Come back here and use the
            &ldquo;Install App&rdquo; button on{" "}
            <Link href="/onboarding" className="underline">/onboarding</Link>.
          </dd>
        </div>
      </dl>
    </div>
  );
}
