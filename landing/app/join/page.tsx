import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import CTAButton from "./CTAButton";

const SITE_URL = "https://www.lamboapp.com";

export const metadata: Metadata = {
  title:
    "Free Guide — Use Business Financing to Buy a Cash-Flowing Business in 90 Days",
  description:
    "The 90-day acquisition playbook. SBA 7(a), seller notes, ROBS, and equipment financing — how self-funded searchers close on cash-flowing SMBs without writing a check. Free PDF.",
  alternates: { canonical: "/join" },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/join`,
    title: "The 90-Day Business Acquisition Playbook — Free Guide",
    description:
      "SBA 7(a), seller notes, ROBS, equipment financing. How self-funded searchers close on a cash-flowing SMB in 90 days. Free PDF.",
  },
  twitter: {
    card: "summary_large_image",
    title: "The 90-Day Business Acquisition Playbook — Free Guide",
    description:
      "How to finance a cash-flowing SMB in 90 days. SBA 7(a), seller notes, ROBS. Free PDF.",
  },
};

export default function JoinPage() {
  return (
    <div id="top" className="min-h-screen text-white">
      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-14 pb-16 sm:pt-20">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-yellow-500/10 via-orange-500/[0.04] to-transparent" />
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-yellow-400">
            Free Guide · Instant Delivery
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl">
            Use{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent">
                business financing
              </span>
            </span>{" "}
            to buy a cash-flowing business — in 90 days.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            SBA 7(a), seller notes, ROBS, equipment financing. The
            <span className="font-semibold text-white"> exact stack </span>
            self-funded searchers use to close on a cash-flowing SMB —
            without writing a $500K check.
          </p>

          <div className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-white/50">
              Get the 90-day playbook
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
              The Business Acquisition Playbook
            </h2>
            <p className="mt-2 text-sm text-white/60">
              6-page field guide. Credit stack, deal sourcing on
              lamboapp.com, financing sources, 90-day cadence, lender +
              seller call scripts. Emailed instantly.
            </p>
            <div className="mt-6">
              <CTAButton />
            </div>
            <p className="mt-3 text-xs text-white/40">
              PDF lands in your inbox. No spam. Unsubscribe anytime.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 text-xs text-white/50">
            <Badge>SBA 7(a)</Badge>
            <Badge>Seller notes</Badge>
            <Badge>ROBS</Badge>
            <Badge>Equipment financing</Badge>
            <Badge>Personal guarantees</Badge>
          </div>
        </div>
      </section>

      {/* WHAT'S INSIDE */}
      <section className="border-t border-white/[0.06] bg-white/[0.015] px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-yellow-400">
              What's inside the guide
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Every financing path — de-mystified.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-white/60">
              Six pages. Written like a field note, not a marketing pitch —
              the same process I&rsquo;d hand a junior analyst on day one.
            </p>
          </div>

          <div className="mt-12 space-y-6">
            <Bullet
              tag="Preparing your situation"
              body="Cash runway, credit posture, spousal alignment. What actually gets underwritten vs. what people think gets underwritten. The 720 FICO with a maxed HELOC that gets declined."
            />
            <Bullet
              tag="Managing your credit kits"
              body="The stacked-kit setup: FICO ≥ 700, two unsecured personal cards, HELOC pre-approved and untapped, ROBS-compatible custodian, DUNS + D&B PAYDEX, two business tradelines seasoned six months out."
            />
            <Bullet
              tag="Sourcing deals with LamboApp"
              body="How to use lamboapp.com/deals as your morning shortlist: ~100 broker listings/day, sorted by fit score, filtered by industry + SDE + geo, with a 1-paragraph thesis and a red-flag list on every deal so you skip the CIM tourism."
            />
            <Bullet
              tag="Selecting financing sources"
              body="Why national SBA lenders you've heard of waste your time. The 2–3 sources actually worth calling: preferred SBA lenders in your vertical, seller notes on 3–5 year standby, ROBS when a rollable 401(k) makes sense."
            />
            <Bullet
              tag="Applying cadence"
              body="How to triage lender applications by effort — quick pre-quals for the average opportunity, full treatment for the deal you actually want. When to have your CPA re-cast returns."
            />
            <Bullet
              tag="Interviewing lenders + sellers"
              body="The four call stages every deal moves through. The questions that reveal owner-dependency, customer concentration, and whether the seller is actually motivated. What underwriters really want to hear."
            />
            <Bullet
              tag="Final thoughts on whether to pull the trigger"
              body="When acquisition is right for your situation. When it isn't. Why compressing ten years of W-2 saving into a 90-day close is either a life-changing move or a life-changing mistake."
            />
          </div>

          <div className="mt-12 flex justify-center">
            <CTAButton variant="secondary" />
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section className="border-t border-white/[0.06] px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-yellow-400">
              Who this is for
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Self-funded searchers. Not tourists.
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <PersonaCard
              headline="If this sounds like you, the guide will save you 100 hours."
              points={[
                "You've watched a Codie Sanchez / Nick Huber video and thought 'wait, this is doable'",
                "You have $50–250K in cash or a rollable 401(k) — not $2M in dry powder",
                "You want to own the thing that prints, not another equity comp package",
                "You've searched BizBuySell 5+ times but bounced because the deals feel opaque",
              ]}
              variant="fit"
            />
            <PersonaCard
              headline="It's probably not for you if…"
              points={[
                "You're looking for a passive 'buy a business, hire an operator, sit back' script",
                "You want a guarantee. This is finance — everything has risk-adjusted math",
                "You expect a $0-down, no-personal-guarantee, no-effort acquisition",
                "You want us to source the deal for you (that's what lamboapp.com does — separate product)",
              ]}
              variant="miss"
            />
          </div>
        </div>
      </section>

      {/* AUTHOR BIO */}
      <section className="border-t border-white/[0.06] bg-white/[0.015] px-6 py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-12 md:grid-cols-[2fr_3fr]">
          <div className="order-2 md:order-1">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-yellow-400/10 via-orange-500/5 to-red-500/5">
              <Image
                src="/jared.png"
                alt="Jared Zwick, founder of LamboApp"
                fill
                sizes="(min-width: 768px) 40vw, 100vw"
                className="object-cover"
                priority={false}
              />
            </div>
          </div>
          <div className="order-1 md:order-2">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-yellow-400">
              Who wrote this
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              I ran M&amp;A at a $114M private equity firm.
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-white/70">
              <p>
                Hi — I&rsquo;m{" "}
                <span className="font-semibold text-white">Jared Zwick</span>,
                founder of LamboApp. Before this I ran deal sourcing, LOIs,
                and post-close operator handoffs for a lower-middle-market PE
                fund. Roll-ups in home services, light industrial, and
                distribution.
              </p>
              <p>
                The reason PE keeps winning: they understand the financing
                stack cold, and they know exactly which deals will get funded
                before they even sign the LOI. Retail buyers don&rsquo;t. This
                guide is the version of that playbook that doesn&rsquo;t
                require a $2M check and an MBA.
              </p>
              <p>
                It&rsquo;s the same document I&rsquo;d hand a junior analyst
                on day one — condensed, ungated, and free. If it saves you one
                bad LOI, it&rsquo;s done its job.
              </p>
            </div>
            <div className="mt-8">
              <CTAButton
                variant="compact"
                label="Send Me the Playbook →"
              />
            </div>
          </div>
        </div>
      </section>

      {/* URGENCY / SOFT CLOSE */}
      <section className="border-t border-white/[0.06] px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            The window is now, not later.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/70 sm:text-lg">
            The boomer retirement wave is producing more sub-$5M SMB
            listings than at any point in history. Multiples are compressing,
            SBA is lending, and the buyers who move first — with the right
            financing stack pre-qualified — are the ones who close. In 5
            years, the deals will still be there. The 3&times; SDE multiples
            probably won&rsquo;t.
          </p>
          <p className="mt-6 text-sm font-mono uppercase tracking-[0.2em] text-yellow-400">
            Read it tonight. Start your 90-day clock tomorrow.
          </p>
          <div className="mt-8 flex justify-center">
            <CTAButton variant="secondary" />
          </div>
          <p className="mt-6 text-xs text-white/40">
            Prefer to browse deals first?{" "}
            <Link
              href="/deals"
              className="text-yellow-300 underline hover:text-yellow-200"
            >
              See today&rsquo;s scored listings →
            </Link>
          </p>
        </div>
      </section>

      {/* DISCLAIMER */}
      <div className="border-t border-white/[0.06] px-6 py-10">
        <div className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-white/40">
          <p>
            Nothing on this page is financial, legal, or tax advice. Business
            acquisition involves real risk — including loss of your equity
            contribution and personal guarantee exposure. Consult a licensed
            SBA lender, CPA, and M&amp;A attorney before signing any LOI or
            purchase agreement. Individual results depend on deal quality,
            operator experience, macro conditions, and factors outside our
            control.
          </p>
        </div>
      </div>
    </div>
  );
}

function Bullet({ tag, body }: { tag: string; body: string }) {
  return (
    <div className="flex gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-yellow-400/30 sm:p-6">
      <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-yellow-400/10 text-yellow-300">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={2.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-white">{tag}</p>
        <p className="mt-1 text-sm leading-relaxed text-white/60 sm:text-base">
          {body}
        </p>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono">
      {children}
    </span>
  );
}

function PersonaCard({
  headline,
  points,
  variant,
}: {
  headline: string;
  points: string[];
  variant: "fit" | "miss";
}) {
  const isFit = variant === "fit";
  const dotColor = isFit ? "text-emerald-400" : "text-red-400";
  const border = isFit
    ? "border-emerald-500/20"
    : "border-red-500/20";
  return (
    <div
      className={`rounded-2xl border ${border} bg-white/[0.02] p-6 sm:p-8`}
    >
      <p className="text-sm font-semibold text-white">{headline}</p>
      <ul className="mt-5 space-y-3">
        {points.map((p) => (
          <li key={p} className="flex gap-3 text-sm text-white/70">
            <span className={`mt-1 shrink-0 font-mono ${dotColor}`}>
              {isFit ? "✓" : "×"}
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
