// Server-only loader for the docs center. Reads markdown from landing/content/docs/
// at request/build time. Auto-discovers any new MD file you add — no manual registry.
//
// Frontmatter shape (required on every content/docs/*.md):
//   ---
//   title:       "..."           # SEO <title> + <h1>
//   description: "..."           # meta description, ~155 chars
//   keywords:    ["...", ...]    # SEO keywords
//   category:    "..."           # display group on the index page
//   summary:     "..."           # one-line teaser for the index card
//   icon:        "..."           # icon key from ICON_MAP in DocsIcon.tsx
//   order:       1               # display order WITHIN a category
//   lastmod:     "YYYY-MM-DD"    # last meaningful content update; sitemap.lastModified
//   ---
//
// Adding a new doc:
//   1. drop a new .md file in landing/content/docs/ with the frontmatter above
//   2. sitemap auto-includes it on next build
//   3. /docs indexes it under its category automatically

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const CONTENT_DIR = path.join(process.cwd(), "content", "docs");

export type DocsMeta = {
  slug: string;
  title: string;
  description: string;
  keywords: string[];
  category: string;
  summary: string;
  icon: string;
  order: number;
  lastmod: string;
  readingMinutes: number;
};

export type DocsTopic = {
  meta: DocsMeta;
  content: string;
};

export type DocsCategory = {
  name: string;
  topics: DocsMeta[];
};

// Display order for categories on the index page. Unknown categories fall to
// the bottom alphabetically so a new one shows up rather than getting dropped.
const CATEGORY_ORDER = ["Start here", "Concepts", "Guides", "Reference"];

function parseFrontmatter(raw: string, slug: string): DocsTopic | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const head = match[1];
  const body = match[2];

  const get = (key: string): string => {
    const re = new RegExp(`^${key}:\\s*(.+)$`, "m");
    const m = head.match(re);
    if (!m) return "";
    return m[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  };

  const getArray = (key: string): string[] => {
    const re = new RegExp(`^${key}:\\s*\\[(.*)\\]$`, "m");
    const m = head.match(re);
    if (!m) return [];
    return m[1]
      .split(",")
      .map((s) => s.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1"))
      .filter(Boolean);
  };

  const title = get("title");
  const description = get("description");
  const order = Number(get("order")) || 999;
  const lastmod = get("lastmod") || new Date().toISOString().slice(0, 10);
  const category = get("category") || "Other";
  const summary = get("summary") || description;
  const icon = get("icon") || "doc";

  if (!title || !description) return null;

  const words = body.trim().split(/\s+/).length;
  const readingMinutes = Math.max(1, Math.ceil(words / 225));

  return {
    meta: {
      slug,
      title,
      description,
      keywords: getArray("keywords"),
      category,
      summary,
      icon,
      order,
      lastmod,
      readingMinutes,
    },
    content: body,
  };
}

export async function listDocsTopics(): Promise<DocsMeta[]> {
  let entries: string[];
  try {
    entries = await readdir(CONTENT_DIR);
  } catch {
    return [];
  }
  const mdFiles = entries.filter((f) => f.endsWith(".md"));
  const topics = await Promise.all(
    mdFiles.map(async (f) => {
      const slug = f.replace(/\.md$/, "");
      const raw = await readFile(path.join(CONTENT_DIR, f), "utf8");
      return parseFrontmatter(raw, slug)?.meta ?? null;
    }),
  );
  return topics
    .filter((t): t is DocsMeta => t !== null)
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

export async function listDocsCategories(): Promise<DocsCategory[]> {
  const topics = await listDocsTopics();
  const map = new Map<string, DocsMeta[]>();
  for (const t of topics) {
    const arr = map.get(t.category) ?? [];
    arr.push(t);
    map.set(t.category, arr);
  }
  const named = Array.from(map.entries()).map(([name, topics]) => ({
    name,
    topics: topics.sort((a, b) => a.order - b.order),
  }));
  return named.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.name);
    const bi = CATEGORY_ORDER.indexOf(b.name);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export async function getDocsTopic(slug: string): Promise<DocsTopic | null> {
  // Path-traversal defense — slug is user input from the URL.
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  let raw: string;
  try {
    raw = await readFile(path.join(CONTENT_DIR, `${slug}.md`), "utf8");
  } catch {
    return null;
  }
  return parseFrontmatter(raw, slug);
}
