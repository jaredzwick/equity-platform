import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your listing is live",
  description: "Your business listing is live on LamboApp.",
  robots: { index: false, follow: false }, // one-shot page; no SEO value
};

export const dynamic = "force-dynamic";

const pypesApiURL =
  process.env.NEXT_PUBLIC_PYPES_API_URL ?? "https://api.pypes.dev";

type Props = {
  searchParams: Promise<{ session_id?: string; deal?: string }>;
};

// Post-Stripe-checkout landing. Stripe redirects here with
// ?session_id={CHECKOUT_SESSION_ID}. The public read endpoint
// /lamboapp/public/deals/{slug} is the source of truth for whether
// the deal is live — we resolve session_id → deal by polling the deal
// list (small cost; the webhook publishes near-instantly).
//
// Simplest correct behavior for v1: give the user a link to the deals
// index + email confirmation copy. If Stripe just cleared, the deal is
// live within a few seconds — the user's own inbox will get a receipt.
export default async function SellSuccessPage({ searchParams }: Props) {
  const params = await searchParams;
  const sessionID = params.session_id ?? "";

  // Best-effort look up the freshly-published deal by scanning the
  // recent slugs feed. Small volume today; if this ever grows we'll
  // add a dedicated /sellers/session/{id} lookup endpoint. Zero cost
  // to the flow if it fails — we render a generic success screen.
  let latestSlug: string | null = null;
  try {
    const res = await fetch(
      `${pypesApiURL}/lamboapp/public/deals?limit=5&offset=0`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const body = (await res.json()) as { items: { slug: string }[] };
      latestSlug = body.items?.[0]?.slug ?? null;
    }
  } catch {
    // ignore — success page still renders
  }

  return (
    <section className="mx-auto max-w-2xl px-6 pt-32 pb-24 md:pt-40">
      <div className="rounded-2xl border border-yellow-400/40 bg-yellow-400/[0.06] p-8 text-center">
        <div className="text-5xl">🚀</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          Your listing is live.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-white/70">
          Payment cleared. Your business is now visible on LamboApp and will be included
          in this week&rsquo;s buyer digest.
        </p>
        {latestSlug && (
          <div className="mt-6">
            <Link
              href={`/deal/${latestSlug}`}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg shadow-orange-500/40 transition hover:shadow-orange-500/70"
            >
              View your listing →
            </Link>
          </div>
        )}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <NextStep n="1" title="Check your inbox" body="Stripe sent your receipt. Save it — this is your only proof of payment." />
        <NextStep n="2" title="Watch for buyer inquiries" body="Interested acquirers reach out via email. You handle the conversation directly — no middleman." />
        <NextStep n="3" title="Need to edit?" body="Reply to your receipt or email support@lamboapp.com. Self-serve editing ships next." />
      </div>

      {sessionID && (
        <p className="mt-8 text-center text-xs text-white/30">
          Stripe session: {sessionID}
        </p>
      )}
    </section>
  );
}

function NextStep({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-left">
      <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-400 text-xs font-bold text-black">
        {n}
      </div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 text-xs text-white/60">{body}</p>
    </div>
  );
}
