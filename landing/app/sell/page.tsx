import type { Metadata } from "next";
import AnimatedSection from "@/components/AnimatedSection";
import FeatureCard from "@/components/FeatureCard";
import SellListingForm from "@/components/SellListingForm";

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

const pypesApiURL =
  process.env.NEXT_PUBLIC_PYPES_API_URL ?? "https://api.pypes.dev";
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export default function SellPage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden pt-32 pb-16 md:pt-40 md:pb-24">
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/[0.06] px-3 py-1 text-xs text-yellow-200/90">
            💸 $7 · publishes immediately · zero broker fees
          </div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl">
            Sell your business.{" "}
            <span className="bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent">
              For $7.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            List your business in minutes. Upload your due diligence packet privately.
            Get in front of acquisition entrepreneurs actively hunting SMBs at 3–5x SDE.
            <span className="text-white"> No broker fees. No 6-month commitments. No BS.</span>
          </p>
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <AnimatedSection className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<span className="text-2xl">📣</span>}
            title="Public listing at /deal/{slug}"
            body="SEO-optimized page indexed by Google + surfaced in our weekly digest to signed-up PE buyers. Same layout as our scraped deals — buyers can't tell you're a solo seller."
            accent="linear-gradient(135deg,#f59e0b,#ef4444)"
          />
          <FeatureCard
            icon={<span className="text-2xl">📁</span>}
            title="Private DD file hosting"
            body="Upload up to 10 files (PDF, DOCX, XLSX, PNG, JPEG), 25MB each. Kept off the public page — only shared when a buyer requests access."
            accent="linear-gradient(135deg,#3b82f6,#8b5cf6)"
            delay={0.1}
          />
          <FeatureCard
            icon={<span className="text-2xl">📩</span>}
            title="Buyer inquiries in your inbox"
            body="Interested acquirers get your contact info via our CRM. No middleman, no listing agent, no split — you talk to buyers directly."
            accent="linear-gradient(135deg,#10b981,#14b8a6)"
            delay={0.2}
          />
        </div>
      </AnimatedSection>

      {/* THE FORM */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <SellListingForm
          apiURL={pypesApiURL}
          turnstileSiteKey={turnstileSiteKey}
        />
      </section>

      {/* FAQ */}
      <AnimatedSection className="mx-auto max-w-3xl px-6 py-16 md:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
          Common questions
        </h2>
        <div className="mt-8 space-y-6">
          <FAQItem
            q="Why only $7?"
            a="We're not a broker. We're a distribution channel. The $7 covers the cost of listing infrastructure and filters out spam. You keep 100% of the sale price — no commission, no split, no follow-up sales calls."
          />
          <FAQItem
            q="What happens after I pay?"
            a="Your listing goes live immediately at lamboapp.com/deal/{your-slug}. It's included in our weekly buyer digest and indexed by Google within 24 hours (we hit the Indexing API automatically)."
          />
          <FAQItem
            q="Are my DD files public?"
            a="No. Files you upload during the listing flow are stored privately. Buyers who inquire will contact you directly, and you decide what to share and when."
          />
          <FAQItem
            q="Can I edit my listing after publishing?"
            a="Not yet from the public site. For now, email support@lamboapp.com and we'll help. A self-serve edit flow ships next."
          />
        </div>
      </AnimatedSection>
    </>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur transition open:border-yellow-400/40 open:bg-white/[0.04]">
      <summary className="cursor-pointer list-none text-base font-medium text-white">
        <span className="mr-2 text-yellow-400">›</span>
        {q}
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-white/70">{a}</p>
    </details>
  );
}
