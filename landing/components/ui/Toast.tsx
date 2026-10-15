"use client";

import { useToast } from "@/lib/useToast";

// Toast — bottom-of-viewport pill. Rendered once at the layout root; the
// provider owns a single active toast at a time (see useToast.tsx). Position
// is `fixed bottom-6 left-1/2 -translate-x-1/2` which stays clear of the
// safe-area on iOS and doesn't overlap mobile Chrome's URL bar.
//
// Reduced-motion: when the user has `prefers-reduced-motion: reduce`, we
// skip the slide-in. The toast still appears and dismisses — only the
// animation is suppressed. All consumers: see `useToast()` in lib/useToast.
export function Toast() {
  const { current } = useToast();
  if (!current) return null;
  const isError = current.kind === "error";
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        "fixed bottom-6 left-1/2 z-50 -translate-x-1/2",
        "flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-lg backdrop-blur",
        "motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:fade-in",
        isError
          ? "border-red-500/30 bg-red-500/20 text-red-100"
          : "border-white/15 bg-black/90 text-white/90",
      ].join(" ")}
    >
      {!isError && <span aria-hidden>✓</span>}
      <span>{current.text}</span>
    </div>
  );
}
