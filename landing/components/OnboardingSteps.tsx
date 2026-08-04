"use client";

import { useState } from "react";
import CopyableCommand from "@/components/CopyableCommand";
import ForkStatusChip from "@/components/ForkStatusChip";
import InstallAppCta from "@/components/InstallAppCta";

// Orchestrates the three onboarding steps and gates 2/3 until step 1
// (fork exists) resolves. Fork step exposes onReady → we hoist targetRepo
// so the clone/boot commands can render as soon as the fork appears
// (no page reload).
export default function OnboardingSteps({
  upstream: _upstream,
  initialTargetRepo,
  login,
}: {
  upstream: string;
  initialTargetRepo: string | null;
  login: string;
}) {
  const [targetRepo, setTargetRepo] = useState<string | null>(initialTargetRepo);

  const forkReady = targetRepo != null;
  const [, repoName] = (targetRepo ?? `${login}/equity-platform`).split("/");

  const cloneCmd = targetRepo
    ? `git clone https://github.com/${targetRepo}.git`
    : "git clone https://github.com/<your-fork>.git";
  const enterCmd = `cd ${repoName}`;
  const bootCmd = `./local/up.sh`;

  return (
    <>
      <Step
        n={1}
        title="Fork the platform repo"
        subtitle="One copy per operator. The console commits directly to your fork."
        active
        done={forkReady}
      >
        <ForkStatusChip onReady={setTargetRepo} />
      </Step>

      <Step
        n={2}
        title="Install the equity-console GitHub App on your fork"
        subtitle="Lets the local console push YAML back to your fork via the GitHub API."
        active={forkReady}
        done={false}
      >
        {forkReady ? (
          <InstallAppCta />
        ) : (
          <Waiting text="Waiting for step 1 to finish." />
        )}
      </Step>

      <Step
        n={3}
        title="Clone + boot the platform"
        subtitle={
          <>
            Requires <code>docker</code>, <code>kind</code>, <code>kubectl</code>, and{" "}
            <code>helm</code>. Takes ~3 minutes.
          </>
        }
        active={forkReady}
        done={false}
      >
        {forkReady ? (
          <div className="space-y-3">
            <CopyableCommand cmd={cloneCmd} />
            <CopyableCommand cmd={enterCmd} />
            <CopyableCommand cmd={bootCmd} />
            <p className="text-sm text-[color:var(--color-muted)]">
              When it&rsquo;s up, start the console:{" "}
              <code className="text-[color:var(--color-fg)]">
                cd console &amp;&amp; npm install &amp;&amp; npm run dev
              </code>
              , then open{" "}
              <a href="http://localhost:3030" className="underline">
                http://localhost:3030
              </a>
              .
            </p>
          </div>
        ) : (
          <Waiting text="Waiting for step 1 to finish." />
        )}
      </Step>
    </>
  );
}

function Step({
  n,
  title,
  subtitle,
  active,
  done,
  children,
}: {
  n: number;
  title: string;
  subtitle: React.ReactNode;
  active: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        "mt-8 rounded-xl border p-5 transition-opacity " +
        (active
          ? "border-white/10 bg-white/[0.02] opacity-100"
          : "border-white/5 bg-white/[0.01] opacity-60")
      }
    >
      <div className="flex items-start gap-3">
        <StepBadge n={n} done={done} active={active} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-medium text-white">{title}</h2>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">{subtitle}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  if (done) {
    return (
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"
        aria-label="Done"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
          <path
            fillRule="evenodd"
            d="M16.704 5.29a1 1 0 0 1 .006 1.415l-8.25 8.335a1 1 0 0 1-1.42 0l-3.75-3.79a1 1 0 1 1 1.42-1.41l3.04 3.073 7.54-7.617a1 1 0 0 1 1.414-.006Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    );
  }
  return (
    <div
      className={
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
        (active
          ? "bg-white/10 text-white"
          : "bg-white/5 text-[color:var(--color-muted)]")
      }
    >
      {n}
    </div>
  );
}

function Waiting({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 text-sm text-[color:var(--color-muted)]">
      <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {text}
    </div>
  );
}
