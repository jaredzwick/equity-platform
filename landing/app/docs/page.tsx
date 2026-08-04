import type { Metadata } from "next";
import Link from "next/link";
import DocsIcon from "@/components/DocsIcon";
import { listDocsCategories, listDocsTopics } from "@/lib/docs-content";

const SITE_URL = "https://www.lamboapp.com";

export const metadata: Metadata = {
  title: "Docs — equity-platform + LamboApp",
  description:
    "How the one-command Kubernetes platform works, how the AI deal-sourcing layer screens ~100 businesses a day, and how to self-host all of it.",
  keywords: [
    "equity-platform docs",
    "LamboApp documentation",
    "GitOps",
    "Kubernetes platform",
    "self-hosting",
    "AI deal sourcing",
  ],
  alternates: { canonical: "/docs" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/docs`,
    title: "Docs — equity-platform + LamboApp",
    description:
      "Everything from the 3-minute quickstart to self-hosting to how the AI scores every deal.",
  },
};

export default async function DocsIndexPage() {
  const [categories, allTopics] = await Promise.all([
    listDocsCategories(),
    listDocsTopics(),
  ]);

  const startHere = allTopics.find((t) => t.category === "Start here");
  const remaining = categories.filter((c) => c.name !== "Start here");

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12 max-w-2xl">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-yellow-400">
          Docs
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          How the machine works.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-white/70">
          A one-command Kubernetes platform with an AI deal-sourcing layer on top.
          Everything here is open source (BSL 1.1 → Apache 2.0 in 2030). Self-host
          it forever.
        </p>
      </header>

      {startHere && (
        <Link
          href={`/docs/${startHere.slug}`}
          className="group mb-16 block overflow-hidden rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/[0.08] via-orange-500/[0.04] to-transparent p-8 transition-colors hover:border-yellow-400/50"
        >
          <div className="flex items-start gap-5">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-yellow-500/40 bg-yellow-500/[0.08] text-yellow-300">
              <DocsIcon name={startHere.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-mono uppercase tracking-wider text-yellow-400">
                Start here · {startHere.readingMinutes} min read
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white group-hover:text-yellow-200">
                {startHere.title}
              </h2>
              <p className="mt-2 text-base leading-relaxed text-white/70">
                {startHere.summary}
              </p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-yellow-400 group-hover:text-yellow-300">
                Read it
                <span aria-hidden>→</span>
              </p>
            </div>
          </div>
        </Link>
      )}

      <div className="space-y-14">
        {remaining.map((cat) => (
          <section key={cat.name} aria-labelledby={`cat-${cat.name}`}>
            <h2
              id={`cat-${cat.name}`}
              className="mb-5 text-xs font-mono font-semibold uppercase tracking-[0.2em] text-white/50"
            >
              {cat.name}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {cat.topics.map((t) => (
                <li key={t.slug}>
                  <Link
                    href={`/docs/${t.slug}`}
                    className="group flex h-full gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-black/40 text-white/60 transition-colors group-hover:border-yellow-500/40 group-hover:text-yellow-300">
                      <DocsIcon name={t.icon} className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] font-semibold leading-tight text-white group-hover:text-yellow-200">
                        {t.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                        {t.summary}
                      </p>
                      <p className="mt-2 text-xs text-white/40">
                        {t.readingMinutes} min read
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {allTopics.length === 0 && (
        <p className="mt-10 text-sm text-white/50">No docs yet.</p>
      )}

      <section
        aria-labelledby="get-in-touch"
        className="mt-16 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8"
      >
        <h2
          id="get-in-touch"
          className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-white/50"
        >
          Something missing?
        </h2>
        <p className="mt-3 text-lg font-semibold text-white">
          Open an issue or a PR on GitHub.
        </p>
        <p className="mt-3 text-base leading-relaxed text-white/70">
          The docs live in <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[13px] text-yellow-200">landing/content/docs/</code>{" "}
          on the repo. Every markdown file is a page. Drop one in, open a PR, it
          ships on the next deploy.
        </p>
        <a
          href="https://github.com/jaredzwick/equity-platform"
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-5 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg transition hover:shadow-orange-500/60"
        >
          jaredzwick/equity-platform →
        </a>
      </section>
    </main>
  );
}
