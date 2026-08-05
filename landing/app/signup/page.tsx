import type { Metadata } from "next";
import Link from "next/link";
import SignupForm from "@/components/SignupForm";

const SITE_URL = "https://www.lamboapp.com";

export const metadata: Metadata = {
  title: "Sign up · LamboApp",
  description:
    "Name and phone number, that's it. We'll text you when a new scored deal lands.",
  alternates: { canonical: "/signup" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/signup`,
    title: "Sign up · LamboApp",
    description:
      "Get on the list. Scored SMB deals from 30+ brokers, straight to your phone.",
  },
};

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center px-6 py-16">
      <header className="mb-10 max-w-2xl">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-yellow-400">
          Sign up
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Get on the list.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-white/70">
          Two fields. Your name and a phone number. We&rsquo;ll text you when
          a listing worth 15 minutes of your reading time shows up in the
          feed — scored, with a thesis and red flags already worked out.
        </p>
      </header>

      <SignupForm source="signup-page" ctaLabel="Get on the list" />

      <section className="mt-16 grid gap-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-white">What you get</h2>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>· AI thesis + red flags on every deal that hits the feed</li>
            <li>· One-paragraph fit score against the 3× SDE archetype</li>
            <li>· Text alerts when a listing matches your buy-box</li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Want to self-host?</h2>
          <p className="mt-3 text-sm text-white/70">
            The whole platform is{" "}
            <Link href="/docs/licensing" className="text-yellow-300 underline">
              open source (BSL 1.1)
            </Link>
            . Read the{" "}
            <Link href="/docs/quickstart" className="text-yellow-300 underline">
              quickstart
            </Link>{" "}
            and boot it locally in 3 minutes.
          </p>
        </div>
      </section>
    </main>
  );
}
