import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import DocsIcon from "@/components/DocsIcon";
import DocsMarkdown from "@/components/DocsMarkdown";
import { getDocsTopic, listDocsTopics } from "@/lib/docs-content";

const SITE_URL = "https://www.lamboapp.com";

type Props = {
  params: Promise<{ slug: string }>;
};

// Pre-render every doc at build time so crawlers see static HTML. Auto-discovered
// from content/docs/*.md — no manual registry.
export async function generateStaticParams() {
  const topics = await listDocsTopics();
  return topics.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getDocsTopic(slug);
  if (!topic) {
    return { title: "Not found · LamboApp" };
  }
  const url = `${SITE_URL}/docs/${slug}`;
  return {
    title: topic.meta.title,
    description: topic.meta.description,
    keywords: topic.meta.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: topic.meta.title,
      description: topic.meta.description,
      modifiedTime: topic.meta.lastmod,
    },
    twitter: {
      card: "summary_large_image",
      title: topic.meta.title,
      description: topic.meta.description,
    },
  };
}

export default async function DocsTopicPage({ params }: Props) {
  const { slug } = await params;
  const topic = await getDocsTopic(slug);
  if (!topic) notFound();

  const allTopics = await listDocsTopics();
  const idx = allTopics.findIndex((t) => t.slug === slug);
  const prev = idx > 0 ? allTopics[idx - 1] : null;
  const next = idx >= 0 && idx < allTopics.length - 1 ? allTopics[idx + 1] : null;
  const sameCategory = allTopics.filter(
    (t) => t.category === topic.meta.category && t.slug !== slug,
  );

  const pageUrl = `${SITE_URL}/docs/${slug}`;

  // TechArticle schema for rich snippets in Google + LLM crawlers.
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: topic.meta.title,
    description: topic.meta.description,
    keywords: topic.meta.keywords.join(", "),
    dateModified: topic.meta.lastmod,
    url: pageUrl,
    inLanguage: "en-US",
    author: { "@type": "Organization", name: "Pypes LLC" },
    publisher: { "@type": "Organization", name: "LamboApp", url: SITE_URL },
  };

  // BreadcrumbList — Home → Docs → {category} → {title}. Mirrors the visible
  // breadcrumb so Google's SERP breadcrumb display matches what's on-page.
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Docs", item: `${SITE_URL}/docs` },
      {
        "@type": "ListItem",
        position: 3,
        name: topic.meta.category,
        item: `${SITE_URL}/docs`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: topic.meta.title,
        item: pageUrl,
      },
    ],
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <nav aria-label="Breadcrumb" className="mb-8 text-xs text-white/50">
        <Link href="/docs" className="hover:text-white">
          Docs
        </Link>
        <span className="mx-2 text-white/30">/</span>
        <span className="text-white/70">{topic.meta.category}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div>
          <header className="mb-10 border-b border-white/[0.06] pb-8">
            <div className="flex items-center gap-3 text-xs text-white/50">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-black/40 text-yellow-300">
                <DocsIcon name={topic.meta.icon} className="h-4 w-4" />
              </span>
              <span className="font-mono font-medium uppercase tracking-wider text-yellow-400">
                {topic.meta.category}
              </span>
              <span className="text-white/30">·</span>
              <span>{topic.meta.readingMinutes} min read</span>
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {topic.meta.title}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-white/70">
              {topic.meta.summary}
            </p>
          </header>

          <DocsMarkdown content={topic.content} />

          {(prev || next) && (
            <nav className="mt-16 grid gap-4 border-t border-white/[0.06] pt-8 sm:grid-cols-2">
              {prev ? (
                <Link
                  href={`/docs/${prev.slug}`}
                  className="group flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <span className="text-xs uppercase tracking-wider text-white/50">
                    ← Previous
                  </span>
                  <span className="mt-1 text-sm font-medium text-white group-hover:text-yellow-200">
                    {prev.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {next ? (
                <Link
                  href={`/docs/${next.slug}`}
                  className="group flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-right transition-colors hover:border-white/20 hover:bg-white/[0.04] sm:items-end"
                >
                  <span className="text-xs uppercase tracking-wider text-white/50">
                    Next →
                  </span>
                  <span className="mt-1 text-sm font-medium text-white group-hover:text-yellow-200">
                    {next.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
          {sameCategory.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-mono font-semibold uppercase tracking-[0.2em] text-white/50">
                More in {topic.meta.category}
              </h2>
              <ul className="space-y-2">
                {sameCategory.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/docs/${t.slug}`}
                      className="block rounded-lg border border-transparent px-3 py-2 text-sm text-white/60 transition-colors hover:border-white/[0.06] hover:bg-white/[0.02] hover:text-white"
                    >
                      {t.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="mb-3 text-xs font-mono font-semibold uppercase tracking-[0.2em] text-white/50">
              All docs
            </h2>
            <Link
              href="/docs"
              className="text-sm text-yellow-400 hover:text-yellow-300"
            >
              ← Back to docs
            </Link>
          </div>
        </aside>
      </div>
    </main>
  );
}
