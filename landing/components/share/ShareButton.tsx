"use client";

import { useRef, useState } from "react";
import { nativeSharePayload, type ShareableDeal } from "@/lib/share";
import { ShareOverlay } from "./ShareOverlay";

// ShareButton — pill-shaped button with a share icon + "Share" label.
// Rendered twice per deal page: once below the verdict pill (above the h1)
// and once inside the "Pin it before you forget" bottom CTA block. Both
// instances share this component but keep local overlay state so the two
// buttons never conflict.
//
// Mobile branching:
//   - matchMedia('(max-width: 640px)') AND navigator.share → call native
//     share; the OS owns the UX end-to-end
//   - matchMedia('(max-width: 640px)') AND no navigator.share → open the
//     same overlay as desktop (iOS Safari in-app webviews land here)
//   - desktop → always open the overlay
// Detection runs at click time (not render time) so there's no SSR/CSR
// hydration mismatch risk.
//
// Analytics: destination URLs carry UTM params (utm_source=share plus
// per-channel utm_medium) so Vercel's native inbound-traffic analytics
// capture the loop without a client-side track() call. If/when a custom
// client event is added later, inline it in onClick() right before the
// window.open / navigator.share invocation.

type Variant = "default" | "ghost";

type Props = {
  deal: ShareableDeal;
  variant?: Variant;
  className?: string;
};

export function ShareButton({ deal, variant = "default", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  async function onClick() {
    const isMobile =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 640px)").matches;
    const canNativeShare =
      typeof navigator !== "undefined" && typeof navigator.share === "function";
    if (isMobile && canNativeShare) {
      try {
        await navigator.share(nativeSharePayload(deal));
        return;
      } catch (err) {
        // User-cancellation shows up as AbortError in Chrome and some
        // Safari versions; treat as silent dismiss. Any other failure
        // falls through to the overlay so the user still has a path.
        if ((err as DOMException | undefined)?.name === "AbortError") return;
      }
    }
    setOpen(true);
  }

  const baseCls =
    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black";
  const variantCls =
    variant === "ghost"
      ? "border-white/15 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white"
      : "border-white/15 bg-white/5 text-white/90 hover:border-white/30 hover:bg-white/10";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Share this deal"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={onClick}
        className={`${baseCls} ${variantCls} ${className}`}
        data-share-button
      >
        <IconShare className="h-4 w-4" />
        <span>Share</span>
      </button>
      {open && (
        <ShareOverlay
          deal={deal}
          onClose={() => setOpen(false)}
          returnFocusTo={buttonRef.current}
        />
      )}
    </>
  );
}

function IconShare({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}
