import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://www.lamboapp.com";
// Placeholder: drop the actual PDF at landing/public/guides/... and the
// link resolves. Until then this returns a 404, which is fine — the SMS
// delivery is the primary channel; this page is a bonus.
const GUIDE_PATH = "/guides/90-day-acquisition-playbook.pdf";

export const metadata: Metadata = {
  title: "You're in — the playbook is on its way",
  description: "Your acquisition playbook PDF is on its way to your inbox.",
  alternates: { canonical: "/join/thanks" },
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/join/thanks`,
    title: "You're in · LamboApp",
    description: "Your 90-day acquisition playbook is on its way.",
  },
};

export default function JoinThanksPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-6 py-16 text-center">
      <p className="text-xs font-mono uppercase tracking-[0.2em] text-yellow-400">
        You&rsquo;re in
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        Check your inbox.
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-white/70">
        We just emailed you{" "}
        <span className="font-semibold text-white">
          The 90-Day Business Acquisition Playbook
        </span>{" "}
        as a PDF attachment. If it doesn&rsquo;t land in the next couple
        minutes, check spam — or grab it directly below.
      </p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <a
          href={GUIDE_PATH}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg shadow-orange-500/40 transition hover:shadow-orange-500/70"
          download
        >
          Download the playbook (PDF)
          <span aria-hidden>→</span>
        </a>
        <Link
          href="/deals"
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.08]"
        >
          Browse today&rsquo;s deals
        </Link>
      </div>

      <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-left">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-white/50">
          While you&rsquo;re here
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">
          Want deal flow that matches the playbook?
        </h2>
        <p className="mt-3 text-sm text-white/60">
          LamboApp reads ~100 businesses for sale every day across 30+
          brokers, scores them against 3&times; SDE, and texts you the ones
          worth 15 minutes of your time. Free tier ships with the same phone
          number you just gave us.
        </p>
        <div className="mt-4">
          <Link
            href="/deals"
            className="text-sm font-semibold text-yellow-300 underline hover:text-yellow-200"
          >
            See the deal feed →
          </Link>
        </div>
      </div>
    </main>
  );
}
