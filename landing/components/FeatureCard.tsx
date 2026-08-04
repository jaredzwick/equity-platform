"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export default function FeatureCard({
  icon,
  title,
  body,
  accent,
  delay = 0,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  accent: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"pre" | "in">("pre");

  useEffect(() => {
    const prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduce) {
      setState("in");
      return;
    }
    const el = ref.current;
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
      { threshold: 0.05 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      window.clearTimeout(failsafe);
    };
  }, []);

  const style: React.CSSProperties = {
    opacity: state === "in" ? 1 : 0,
    transform: state === "in" ? "none" : "translateY(24px)",
    transition: `opacity 600ms cubic-bezier(0.22,1,0.36,1) ${delay}s, transform 600ms cubic-bezier(0.22,1,0.36,1) ${delay}s`,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition-transform hover:-translate-y-1"
    >
      <div
        className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60"
        style={{ background: accent }}
      />
      <div className="relative">
        <div
          className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl text-white"
          style={{ background: accent }}
        >
          {icon}
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/60">{body}</p>
      </div>
    </div>
  );
}
