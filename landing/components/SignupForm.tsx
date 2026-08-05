"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  source?: string; // free-form label — "hero", "footer", "signup-page"
  ctaLabel?: string;
};

// Two-field signup — name + phone. Submits to /api/leads. On success,
// redirects to /signup/thanks so the user gets a proper "you're in"
// moment (and so refreshing doesn't re-submit). Client-side validation
// mirrors the server-side rules in lib/leads-store.ts so the UX shows
// specific errors before the round-trip.
export default function SignupForm({
  source = "signup-page",
  ctaLabel = "Get on the list",
}: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const nameOk = name.trim().length >= 2;
    const phoneDigits = phone.replace(/\D/g, "").length;
    const phoneOk = phoneDigits >= 10 && phoneDigits <= 15;
    if (!nameOk) return setError("Name is required.");
    if (!phoneOk) return setError("Enter a valid phone number (10–15 digits).");

    setBusy(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, source }),
      });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!body.ok) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      router.push("/signup/thanks");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-md flex-col gap-3"
      noValidate
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
          required
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/40 backdrop-blur focus:border-yellow-400/60 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 disabled:opacity-60"
        />
        <input
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Mobile number"
          autoComplete="tel"
          required
          disabled={busy}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/40 backdrop-blur focus:border-yellow-400/60 focus:outline-none focus:ring-2 focus:ring-yellow-400/20 disabled:opacity-60"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="group inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg shadow-orange-500/40 transition hover:shadow-orange-500/70 disabled:opacity-60"
        >
          {busy ? "Sending…" : ctaLabel}
          {!busy && <span aria-hidden>→</span>}
        </button>
        <p className="text-xs text-white/40">
          No spam. Reply STOP anytime.
        </p>
      </div>
      {error && (
        <p className="text-xs text-red-300" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
