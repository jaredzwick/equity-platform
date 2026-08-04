"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    n: "01",
    title: "Sign in with GitHub",
    body: "One click. We use the standard GitHub App OAuth flow — no PATs, no secrets to manage.",
  },
  {
    n: "02",
    title: "We fork the platform to your account",
    body: "You get your own copy of the equity-platform repo. Every change lands as a commit on your fork.",
  },
  {
    n: "03",
    title: "Clone + ./local/up.sh",
    body: "One script boots a local kind cluster with ArgoCD, NATS, and the multi-tenant console. ~3 minutes.",
  },
  {
    n: "04",
    title: "Create businesses from the console",
    body: "Every action writes YAML to your fork. ArgoCD reconciles. Rollback is git revert.",
  },
];

function Step({ n, title, body, index }: { n: string; title: string; body: string; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const [state, setState] = useState<"pre" | "in">("pre");
  useEffect(() => {
    const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduce) {
      setState("in");
      return;
    }
    const el = ref.current;
    if (!el) return;
    const failsafe = window.setTimeout(() => setState("in"), 900);
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
      { threshold: 0.05 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);
  const delay = 0.06 * index;
  const dir = index % 2 === 0 ? -24 : 24;
  const style: React.CSSProperties = {
    opacity: state === "in" ? 1 : 0,
    transform: state === "in" ? "none" : `translateX(${dir}px)`,
    transition: `opacity 600ms cubic-bezier(0.22,1,0.36,1) ${delay}s, transform 600ms cubic-bezier(0.22,1,0.36,1) ${delay}s`,
  };
  return (
    <li
      ref={ref}
      style={style}
      className={`relative flex flex-col md:flex-row md:items-center gap-5 md:gap-8 ${
        index % 2 === 1 ? "md:flex-row-reverse" : ""
      }`}
    >
      <div className="absolute left-6 md:left-1/2 md:-translate-x-1/2 -translate-y-1 z-10 flex h-3 w-3 items-center justify-center rounded-full bg-indigo-500 ring-4 ring-indigo-500/20" />
      <div className="pl-14 md:pl-0 md:w-1/2 md:px-8">
        <div className="text-xs font-mono text-indigo-400/80">{n}</div>
        <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{body}</p>
      </div>
      <div className="hidden md:block md:w-1/2" />
    </li>
  );
}

export default function HowItWorks() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute left-6 top-4 bottom-4 w-px bg-gradient-to-b from-indigo-500/0 via-indigo-500/70 to-fuchsia-500/0 md:left-1/2 md:-translate-x-1/2"
      />
      <ol className="space-y-10">
        {steps.map((s, i) => (
          <Step key={s.n} n={s.n} title={s.title} body={s.body} index={i} />
        ))}
      </ol>
    </div>
  );
}
