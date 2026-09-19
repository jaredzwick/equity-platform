"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// SaveDealCTA — primary conversion moment for /deal/[slug]. Mirrors
// the localStorage-backed "saved deals" set used by DealBrowseList
// (LOCAL_KEY "lambo.deals.saved.v1") so the deal-detail page and the
// browse grid share one wishlist. Unauth visitors save + then route
// to /signup with the current deal as their redirect_to so they land
// back here after auth. Auth visitors just toggle the local pin
// (backend watchlist is a future v1 add — same TODO as DealBrowseList).

const LOCAL_KEY = "lambo.deals.saved.v1";

export function SaveDealCTA({
  dealId,
  slug,
  isAuth,
}: {
  dealId: string;
  slug: string;
  isAuth: boolean;
}) {
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw) as string[];
      if (Array.isArray(arr) && arr.includes(dealId)) setSaved(true);
    } catch {
      // corrupt payload — drop it, avoid a save-state lie
      window.localStorage.removeItem(LOCAL_KEY);
    }
  }, [dealId]);

  const persistSave = (): void => {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      const set = new Set(Array.isArray(arr) ? arr : []);
      set.add(dealId);
      window.localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify(Array.from(set)),
      );
    } catch {
      // storage disabled or full — swallow; button still visually toggles
    }
  };

  const persistUnsave = (): void => {
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw) as string[];
      const set = new Set(Array.isArray(arr) ? arr : []);
      set.delete(dealId);
      window.localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify(Array.from(set)),
      );
    } catch {
      // same swallow rationale
    }
  };

  if (!hydrated) {
    // Render a stable neutral state during SSR/hydration so the DOM
    // matches the server output and doesn't flash a "Saved" state on
    // reload for auth users whose local set already contains the deal.
    return (
      <span className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black opacity-70">
        Save this deal
      </span>
    );
  }

  if (!isAuth) {
    return (
      <Link
        href={`/signup?redirect_to=${encodeURIComponent(`/deal/${slug}`)}`}
        onClick={persistSave}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg transition hover:shadow-orange-500/60"
      >
        <StarIcon filled={false} /> Save this deal
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (saved) {
          persistUnsave();
          setSaved(false);
        } else {
          persistSave();
          setSaved(true);
        }
      }}
      aria-pressed={saved}
      className={
        saved
          ? "inline-flex items-center gap-2 rounded-lg border border-yellow-400/60 bg-yellow-400/10 px-6 py-3 text-sm font-bold uppercase tracking-wide text-yellow-200 transition-colors"
          : "inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg transition hover:shadow-orange-500/60"
      }
    >
      <StarIcon filled={saved} />
      {saved ? "Saved to your list" : "Save this deal"}
    </button>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l2.9 6.9L22 11l-5.5 4.9L18 23l-6-3.7L6 23l1.5-7.1L2 11l7.1-1.1L12 3z" />
    </svg>
  );
}
