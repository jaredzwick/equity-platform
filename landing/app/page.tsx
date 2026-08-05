import Link from "next/link";
import { getSession } from "@/lib/session";
import SignInButton from "@/components/SignInButton";
import AnimatedSection from "@/components/AnimatedSection";
import FeatureCard from "@/components/FeatureCard";
import HowItWorks from "@/components/HowItWorks";
import HeroSceneClient from "@/components/HeroSceneClient";
import AuthErrorBanner from "@/components/AuthErrorBanner";
import TerminalPanel from "@/components/TerminalPanel";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string; msg?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const session = await getSession().catch(() => null);
  const signedIn = Boolean(session?.login);
  const { error: errorCode, msg } = await searchParams;

  return (
    <>
      {errorCode && <AuthErrorBanner errorCode={errorCode} message={msg} />}
      {/* HERO */}
      <section className="relative min-h-[100svh] overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <HeroSceneClient />
        </div>

        <div className="relative mx-auto grid min-h-[100svh] max-w-6xl grid-cols-1 items-center gap-10 px-6 pb-24 pt-32 md:pt-40 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
          <div className="flex flex-col items-start">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-400/[0.06] px-3 py-1 text-xs text-yellow-200/90 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
              </span>
              🏎️ DEGENERATE MODE: DEAL SOURCING
              <span className="text-yellow-200/40">·</span>
              <span>💎🙌</span>
            </div>

            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-5xl lg:text-6xl">
              Stop yolo&rsquo;ing SPY puts.{" "}
              <span className="bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent">
                Start acquiring cash-flowing businesses that print every month.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
              LamboApp screens{" "}
              <span className="text-white">~100 businesses for sale every day</span>{" "}
              across 30+ brokers. Our AI reads every listing, flags the scams, scores the
              winners, and hands you a 1-paragraph thesis.{" "}
              <span className="text-yellow-300">When lambo?</span> When you stop
              paper-handing SPY and start acquiring SMBs at 3x SDE.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              {signedIn ? (
                <Link
                  href="/onboarding"
                  className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg shadow-orange-500/40 transition hover:shadow-orange-500/70"
                >
                  Continue printing
                  <ArrowRight />
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg shadow-orange-500/40 transition hover:shadow-orange-500/70"
                >
                  Get on the list
                  <ArrowRight />
                </Link>
              )}
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.08]"
              >
                How the machine works
              </Link>
            </div>

            {/* Sell-side wedge — quiet secondary CTA under the primary
                row. Kept small so it doesn't compete with the buyer
                sign-in but catches business owners arriving from an
                SEO query for "sell your business". */}
            <div className="mt-5 text-sm text-white/50">
              Own a business?{" "}
              <Link
                href="/sell"
                className="border-b border-yellow-400/40 pb-0.5 text-yellow-300 transition hover:text-yellow-200 hover:border-yellow-400"
              >
                List it for $7 →
              </Link>
            </div>
          </div>

          <div className="w-full">
            <TerminalPanel />
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/40">
          <div className="mx-auto mb-2 h-8 w-5 rounded-full border border-white/20 p-1">
            <div className="mx-auto h-2 w-1 animate-bounce rounded-full bg-white/60" />
          </div>
          scroll
        </div>
      </section>

      {/* WHY */}
      <AnimatedSection className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="max-w-2xl">
          <div className="text-xs font-mono uppercase tracking-widest text-yellow-400">
            The Thesis
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            SPY YTD: 12%.{" "}
            <span className="text-white/60">
              A boring HVAC business at 3x SDE:{" "}
              <span className="text-yellow-300">33% cash-on-cash + you own the asset.</span>{" "}
              Math is undefeated. So why are you still refreshing $SPY?
            </span>
          </h2>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          <FeatureCard
            accent="linear-gradient(135deg,#facc15,#f97316)"
            icon={<IconBrain />}
            title="Autist-grade due diligence"
            body="Claude reads every listing, flags the red flags brokers hide — add-back cheese, revenue concentration, 'SDE = revenue with steps' — so you don't wire $2M into a dumpster fire."
            delay={0}
          />
          <FeatureCard
            accent="linear-gradient(135deg,#f97316,#ef4444)"
            icon={<IconChart />}
            title="The screener does the boring part"
            body="30 broker feeds. One firehose. Filtered by SDE multiple, industry, cash flow. Sort by fit score. Save searches. Alerts when an 8+/10 deal drops."
            delay={0.1}
          />
          <FeatureCard
            accent="linear-gradient(135deg,#ef4444,#dc2626)"
            icon={<IconLambo />}
            title="Cash flow > meme stocks"
            body="You cannot eat unrealized gains. You can, however, deposit an HVAC company's monthly EBITDA into your checking account. One of these two options fills the driveway with a Lambo."
            delay={0.2}
          />
        </div>
      </AnimatedSection>

      {/* HOW IT WORKS */}
      <AnimatedSection id="how" className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-mono uppercase tracking-widest text-orange-400">
            How the machine works
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Every 6 hours: firehose.{" "}
            <span className="text-white/60">Every hour: Claude screens 8 deals, scores 0-10, writes a thesis, flags landmines.</span>
          </h2>
          <p className="mt-4 text-white/60">
            You get the top-fit deals in a browsable feed. Buy signal, investigate, or pass — one glance. Sourcing is now something that happens while you sleep instead of something you feel guilty about not doing.
          </p>
        </div>
        <div className="mt-16 md:mt-20">
          <HowItWorks />
        </div>
      </AnimatedSection>

      {/* TESTIMONIALS */}
      <AnimatedSection className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-mono uppercase tracking-widest text-yellow-400">
            Real Testimonials™
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            The people have{" "}
            <span className="bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent">spoken</span>
            .
          </h2>
          <p className="mt-4 text-sm text-white/40">
            (Legally we are required to tell you these are dramatizations. Any resemblance to persons living, dead, or currently margin-called is coincidental.)
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Testimonial
            name="u/DeepFuckingValueSMB"
            title="Search-fund apex predator"
            avatarBg="linear-gradient(135deg,#facc15,#f97316)"
            avatarText="🦍"
            quote="Bought a car wash at 2.8x SDE last month. Wife&rsquo;s boyfriend now respects me."
            disclaimer="Not a real Reddit user. Wife&rsquo;s boyfriend approval not guaranteed."
          />
          <Testimonial
            name="Chad Thundercock"
            title="Ex-0DTE degenerate, now HVAC magnate"
            avatarBg="linear-gradient(135deg,#f97316,#ef4444)"
            avatarText="💪"
            quote="Sold my 0DTE portfolio. Bought a laundromat. Monthly cash flow: $47k. Robinhood notifications received: zero. Sleep quality: elite."
            disclaimer="Chad is a composite character. The laundromat is metaphorical. Sleep quality varies."
          />
          <Testimonial
            name="Anon on a search-fund Discord"
            title="Almost-victim of a bad wire"
            avatarBg="linear-gradient(135deg,#8b5cf6,#ec4899)"
            avatarText="👻"
            quote="The AI flagged 6 red flags in a listing I was about to wire on. Saved me $1.4M. I offered Jared my firstborn."
            disclaimer="Firstborn offering declined. Venmo also acceptable."
          />
          <Testimonial
            name="HVACGigaChad"
            title="Tesla Y → Lambo Urus in 18mo"
            avatarBg="linear-gradient(135deg,#eab308,#facc15)"
            avatarText="🏎️"
            quote="Went from Tesla Y to Lambo Urus in 18 months. All I did was let the machine tell me which listings were actually printing. My accountant is scared."
            disclaimer="Vehicles depicted are stock photos. Lambo delivery is not included with signup."
          />
          <Testimonial
            name="Grandma Judith, 74"
            title="Former day-trader, current portfolio operator"
            avatarBg="linear-gradient(135deg,#22d3ee,#8b5cf6)"
            avatarText="👵"
            quote="I asked my grandson what &lsquo;SDE&rsquo; means and now I own three self-storage facilities. The AI does the reading for me. I do the depositing."
            disclaimer="Grandma Judith is not real. Self-storage facilities can, however, be very real."
          />
          <Testimonial
            name="Anonymous LP"
            title="Wrote a check they will not confirm"
            avatarBg="linear-gradient(135deg,#374151,#111827)"
            avatarText="🕴️"
            quote="Cannot legally comment on which fund I run. Can confirm every acquisition target we&rsquo;ve closed in Q3 was surfaced by this thing before our associates got to it."
            disclaimer="LP has requested anonymity. LP is also completely fabricated."
          />
        </div>
      </AnimatedSection>

      {/* STACK */}
      <AnimatedSection className="relative mx-auto max-w-6xl px-6 py-24 md:py-32">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-orange-400">
              Powered by boring, expensive-per-token AI
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Not sexy.{" "}
              <span className="text-white/60">Extremely effective.</span>
            </h2>
            <p className="mt-4 text-white/60">
              You do not need a rocket ship. You need a deal machine that runs while you sleep, hydrates a Postgres table, and pings you when a listing scores above 8.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Claude Haiku", "Deal screening + thesis"],
              ["CatchBuys", "30-broker aggregator"],
              ["Apify", "BizBuySell + long-tail"],
              ["Postgres + pgvector", "Deal database"],
              ["n8n", "Workflow orchestration"],
              ["Grafana", "Backlog + fit-score dashboards"],
              ["IndexNow", "Bing / Yandex fanout"],
              ["Google Indexing API", "GSC direct ping"],
            ].map(([name, role]) => (
              <li
                key={name}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur"
              >
                <div className="font-medium text-white">{name}</div>
                <div className="mt-1 text-xs text-white/50">{role}</div>
              </li>
            ))}
          </ul>
        </div>
      </AnimatedSection>

      {/* CTA */}
      <AnimatedSection className="relative mx-auto max-w-6xl px-6 pb-32 pt-16">
        <div className="relative overflow-hidden rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-yellow-500/15 via-orange-500/15 to-red-500/10 p-10 md:p-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(250,204,21,0.30),transparent_60%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(239,68,68,0.25),transparent_60%)]" />
          <div className="relative">
            <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
              When lambo?{" "}
              <span className="text-yellow-300">Now.</span>
            </h2>
            <p className="mt-4 max-w-xl text-white/70">
              Drop your name and number. We text you when the next scored deal lands. If you&rsquo;re a builder, fork the sourcer and point it at your buy-box — the whole platform is open source.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              {signedIn ? (
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg transition hover:shadow-orange-500/60"
                >
                  Continue printing
                  <ArrowRight />
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg transition hover:shadow-orange-500/60"
                >
                  Get on the list
                  <ArrowRight />
                </Link>
              )}
              <a
                href="https://github.com/jaredzwick/equity-platform"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white backdrop-blur transition hover:bg-white/[0.08]"
              >
                Star on GitHub (if you&rsquo;re too poor for lambo but too smart for meme stocks)
              </a>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </>
  );
}

function Testimonial({
  name,
  title,
  quote,
  disclaimer,
  avatarBg,
  avatarText,
}: {
  name: string;
  title: string;
  quote: string;
  disclaimer: string;
  avatarBg: string;
  avatarText: string;
}) {
  return (
    <div className="relative flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
          style={{ background: avatarBg }}
          aria-hidden
        >
          {avatarText}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{name}</div>
          <div className="text-xs text-white/50">{title}</div>
        </div>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-white/80">&ldquo;{quote}&rdquo;</p>
      <p className="mt-4 border-t border-white/5 pt-3 text-[11px] italic text-white/40">
        * {disclaimer}
      </p>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 5l7 7-7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBrain() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a3 3 0 0 0-3 3v.5A3.5 3.5 0 0 0 5.5 10 3 3 0 0 0 5 16a3 3 0 0 0 3 3h.5a3.5 3.5 0 0 0 7 0H16a3 3 0 0 0 3-3 3 3 0 0 0-.5-6A3.5 3.5 0 0 0 15 6.5V6a3 3 0 0 0-3-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20V6m0 14h16M8 16v-4m4 4V9m4 7v-2m4 2v-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLambo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 15h18M4 15l2-5a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l2 5M6 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm12 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
