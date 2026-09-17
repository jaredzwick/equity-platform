"use client";

import { useState } from "react";

// Small client wrapper so /master/github can offer a one-click sign-out
// path when the stored token is 401'ing. Posts to the existing logout
// route, then hard-reloads so the page's server-side auth check reruns.
export default function SignOutButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          window.location.reload();
        }
      }}
      className="px-2.5 py-1 rounded border border-[color:var(--color-border)] text-[color:var(--color-fg)] hover:bg-white/5 disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Sign out & re-auth"}
    </button>
  );
}
