import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.lamboapp.com";

export const metadata: Metadata = {
  title: "You're in · LamboApp",
  description: "You're on the list. Here's what happens next.",
  alternates: { canonical: "/signup/thanks" },
  // Deliberately excluded from crawlers — this is a post-submit page.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/signup/thanks`,
    title: "You're in · LamboApp",
    description: "You're on the list. Here's what happens next.",
  },
};

export default function ThanksPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-16 text-center">
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-yellow-400">
        You&rsquo;re in
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        See you at the deal feed.
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-white/70">
        We&rsquo;ll text you when the next scored deal lands. No spam. Reply
        STOP anytime.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/deals"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg shadow-orange-500/40 transition hover:shadow-orange-500/70"
        >
          Browse today&rsquo;s deals
          <span aria-hidden>→</span>
        </Link>
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.08]"
        >
          Read the docs
        </Link>
      </div>

      <div className="mt-16 text-sm text-white/50">
        Want to run your own LamboApp?{" "}
        <Link href="/docs/self-hosting" className="text-yellow-300 underline">
          Self-hosting guide
        </Link>
        {" — "}the whole platform is open source (BSL 1.1).
      </div>
    </main>
  );
}
