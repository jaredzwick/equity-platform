import Link from "next/link";
import { getSession } from "@/lib/session";
import SignInButton from "@/components/SignInButton";
import AnimatedSection from "@/components/AnimatedSection";
import FeatureCard from "@/components/FeatureCard";
import HowItWorks from "@/components/HowItWorks";
import HeroSceneClient from "@/components/HeroSceneClient";
import AuthErrorBanner from "@/components/AuthErrorBanner";
import TerminalPanel from "@/components/TerminalPanel";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; msg?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const session = await getSession().catch(() => null);
  const signedIn = Boolean(session?.login);
  const { error: errorCode, msg } = await searchParams;

  return (
    <>
      {errorCode && <AuthErrorBanner errorCode={errorCode} message={msg} />}
      {/* HERO — full viewport, 3D backdrop, big value prop */}
      <section className="relative min-h-[100svh] overflow-hidden">
        {/* 3D canvas background */}
        <div className="absolute inset-0 -z-10">
          <HeroSceneClient />
        </div>

        {/* Foreground content — text on left, terminal on right (desktop) */}
        <div className="relative mx-auto grid min-h-[100svh] max-w-6xl grid-cols-1 items-center gap-10 px-6 pb-24 pt-32 md:pt-40 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
          <div className="flex flex-col items-start">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-xs text-white/70 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Open source · BSL 1.1
              <span className="text-white/30">·</span>
              <a
                href="https://github.com/jaredzwick/equity-platform"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white"
              >
                Star on GitHub →
              </a>
            </div>

            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
              Run every business you own on{" "}
              <span className="bg-gradient-to-br from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                one Kubernetes platform.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
              Multi-tenant kind cluster, ArgoCD, NATS, per-business namespaces, and a
              UI-driven provisioning console —{" "}
              <span className="text-white">booted with one command</span>. Every change
              is a git commit. Every rollback is{" "}
              <code className="text-cyan-300">git revert</code>.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              {signedIn ? (
                <Link
                  href="/onboarding"
                  className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-500/50"
                >
                  Continue setup
                  <ArrowRight />
                </Link>
              ) : (
                <SignInButton label="Fork & boot in 3 minutes" />
              )}
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.08]"
              >
                Read the docs
              </Link>
            </div>

            {/* Metric row */}
            <div className="mt-14 grid w-full grid-cols-2 gap-6 sm:grid-cols-4 md:gap-8">
              <Metric label="Boot time" value="90s" />
              <Metric label="Setup commands" value="1" />
              <Metric label="Cost local" value="$0" />
              <Metric label="Rollback" value="git revert" mono />
            </div>
          </div>

          {/* Terminal panel — devtool-native visual */}
          <div className="w-full">
            <TerminalPanel />
          </div>
        </div>

        {/* Scroll cue */}
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/40">
          <div className="mx-auto mb-2 h-8 w-5 rounded-full border border-white/20 p-1">
            <div className="mx-auto h-2 w-1 animate-bounce rounded-full bg-white/60" />
          </div>
          scroll
        </div>
      </section>

      {/* WHY */}
      <AnimatedSection className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <div className="text-xs font-mono uppercase tracking-widest text-indigo-400">
            Why
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            You already know Kubernetes.{" "}
            <span className="text-white/60">
              You&rsquo;re tired of gluing the same five things together for every new
              side project.
            </span>
          </h2>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          <FeatureCard
            accent="linear-gradient(135deg,#6366f1,#8b5cf6)"
            icon={<IconBolt />}
            title="One command, one repo, one console"
            body="No wiring ArgoCD by hand. No juggling three UIs. Boot the whole stack from a single script; manage every business from a single console."
            delay={0}
          />
          <FeatureCard
            accent="linear-gradient(135deg,#ec4899,#f472b6)"
            icon={<IconGit />}
            title="Git is the truth"
            body="Every action from the console commits YAML to your repo. Nothing is imperative. Nothing lives only in kubectl. Revert = redeploy."
            delay={0.1}
          />
          <FeatureCard
            accent="linear-gradient(135deg,#06b6d4,#22d3ee)"
            icon={<IconLayers />}
            title="Multi-tenant by design"
            body="Namespace-per-business, shared ArgoCD, shared observability. Add a business from a form. See every business in one master view."
            delay={0.2}
          />
        </div>
      </AnimatedSection>

      {/* HOW IT WORKS */}
      <AnimatedSection id="how" className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-mono uppercase tracking-widest text-fuchsia-400">
            How it works
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Zero to running platform in four steps.
          </h2>
          <p className="mt-4 text-white/60">
            The hosted onramp handles sign-in and fork. Your machine runs the actual
            platform — we never touch your cluster.
          </p>
        </div>
        <div className="mt-16 md:mt-20">
          <HowItWorks />
        </div>
      </AnimatedSection>

      {/* STACK */}
      <AnimatedSection className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-cyan-400">
              What&rsquo;s in the box
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Boring tech, wired for you.
            </h2>
            <p className="mt-4 text-white/60">
              Every component is pinned, kubeconform-validated, and reversible. If you
              want to swap something out, it&rsquo;s one Helm values file.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["kind", "Local Kubernetes"],
              ["ArgoCD v3.4", "GitOps engine"],
              ["NATS JetStream", "Events + queues"],
              ["External Secrets", "Backend-agnostic secrets"],
              ["Prometheus", "Metrics"],
              ["Grafana", "Dashboards"],
              ["envoy-gateway", "Ingress"],
              ["Next.js 15", "Console UI"],
            ].map(([name, role]) => (
              <li
                key={name}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur"
              >
                <div className="font-medium text-white">{name}</div>
                <div className="mt-1 text-xs text-white/50">{role}</div>
              </li>
            ))}
          </ul>
        </div>
      </AnimatedSection>

      {/* CTA */}
      <AnimatedSection className="relative mx-auto max-w-6xl px-6 pb-32 pt-16">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/20 via-fuchsia-500/15 to-cyan-500/10 p-10 md:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.35),transparent_60%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.25),transparent_60%)]" />
          <div className="relative">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Give it three minutes.
            </h2>
            <p className="mt-4 max-w-xl text-white/70">
              Sign in with GitHub. We fork the repo. You clone and run{" "}
              <code className="text-cyan-300">./local/up.sh</code>. That&rsquo;s the whole thing.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              {signedIn ? (
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg transition hover:bg-white/90"
                >
                  Continue setup
                  <ArrowRight />
                </Link>
              ) : (
                <SignInButton />
              )}
              <a
                href="https://github.com/jaredzwick/equity-platform"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.08]"
              >
                Star on GitHub
              </a>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </>
  );
}

function Metric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div
        className={`text-2xl font-semibold text-white md:text-3xl ${
          mono ? "font-mono text-xl md:text-2xl" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-white/50">{label}</div>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGit() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M18 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 6V6m0 6c0 2 3 2 3 4M12 6c0 2 3 2 3 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
