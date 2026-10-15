"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type Step = {
  n: string;
  meme: string;
  real: string;
  body: ReactNode;
  proof: Array<{ value: string; label: string }>;
};

const steps: Step[] = [
  {
    n: "01",
    meme: "Get credit right.",
    real: "The SBA wants a 680 and a pulse.",
    body: (
      <>
        The quietest cheat code in finance. The government guarantees 75% of the
        loan, so banks approve down to 680 FICO.{" "}
        <span className="text-white">10% down</span> means a $1M business costs
        you $100K out of pocket. The business pays the rest from its own cash
        flow. You bring money, the bank brings leverage, the business brings the
        payments.
      </>
    ),
    proof: [
      { value: "10%", label: "Down payment" },
      { value: "680+", label: "FICO floor" },
      { value: "10 yr", label: "Loan term" },
    ],
  },
  {
    n: "02",
    meme: "Buy the biz.",
    real: "100 fresh listings a day. Claude reads them. You see the 8+.",
    body: (
      <>
        30 broker networks → one feed. Haiku reads every listing for SDE
        multiple, red flags, growth signals. You browse by fit score. Example
        shape on the floor today:{" "}
        <span className="text-white">HVAC, $380K SDE, 3.2× = $1.2M</span>. 10%
        down is $120K. Cash-on-cash in year one: 32%. Replace &ldquo;HVAC&rdquo;
        with laundromat, dental practice, SaaS — the math is the same math.
      </>
    ),
    proof: [
      { value: "30+", label: "Broker feeds" },
      { value: "~100", label: "New listings / day" },
      { value: "0–10", label: "Fit score" },
    ],
  },
  {
    n: "03",
    meme: "Turn it up.",
    real: "The previous owner is 68 and tired. You are not.",
    body: (
      <>
        Three levers the seller never pulled: raise prices 5%, hire a GM, turn
        on Google Ads. SDE goes from{" "}
        <span className="text-white">$380K to $500K</span> in year one. Business
        is now worth 3.2× × $500K = $1.6M. You created $400K of equity while
        cash flow pays the loan. That&rsquo;s the whole private-equity playbook,
        running at main-street scale, where nobody&rsquo;s bidding against you.
      </>
    ),
    proof: [
      { value: "+15%", label: "Typical yr-1 SDE lift" },
      { value: "Yr 1", label: "Payback window" },
      { value: "3–5×", label: "Exit multiple" },
    ],
  },
  {
    n: "04",
    meme: "Profit.",
    real: "Not year one. Not a lambo. Something better.",
    body: (
      <>
        Year 2: your W-2 is replaced by a business paying you{" "}
        <span className="text-white">$400K/yr</span> while covering debt
        service. Year 7: SBA paid off, SDE up 30%, you sell for 5× — a
        tax-advantaged capital gain while a new buyer takes the SBA baton. This
        is how dentists retire rich. The dentists just don&rsquo;t post about
        it.
      </>
    ),
    proof: [
      { value: "Yr 2", label: "Replace your W-2" },
      { value: "Yr 7", label: "Typical exit" },
      { value: "5×", label: "Return on down payment" },
    ],
  },
];

export default function MemeFunnel() {
  const [active, setActive] = useState(0);
  const sectionsRef = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.stepIdx);
            if (!Number.isNaN(idx)) setActive(idx);
          }
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 },
    );
    sectionsRef.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (idx: number) => {
    sectionsRef.current[idx]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative">
      {/* Mobile: horizontal step indicator pinned at top */}
      <div className="sticky top-0 z-20 -mx-6 border-y border-white/5 bg-[#05060f]/85 backdrop-blur md:hidden">
        <div className="flex items-stretch justify-between gap-2 px-6 py-3">
          {steps.map((s, i) => {
            const isActive = i === active;
            const isPast = i < active;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => scrollTo(i)}
                className="group flex flex-1 flex-col items-start gap-1.5 text-left"
                aria-label={`Jump to step ${s.n}: ${s.meme}`}
                aria-current={isActive ? "step" : undefined}
              >
                <div
                  className={`h-0.5 w-full rounded-full transition-all duration-500 ${
                    isActive || isPast
                      ? "bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"
                      : "bg-white/10"
                  }`}
                />
                <div
                  className={`font-mono text-[10px] transition-colors ${
                    isActive ? "text-yellow-300" : "text-white/40"
                  }`}
                >
                  {s.n}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="md:grid md:grid-cols-[220px_1fr] md:gap-16 lg:grid-cols-[260px_1fr]">
        {/* Desktop: sticky left step indicator */}
        <aside className="hidden md:block">
          <div className="sticky top-32">
            <div className="text-xs font-mono uppercase tracking-widest text-white/40">
              The path
            </div>
            <ol className="mt-6 space-y-5">
              {steps.map((s, i) => {
                const isActive = i === active;
                const isPast = i < active;
                return (
                  <li key={s.n}>
                    <button
                      type="button"
                      onClick={() => scrollTo(i)}
                      className="group flex w-full items-start gap-4 text-left"
                      aria-label={`Jump to step ${s.n}: ${s.meme}`}
                      aria-current={isActive ? "step" : undefined}
                    >
                      <div
                        className={`relative mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-full border transition-all duration-500 ${
                          isActive
                            ? "border-yellow-400 bg-yellow-400/15"
                            : isPast
                              ? "border-orange-500/60 bg-orange-500/10"
                              : "border-white/15 bg-white/[0.02] group-hover:border-white/30"
                        }`}
                      >
                        <div
                          className={`h-2 w-2 rounded-full transition-all duration-500 ${
                            isActive
                              ? "bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500"
                              : isPast
                                ? "bg-orange-400/70"
                                : "bg-white/20"
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`font-mono text-[11px] uppercase tracking-widest transition-colors ${
                            isActive ? "text-yellow-300" : "text-white/40"
                          }`}
                        >
                          Step {s.n}
                        </div>
                        <div
                          className={`mt-1 text-sm font-medium transition-colors ${
                            isActive
                              ? "text-white"
                              : "text-white/50 group-hover:text-white/70"
                          }`}
                        >
                          {s.meme}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        {/* Right: step content */}
        <div className="space-y-20 pt-8 md:space-y-32 md:pt-0">
          {steps.map((s, i) => (
            <StepPanel
              key={s.n}
              step={s}
              index={i}
              isLast={i === steps.length - 1}
              nextLabel={steps[i + 1]?.meme.replace(/\.$/, "")}
              onNext={() => scrollTo(i + 1)}
              setRef={(el) => {
                sectionsRef.current[i] = el;
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepPanel({
  step,
  index,
  isLast,
  nextLabel,
  onNext,
  setRef,
}: {
  step: Step;
  index: number;
  isLast: boolean;
  nextLabel?: string;
  onNext: () => void;
  setRef: (el: HTMLElement | null) => void;
}) {
  const localRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<"pre" | "in">("pre");

  useEffect(() => {
    setRef(localRef.current);
    const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduce) {
      setState("in");
      return;
    }
    const el = localRef.current;
    if (!el) return;
    const failsafe = window.setTimeout(() => setState("in"), 800);
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setState("in");
            obs.disconnect();
            window.clearTimeout(failsafe);
            break;
          }
        }
      },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      window.clearTimeout(failsafe);
    };
    // setRef is a stable callback from the parent; depending on it would
    // thrash this effect on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style: React.CSSProperties = {
    opacity: state === "in" ? 1 : 0,
    transform: state === "in" ? "none" : "translateY(20px)",
    transition:
      "opacity 700ms cubic-bezier(0.22,1,0.36,1), transform 700ms cubic-bezier(0.22,1,0.36,1)",
  };

  return (
    <section
      ref={localRef}
      data-step-idx={index}
      style={style}
      className="relative scroll-mt-28"
      aria-labelledby={`step-${step.n}-title`}
    >
      <div className="flex items-baseline gap-5">
        <div className="bg-gradient-to-br from-yellow-300 via-orange-400 to-red-500 bg-clip-text font-mono text-5xl font-bold leading-none text-transparent md:text-7xl">
          {step.n}
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
      </div>

      <h3
        id={`step-${step.n}-title`}
        className="mt-6 text-3xl font-semibold tracking-tight text-white md:text-5xl"
      >
        {step.meme}
      </h3>
      <p className="mt-3 text-base text-white/50 md:text-lg">{step.real}</p>

      <p className="mt-8 max-w-xl text-base leading-relaxed text-white/70 md:text-lg">
        {step.body}
      </p>

      <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
        {step.proof.map((p) => (
          <div key={p.label}>
            <div className="font-mono text-xl font-bold text-white md:text-2xl">
              {p.value}
            </div>
            <div className="mt-1 text-xs leading-tight text-white/50">
              {p.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10">
        {isLast ? (
          <Link
            href="/join"
            className="inline-flex items-center gap-3 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-7 py-4 text-sm font-bold uppercase tracking-wide text-black shadow-lg transition hover:shadow-orange-500/60"
          >
            Get the free 90-day playbook
            <ArrowRight />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="group inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 backdrop-blur transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
          >
            <span className="font-mono text-xs text-white/40">
              Step {String(index + 2).padStart(2, "0")}
            </span>
            <span>{nextLabel}</span>
            <span className="transition group-hover:translate-x-1">→</span>
          </button>
        )}
      </div>
    </section>
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
