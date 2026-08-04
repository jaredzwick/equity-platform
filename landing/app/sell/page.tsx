import type { Metadata } from "next";
import SellListingForm from "@/components/SellListingForm";
import ListingPreviewCard from "@/components/ListingPreviewCard";

// SEO metadata for /sell. Standalone landing page targeting the
// "sell my business" intent — separate keyword universe from the
// buyer-side homepage (which targets "businesses for sale").
export const metadata: Metadata = {
  title: "Sell your business for $7 — list on LamboApp",
  description:
    "List your business for sale on LamboApp for a one-time $7. Upload your due diligence packet (P&L, tax returns, contracts). Reach acquisition entrepreneurs actively hunting for cash-flowing SMBs.",
  keywords: [
    "sell your business",
    "list business for sale",
    "online business for sale",
    "sell SaaS business",
    "sell ecommerce business",
    "SMB for sale",
    "sell your website",
    "business broker alternative",
    "for sale by owner business",
    "post business for sale",
  ],
  alternates: { canonical: "/sell" },
  openGraph: {
    type: "website",
    title: "Sell your business for $7 on LamboApp",
    description:
      "$7 flat. Live in minutes. Reach acquisition entrepreneurs. Upload your DD packet privately.",
    url: "https://www.lamboapp.com/sell",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sell your business for $7",
    description: "$7 flat, live in minutes. Upload your DD packet, reach real buyers.",
  },
};

// force-dynamic + reading env inside the render function guarantees the
// current NEXT_PUBLIC_TURNSTILE_SITE_KEY value is baked into the RSC
// payload on every request, so a Vercel env change takes effect without
// needing a rebuild.
export const dynamic = "force-dynamic";

export default function SellPage() {
  const pypesApiURL =
    process.env.NEXT_PUBLIC_PYPES_API_URL ?? "https://api.pypes.dev";
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  return (
    <>
      {/* HERO — gradient orbs for depth (mirrors buyer homepage energy without dragging in three.js) */}
      <section className="relative overflow-hidden pt-24 pb-12 md:pt-36 md:pb-20">
        {/* Ambient glow orbs behind the copy — pure CSS, no JS cost. */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-orange-500/20 blur-[120px]" />
          <div className="absolute top-24 left-[8%] h-[280px] w-[280px] rounded-full bg-yellow-400/10 blur-[100px]" />
          <div className="absolute top-40 right-[8%] h-[320px] w-[320px] rounded-full bg-red-500/10 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/[0.06] px-4 py-1.5 text-xs font-medium text-yellow-200/90 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
            </span>
            $7 · live in 3 minutes · no broker fees
          </div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-7xl">
            Sell your business.{" "}
            <span className="bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent">
              For $7.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            List your business in minutes. Upload your DD packet privately. Get in front of
            acquisition entrepreneurs actively hunting SMBs at 3–5x SDE.{" "}
            <span className="text-white">No brokers. No 6-month lockup. No BS.</span>
          </p>

          {/* Trust bar — punches through skepticism about "$7 must be a scam" */}
          <div className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/50">
            <TrustPill>🔒 DD files stay private</TrustPill>
            <TrustPill>⚡ Google-indexed in 24h</TrustPill>
            <TrustPill>📬 Buyers email you directly</TrustPill>
            <TrustPill>💯 Keep 100% of sale price</TrustPill>
          </div>
        </div>
      </section>

      {/* WHAT YOU GET — 3-column showing the actual listing + how buyers see it.
          Plain <section> (not AnimatedSection) — this is a conversion surface,
          not scroll-storytelling; content should be visible on first paint. */}
      <section className="mx-auto max-w-6xl px-6 pb-16 md:pb-24">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12">
          <div className="flex flex-col justify-center">
            <div className="text-xs font-mono uppercase tracking-widest text-yellow-400">
              What you get
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              A public listing that looks{" "}
              <span className="bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent">
                exactly like ours.
              </span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/60 md:text-base">
              Same page layout, same SEO rigging, same digest exposure as the deals our AI
              scraper surfaces from 30+ brokers. Buyers can&rsquo;t tell you&rsquo;re a solo
              seller — you just look like one of the deals.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-white/70">
              <IncludedRow>
                Live at <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-yellow-200">lamboapp.com/deal/{"{slug}"}</code>
              </IncludedRow>
              <IncludedRow>
                Indexed by Google via Indexing API (avg &lt; 24h to appear in search)
              </IncludedRow>
              <IncludedRow>
                Included in the weekly buyer digest sent to PE-buyer signups
              </IncludedRow>
              <IncludedRow>
                Private DD packet — 10 files, PDF / DOCX / XLSX / PNG / JPEG, 25MB each
              </IncludedRow>
              <IncludedRow>
                Buyer inquiries route directly to your inbox — no gatekeeper
              </IncludedRow>
            </ul>
          </div>
          <ListingPreviewCard />
        </div>
      </section>

      {/* THE FORM — anchor + intro so the wizard doesn't feel like it appears out of nowhere */}
      <section id="form" className="scroll-mt-24 mx-auto max-w-3xl px-6 pb-12">
        <div className="mb-6 text-center">
          <div className="text-xs font-mono uppercase tracking-widest text-yellow-400">
            Post your business
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
            Four steps. About three minutes.
          </h2>
        </div>
        <SellListingForm
          apiURL={pypesApiURL}
          turnstileSiteKey={turnstileSiteKey}
        />
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16 md:py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Common questions
        </h2>
        <div className="mt-8 space-y-3">
          <FAQItem
            q="Why only $7?"
            a="We're not a broker. We're a distribution channel. The $7 covers listing infrastructure and filters out spam. You keep 100% of the sale price — no commission, no split, no follow-up sales calls, ever."
          />
          <FAQItem
            q="What happens after I pay?"
            a="Your listing goes live immediately at lamboapp.com/deal/{your-slug}. It's included in the next weekly buyer digest and pinged to Google's Indexing API within a minute (typically appears in search within 24h)."
          />
          <FAQItem
            q="Are my DD files public?"
            a="No. Files you upload during the listing flow are stored privately in our database. Only the metadata (business name, asking price, thesis) is public. Buyers who inquire contact you directly — you decide what to share and when."
          />
          <FAQItem
            q="Can I edit my listing after publishing?"
            a="Not yet from the public site — for v1, email support@lamboapp.com and we'll help. A self-serve edit flow (with a magic-link on your receipt email) ships next."
          />
          <FAQItem
            q="What if my listing doesn't sell?"
            a="Nothing bad happens. The listing stays live indefinitely at no additional cost. You can unpublish anytime by emailing support. No auto-renewal, no billing surprises."
          />
        </div>
      </section>

      {/* Final CTA — anchor jump back to the form */}
      <section className="relative mx-auto max-w-4xl px-6 pb-24 text-center">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-yellow-500/[0.08] via-orange-500/[0.06] to-red-500/[0.08] p-8 backdrop-blur md:p-10">
          <h3 className="text-2xl font-semibold text-white md:text-3xl">
            Ready to move your business?
          </h3>
          <p className="mx-auto mt-3 max-w-lg text-sm text-white/60 md:text-base">
            Four fields. Three minutes. Seven dollars. Buyers see your listing tomorrow.
          </p>
          <a
            href="#form"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg shadow-orange-500/40 transition hover:shadow-orange-500/70"
          >
            Post my listing →
          </a>
        </div>
      </section>
    </>
  );
}

function TrustPill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5">{children}</span>;
}

function IncludedRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-yellow-400/20 text-[10px] font-bold text-yellow-300">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur transition open:border-yellow-400/40 open:bg-white/[0.04]">
      <summary className="flex cursor-pointer list-none items-center justify-between text-base font-medium text-white">
        <span>{q}</span>
        <span className="ml-2 text-lg text-yellow-400 transition-transform group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-white/70">{a}</p>
    </details>
  );
}
