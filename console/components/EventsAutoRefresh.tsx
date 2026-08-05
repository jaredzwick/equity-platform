"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

// Ticks router.refresh() on an interval so the server-rendered /events
// page feels live. Guards against stacking when a refresh is in-flight —
// otherwise a slow /jsz fetch could pile up requests.
export function EventsAutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const inFlight = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (inFlight.current) return;
      inFlight.current = true;
      startTransition(() => {
        router.refresh();
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs, startTransition]);

  useEffect(() => {
    if (!isPending) inFlight.current = false;
  }, [isPending]);

  return null;
}
