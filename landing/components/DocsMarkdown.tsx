// Markdown renderer for the docs center. Hand-rolled element styling — no
// @tailwindcss/typography plugin. Tuned for long-form reading: 68ch line
// length, generous section spacing, restrained code/table styling.
//
// Headings get auto-generated id slugs so deep-links from the page's own TOC
// (and from other pages like /docs#disclaimer) work without any plugin. Slug
// rule mirrors GitHub's: lowercase, ASCII-only, hyphens for spaces.

"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function flattenChildren(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(flattenChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    const el = children as { props: { children?: React.ReactNode } };
    return flattenChildren(el.props.children);
  }
  return "";
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="mb-6 mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const id = slugify(flattenChildren(children));
    return (
      <h2
        id={id}
        className="group mt-12 scroll-mt-24 border-t border-white/[0.06] pt-8 text-xl font-semibold text-white"
      >
        <a href={`#${id}`} className="no-underline hover:text-yellow-300">
          {children}
        </a>
      </h2>
    );
  },
  h3: ({ children }) => {
    const id = slugify(flattenChildren(children));
    return (
      <h3
        id={id}
        className="mt-8 scroll-mt-24 text-base font-semibold text-white"
      >
        {children}
      </h3>
    );
  },
  p: ({ children }) => (
    <p className="my-4 text-[15px] leading-relaxed text-white/75">{children}</p>
  ),
  a: ({ href, children }) => {
    const isExternal = href?.startsWith("http");
    return (
      <a
        href={href}
        className="text-yellow-300 underline decoration-yellow-500/40 underline-offset-2 transition-colors hover:text-yellow-200 hover:decoration-yellow-400"
        {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  ul: ({ children }) => (
    <ul className="my-4 list-disc space-y-1.5 pl-6 text-[15px] leading-relaxed text-white/75 marker:text-white/30">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-1.5 pl-6 text-[15px] leading-relaxed text-white/75 marker:text-white/40">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-white/85">{children}</em>,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <code className="text-[13px] text-white">{children}</code>;
    }
    return (
      <code className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[13px] text-yellow-200">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-5 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/40 p-4 text-[13px] leading-relaxed">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-5 border-l-2 border-yellow-500/50 bg-yellow-500/[0.04] py-1 pl-4 pr-4 text-[15px] italic text-white/80">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto rounded-lg border border-white/[0.06]">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-white/[0.03] text-left text-white/90">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border-b border-white/[0.06] px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white/80">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-white/[0.04] px-4 py-2.5 text-white/75 last:border-b-0">
      {children}
    </td>
  ),
  hr: () => <hr className="my-10 border-white/[0.06]" />,
};

type Props = {
  content: string;
};

export default function DocsMarkdown({ content }: Props) {
  return (
    <article className="max-w-[68ch] text-white/80">
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
