"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/deals-shared";
import { DealCard } from "@/components/deals/DealCard";

// DealBrowseList — client wrapper that owns the "saved" set + renders
// each deal card. Saved state is localStorage-backed for both auth and
// unauth (unauth users can build a wishlist before signing up — the set
// survives the round-trip to /signup and back).
//
// Server-side persistence to buyer_deal_saved (or similar) is a v1 add
// — for the MVP, "save" means "starred in your local browser" for
// unauth, and "starred in your local browser + POST to backend
// watchlist" for auth. Backend watchlist persistence deferred with a
// TODO.

const LOCAL_KEY = "lambo.deals.saved.v1";

export function DealBrowseList({
  deals,
  isAuth,
}: {
  deals: Deal[];
  isAuth: boolean;
}) {
  const [saved, setSaved] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(LOCAL_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as string[];
      return Array.isArray(arr) ? new Set(arr) : new Set();
    } catch {
      window.localStorage.removeItem(LOCAL_KEY);
      return new Set();
    }
  });

  // Persist on every change. Skip if window doesn't exist (SSR).
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(Array.from(saved)));
  }, [saved]);

  const toggle = (id: string) => {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {deals.map((deal) => (
        <DealCard
          key={deal.id}
          deal={deal}
          isAuth={isAuth}
          isSaved={saved.has(deal.id)}
          onToggleSave={() => toggle(deal.id)}
        />
      ))}
    </div>
  );
}
