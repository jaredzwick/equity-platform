"use client";

// SellListingForm — multi-step wizard for the $7 seller listing flow.
//
// Steps:
//   1. Business basics + narrative — pure client state, no server calls
//   2. Contact + Turnstile → POST /lamboapp/sellers/drafts (creates draft,
//                             mints session_token, stored in sessionStorage)
//   3. DD file upload → POST /lamboapp/sellers/drafts/{id}/files
//                        (bearer-authenticated, N-file loop)
//   4. Review + pay → POST /lamboapp/sellers/drafts/{id}/checkout
//                      (returns Stripe URL, redirects browser)
//
// Turnstile widget rendered via the CDN implicit script (no npm dep).
// Session token persisted in sessionStorage keyed by draft_id so a
// refresh on step 3 or 4 rehydrates automatically.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";

type Step = 1 | 2 | 3 | 4;

type FormState = {
  // Step 1: business
  name: string;
  origin: "online" | "smb";
  industry: string;
  location: string;
  website: string;
  askingPrice: string;
  annualRevenue: string;
  annualProfit: string;
  ageYears: string;
  thesis: string;
  redFlagsText: string; // one per line
  growthSignalsText: string;
  // Step 2: contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // E.164 target
};

const initialForm: FormState = {
  name: "",
  origin: "online",
  industry: "",
  location: "",
  website: "",
  askingPrice: "",
  annualRevenue: "",
  annualProfit: "",
  ageYears: "",
  thesis: "",
  redFlagsText: "",
  growthSignalsText: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

type Draft = { draft_id: string; session_token: string; seller_id: string };
type UploadedFile = {
  id: string;
  file_name: string;
  mime_type: string;
  byte_size: number;
};

// Server-side seller regex mirror. Frontend gates before firing the
// server call so the user gets an instant "phone looks invalid" message
// without a network round-trip. Server re-validates as source of truth.
const e164Regex = /^\+[1-9]\d{7,14}$/;

function normalizePhoneClient(raw: string): string {
  return raw.replace(/[\s().-]/g, "");
}

// Session storage keys — one entry per draft_id so a seller can (in
// principle) have multiple parallel drafts in the same browser. The
// wizard only surfaces one at a time via the ?draft= URL param.
const STORAGE_PREFIX = "lamboapp-sell:draft:";

function saveDraftToken(draftID: string, token: string) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + draftID, token);
  } catch {
    // sessionStorage may be blocked in privacy-mode browsers. The user
    // just can't resume if they refresh — the draft still lives server-
    // side and can be resumed via a magic-link email if we ever add one.
  }
}

function loadDraftToken(draftID: string): string | null {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + draftID);
  } catch {
    return null;
  }
}

// window global set by the Turnstile CDN script. Typed loosely because
// the Turnstile SDK is a browser-only global with a dynamic surface.
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetID?: string) => void;
      remove: (widgetID?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export default function SellListingForm({
  apiURL,
  turnstileSiteKey,
}: {
  apiURL: string;
  turnstileSiteKey: string;
}) {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(initialForm);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileMountRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIDRef = useRef<string | null>(null);

  // Rehydrate from URL ?draft= param on mount. Lets a Stripe-cancel
  // redirect land the seller back on step 4 with their form + files
  // intact.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftID = params.get("draft");
    if (!draftID) return;
    const token = loadDraftToken(draftID);
    if (!token) return;

    void (async () => {
      try {
        const res = await fetch(`${apiURL}/lamboapp/sellers/drafts/${draftID}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setDraft({
          draft_id: data.deal.id,
          session_token: token,
          seller_id: data.seller.id,
        });
        setForm((prev) => ({
          ...prev,
          name: data.deal.name || "",
          origin: (data.deal.origin as "online" | "smb") || "online",
          industry: data.deal.industry || "",
          location: data.deal.location || "",
          website: data.deal.website || "",
          askingPrice: numOrEmpty(data.deal.asking_price),
          annualRevenue: numOrEmpty(data.deal.annual_revenue),
          annualProfit: numOrEmpty(data.deal.annual_profit),
          ageYears: numOrEmpty(data.deal.age_years),
          thesis: data.deal.thesis || "",
          redFlagsText: (data.deal.red_flags || []).join("\n"),
          growthSignalsText: (data.deal.growth_signals || []).join("\n"),
          firstName: data.seller.first_name || "",
          lastName: data.seller.last_name || "",
          email: data.seller.email || "",
          phone: data.seller.phone || "",
        }));
        setFiles(data.files || []);
        setStep(4);
      } catch {
        // Rehydrate failed — silently fall through to step 1.
      }
    })();
  }, [apiURL]);

  // Mount the Turnstile widget when we reach step 2. Explicit render
  // so we can bind the callback to setState directly. Cleaned up on
  // step transition so a stepper-back doesn't leave a stale widget.
  useEffect(() => {
    if (step !== 2) return;
    if (!turnstileSiteKey || !turnstileMountRef.current) return;
    let cancelled = false;
    const mount = () => {
      if (cancelled) return;
      if (!window.turnstile || !turnstileMountRef.current) {
        // Script not loaded yet — try again on next frame. The
        // next/script tag below fires load asynchronously.
        window.setTimeout(mount, 100);
        return;
      }
      turnstileWidgetIDRef.current = window.turnstile.render(
        turnstileMountRef.current,
        {
          sitekey: turnstileSiteKey,
          theme: "dark",
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
        },
      );
    };
    mount();
    return () => {
      cancelled = true;
      if (window.turnstile && turnstileWidgetIDRef.current) {
        try {
          window.turnstile.remove(turnstileWidgetIDRef.current);
        } catch {
          /* noop */
        }
      }
      turnstileWidgetIDRef.current = null;
    };
  }, [step, turnstileSiteKey]);

  const step1Ready = useMemo(
    () =>
      form.name.trim().length > 1 &&
      form.industry.trim().length > 0 &&
      Number(form.askingPrice) > 0,
    [form],
  );

  const step2Ready = useMemo(() => {
    if (!form.email.includes("@")) return false;
    if (!turnstileToken && turnstileSiteKey) return false;
    const p = normalizePhoneClient(form.phone);
    if (p && !e164Regex.test(p)) return false;
    return true;
  }, [form, turnstileToken, turnstileSiteKey]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // Step 2 submit — creates the draft server-side with the Turnstile
  // token + basic identity, then PATCHes with the step 1 fields.
  const submitStep2 = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const phoneNormalized = normalizePhoneClient(form.phone);
      const createRes = await fetch(`${apiURL}/lamboapp/sellers/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          phone: phoneNormalized,
          turnstile_token: turnstileToken,
        }),
      });
      if (!createRes.ok) {
        const body = await safeReadError(createRes);
        throw new Error(body);
      }
      const created = (await createRes.json()) as Draft;
      saveDraftToken(created.draft_id, created.session_token);
      setDraft(created);

      // Push step 1 fields onto the freshly-created draft. Sends every
      // field so a partial-fill user still gets what they typed.
      const patchRes = await fetch(
        `${apiURL}/lamboapp/sellers/drafts/${created.draft_id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${created.session_token}`,
          },
          body: JSON.stringify({
            name: form.name,
            industry: form.industry,
            normalized_industry: form.industry,
            origin: form.origin,
            location: form.location || null,
            website: form.website || null,
            asking_price: numOrNull(form.askingPrice),
            annual_revenue: numOrNull(form.annualRevenue),
            annual_profit: numOrNull(form.annualProfit),
            age_years: numOrNull(form.ageYears),
            thesis: form.thesis || null,
            red_flags: splitLines(form.redFlagsText),
            growth_signals: splitLines(form.growthSignalsText),
          }),
        },
      );
      if (!patchRes.ok) {
        const body = await safeReadError(patchRes);
        throw new Error(body);
      }
      setStep(3);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }, [apiURL, form, turnstileToken]);

  // Step 3 — upload one file. Wired to the <input onChange> so multi-
  // select from the OS picker uploads sequentially. Server enforces the
  // 10-file / 25MB caps; frontend echoes them as friendly copy.
  const uploadFile = useCallback(
    async (file: File) => {
      if (!draft) return;
      if (file.size > 25 * 1024 * 1024) {
        setError(`"${file.name}" exceeds the 25MB limit`);
        return;
      }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `${apiURL}/lamboapp/sellers/drafts/${draft.draft_id}/files`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${draft.session_token}` },
          body: fd,
        },
      );
      if (!res.ok) {
        setError(`"${file.name}" — ${await safeReadError(res)}`);
        return;
      }
      const body = await res.json();
      setFiles((prev) => [...prev, body.file]);
    },
    [apiURL, draft],
  );

  const removeFile = useCallback(
    async (fileID: string) => {
      if (!draft) return;
      const res = await fetch(
        `${apiURL}/lamboapp/sellers/drafts/${draft.draft_id}/files/${fileID}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${draft.session_token}` },
        },
      );
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileID));
      }
    },
    [apiURL, draft],
  );

  const goToCheckout = useCallback(async () => {
    if (!draft) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `${apiURL}/lamboapp/sellers/drafts/${draft.draft_id}/checkout`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${draft.session_token}` },
        },
      );
      if (!res.ok) {
        throw new Error(await safeReadError(res));
      }
      const body = await res.json();
      if (typeof body.checkout_url !== "string") {
        throw new Error("checkout URL missing from response");
      }
      window.location.href = body.checkout_url;
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  }, [apiURL, draft]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur md:p-8">
      {turnstileSiteKey && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          strategy="lazyOnload"
        />
      )}

      <StepIndicator step={step} />

      {error && (
        <div className="mt-4 rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="mt-6 space-y-4">
          <Field label="Business name" required>
            <TextInput
              value={form.name}
              onChange={(v) => setField("name", v)}
              placeholder="Acme Widgets LLC"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Industry" required>
              <TextInput
                value={form.industry}
                onChange={(v) => setField("industry", v)}
                placeholder="SaaS / Ecommerce / Agency ..."
              />
            </Field>
            <Field label="Type">
              <select
                value={form.origin}
                onChange={(e) =>
                  setField("origin", e.target.value as "online" | "smb")
                }
                className={inputClass}
              >
                <option value="online">Online business</option>
                <option value="smb">SMB / brick-and-mortar</option>
              </select>
            </Field>
            <Field label="Location">
              <TextInput
                value={form.location}
                onChange={(v) => setField("location", v)}
                placeholder="Austin, TX or Remote"
              />
            </Field>
            <Field label="Website (optional)">
              <TextInput
                value={form.website}
                onChange={(v) => setField("website", v)}
                placeholder="https://..."
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field label="Asking price (USD)" required>
              <TextInput
                value={form.askingPrice}
                onChange={(v) => setField("askingPrice", numericOnly(v))}
                placeholder="100000"
                inputMode="numeric"
              />
            </Field>
            <Field label="Annual revenue">
              <TextInput
                value={form.annualRevenue}
                onChange={(v) => setField("annualRevenue", numericOnly(v))}
                placeholder="80000"
                inputMode="numeric"
              />
            </Field>
            <Field label="Annual profit (SDE)">
              <TextInput
                value={form.annualProfit}
                onChange={(v) => setField("annualProfit", numericOnly(v))}
                placeholder="40000"
                inputMode="numeric"
              />
            </Field>
            <Field label="Business age (years)">
              <TextInput
                value={form.ageYears}
                onChange={(v) => setField("ageYears", numericOnly(v))}
                placeholder="4"
                inputMode="numeric"
              />
            </Field>
          </div>
          <Field label="Thesis / why should someone buy this?" hint="2–3 sentences. Shown on the public listing.">
            <textarea
              value={form.thesis}
              onChange={(e) => setField("thesis", e.target.value)}
              rows={4}
              maxLength={1000}
              className={inputClass + " resize-none"}
              placeholder="Recurring revenue, defensible SEO moat, growing 15% YoY on paid+organic, owner works ~5hrs/wk..."
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Red flags (one per line)" hint="Be honest — buyers respect it.">
              <textarea
                value={form.redFlagsText}
                onChange={(e) => setField("redFlagsText", e.target.value)}
                rows={4}
                className={inputClass + " resize-none"}
                placeholder="Only 3 customers = 60% of revenue&#10;Owner is the only support agent"
              />
            </Field>
            <Field label="Growth signals (one per line)">
              <textarea
                value={form.growthSignalsText}
                onChange={(e) => setField("growthSignalsText", e.target.value)}
                rows={4}
                className={inputClass + " resize-none"}
                placeholder="New enterprise pipeline valued at $200k&#10;Untapped SEO for adjacent keywords"
              />
            </Field>
          </div>
          <div className="flex justify-end pt-2">
            <Button disabled={!step1Ready} onClick={() => setStep(2)}>
              Continue →
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="First name">
              <TextInput
                value={form.firstName}
                onChange={(v) => setField("firstName", v)}
              />
            </Field>
            <Field label="Last name">
              <TextInput
                value={form.lastName}
                onChange={(v) => setField("lastName", v)}
              />
            </Field>
          </div>
          <Field label="Email" required>
            <TextInput
              value={form.email}
              onChange={(v) => setField("email", v)}
              placeholder="you@example.com"
              type="email"
            />
          </Field>
          <Field
            label="Phone"
            hint="Optional at this step. Stripe will collect it before payment as a fallback. Format: +15551234567"
          >
            <TextInput
              value={form.phone}
              onChange={(v) => setField("phone", v)}
              placeholder="+15551234567"
              type="tel"
              inputMode="tel"
            />
          </Field>

          {turnstileSiteKey ? (
            <div className="pt-2">
              <div ref={turnstileMountRef} />
              {!turnstileToken && (
                <p className="mt-2 text-xs text-white/50">Solve the human check above to continue.</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border border-yellow-400/40 bg-yellow-400/[0.06] p-3 text-xs text-yellow-200">
              Dev mode: NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set. Server-side Turnstile
              verification will still fire — set the key in .env before shipping.
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button
              disabled={!step2Ready || submitting}
              onClick={() => void submitStep2()}
            >
              {submitting ? "Creating draft..." : "Continue →"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && draft && (
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm text-white/70">
              Upload up to <span className="text-white">10 files</span>, max{" "}
              <span className="text-white">25MB each</span>. PDF, DOCX, XLSX, PNG, or JPEG.
              These stay private and are only shared when a buyer requests access.
            </p>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.02] p-10 text-center transition hover:border-yellow-400/50 hover:bg-white/[0.04]">
            <span className="text-3xl">📎</span>
            <span className="mt-2 text-sm font-medium text-white">
              Click to choose files
            </span>
            <span className="mt-1 text-xs text-white/50">
              {files.length} of 10 uploaded
            </span>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/png,image/jpeg"
              className="hidden"
              onChange={async (e) => {
                const list = e.target.files;
                if (!list) return;
                for (let i = 0; i < list.length; i++) {
                  if (files.length + i >= 10) break;
                  const f = list.item(i);
                  if (f) await uploadFile(f);
                }
                e.target.value = "";
              }}
            />
          </label>

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-white">{f.file_name}</div>
                    <div className="text-xs text-white/50">
                      {humanBytes(f.byte_size)} · {shortMime(f.mime_type)}
                    </div>
                  </div>
                  <button
                    className="ml-4 text-xs text-white/50 hover:text-red-400"
                    onClick={() => void removeFile(f.id)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button onClick={() => setStep(4)}>Continue →</Button>
          </div>
        </div>
      )}

      {step === 4 && draft && (
        <div className="mt-6 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
            <h3 className="text-base font-semibold text-white">Review your listing</h3>
            <dl className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <ReviewRow label="Business" value={form.name} />
              <ReviewRow label="Industry" value={form.industry} />
              <ReviewRow label="Type" value={form.origin === "online" ? "Online business" : "SMB"} />
              <ReviewRow label="Location" value={form.location || "—"} />
              <ReviewRow label="Asking" value={`$${form.askingPrice || "—"}`} />
              <ReviewRow label="Annual revenue" value={form.annualRevenue ? `$${form.annualRevenue}` : "—"} />
              <ReviewRow label="Annual profit" value={form.annualProfit ? `$${form.annualProfit}` : "—"} />
              <ReviewRow label="Files attached" value={String(files.length)} />
              <ReviewRow label="Contact email" value={form.email} />
              <ReviewRow label="Phone" value={form.phone || "(Stripe will collect)"} />
            </dl>
          </div>

          <div className="rounded-2xl border border-yellow-400/40 bg-yellow-400/[0.06] p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-sm text-yellow-200">One-time fee</div>
                <div className="text-3xl font-semibold text-white">$7</div>
              </div>
              <div className="text-xs text-yellow-200/80">
                Listing goes live at
                <br />
                lamboapp.com/deal/{"{your-slug}"}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(3)}>
              ← Back
            </Button>
            <Button
              disabled={submitting}
              onClick={() => void goToCheckout()}
            >
              {submitting ? "Redirecting..." : "Pay $7 & publish →"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small UI primitives ─────────────────────────────────────────────

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/30 outline-none transition focus:border-yellow-400/60 focus:bg-white/[0.05]";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium text-white/80">
          {label}
          {required && <span className="ml-1 text-yellow-400">*</span>}
        </span>
        {hint && <span className="text-white/40">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={inputClass}
    />
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  if (variant === "ghost") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.06] disabled:opacity-50"
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg shadow-orange-500/40 transition hover:shadow-orange-500/70 disabled:opacity-40 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const labels = ["Business", "Contact", "DD files", "Pay"];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {labels.map((label, idx) => {
        const n = (idx + 1) as Step;
        const active = n === step;
        const done = n < step;
        return (
          <li
            key={label}
            className={
              "flex items-center gap-2 rounded-full px-3 py-1.5 " +
              (active
                ? "bg-yellow-400/[0.15] text-yellow-200"
                : done
                  ? "text-white/80"
                  : "text-white/40")
            }
          >
            <span
              className={
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] " +
                (active || done
                  ? "bg-yellow-400 text-black"
                  : "border border-white/20 text-white/50")
              }
            >
              {done ? "✓" : n}
            </span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/5 pb-2 last:border-b-0">
      <dt className="text-white/50">{label}</dt>
      <dd className="ml-4 truncate text-right text-white">{value}</dd>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function numericOnly(v: string) {
  return v.replace(/[^\d.]/g, "");
}

function numOrEmpty(v: unknown) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!isFinite(n) || n === 0) return "";
  return String(n);
}

function numOrNull(v: string): number | null {
  if (v === "") return null;
  const n = Number(v);
  if (!isFinite(n)) return null;
  return n;
}

function splitLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function humanBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function shortMime(m: string) {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      "XLSX",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
  };
  return map[m] || m;
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (typeof j?.detail === "string") return j.detail;
    if (typeof j?.message === "string") return j.message;
    if (typeof j?.error === "string") return j.error;
    return `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
