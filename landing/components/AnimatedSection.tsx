"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Simple, bulletproof reveal-on-scroll. Uses IntersectionObserver directly.
//
// Guarantees:
//   1) SSR renders the section visible-shaped in the DOM (only opacity + y
//      transform vary), so first paint never flashes empty.
//   2) On mount JS applies "not yet visible" state, then the observer
//      animates it in when it intersects.
//   3) HARD FAILSAFE: 800ms after mount, force reveal even if the observer
//      never fires (headless screenshots, misbehaving polyfills, etc).
//   4) If the user prefers reduced motion, we skip the transform + delay.
export default function AnimatedSection({
  children,
  delay = 0,
  className = "",
  id,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
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
    transition: `opacity 700ms cubic-bezier(0.22,1,0.36,1) ${delay}s, transform 700ms cubic-bezier(0.22,1,0.36,1) ${delay}s`,
    willChange: state === "pre" ? "opacity, transform" : undefined,
  };

  return (
    <section id={id} ref={ref} className={className} style={style}>
      {children}
    </section>
  );
}
