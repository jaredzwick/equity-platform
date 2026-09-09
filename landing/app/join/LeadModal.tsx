"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "form" | "submitting" | "error";

const LOADING_COPY = [
  { atMs: 0, text: "Locking in your copy…" },
  { atMs: 700, text: "Attaching the playbook PDF…" },
  { atMs: 1400, text: "Sending it to your inbox…" },
  { atMs: 2100, text: "Done! Redirecting…" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function LeadModal({ open, onClose }: Props) {
  const router = useRouter();
  const firstFieldRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState<string>("");
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [fields, setFields] = useState({ name: "", email: "", phone: "" });
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
  }>({});

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => firstFieldRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "submitting") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, stage]);

  useEffect(() => {
    if (stage !== "submitting") return;
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      let next = 0;
      for (let i = LOADING_COPY.length - 1; i >= 0; i--) {
        if (elapsed >= LOADING_COPY[i].atMs) {
          next = i;
          break;
        }
      }
      setLoadingIdx(next);
    }, 200);
    return () => clearInterval(interval);
  }, [stage]);

  function validate(): boolean {
    const errs: typeof fieldErrors = {};
    if (fields.name.trim().length < 2)
      errs.name = "Please enter your name.";
    const email = fields.email.trim();
    if (email.length < 5 || !/.+@.+\..+/.test(email))
      errs.email = "Please enter a valid email.";
    const digits = fields.phone.replace(/\D/g, "");
    if (digits.length < 10)
      errs.phone = "Please enter a valid phone number.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    setError("");
    setLoadingIdx(0);
    setStage("submitting");

    let source = "join-guide";
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const utm = params.get("utm_source") ?? params.get("ref");
      if (utm) source = `join-guide:${utm}`;
    }

    const start = Date.now();
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name.trim(),
          email: fields.email.trim(),
          phone: fields.phone,
          source,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;
      if (!res.ok || !body?.ok) {
        setStage("error");
        setError(
          body?.error ??
            `We couldn't submit that (HTTP ${res.status}). Try again in a moment.`,
        );
        return;
      }

      // Ensure the visitor sees the full 4-stage progression even on very
      // fast networks. Minimum 2.4s so "Done!" actually renders.
      const elapsed = Date.now() - start;
      const minMs = 2400;
      if (elapsed < minMs) {
        await new Promise((r) => setTimeout(r, minMs - elapsed));
      }
      router.push("/join/thanks");
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-modal-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => stage !== "submitting" && onClose()}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0b0b0e] p-6 text-left shadow-2xl shadow-orange-500/10 sm:p-8">
        {stage === "submitting" ? (
          <SpinnerStages currentIdx={loadingIdx} />
        ) : (
          <>
            <div className="mb-6 text-center">
              <p className="text-xs font-mono uppercase tracking-[0.2em] text-yellow-400">
                Free · Instant Delivery
              </p>
              <h2
                id="join-modal-title"
                className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-3xl"
              >
                Send me the playbook
              </h2>
              <p className="mt-2 text-sm text-white/60">
                We&rsquo;ll email the PDF and text you when new deals hit.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <Field
                label="Your name"
                name="name"
                required
                ref={firstFieldRef}
                value={fields.name}
                onChange={(v) => setFields((f) => ({ ...f, name: v }))}
                error={fieldErrors.name}
                autoComplete="name"
              />
              <Field
                label="Email"
                name="email"
                type="email"
                required
                value={fields.email}
                onChange={(v) => setFields((f) => ({ ...f, email: v }))}
                error={fieldErrors.email}
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
              />
              <Field
                label="Mobile number"
                name="phone"
                type="tel"
                required
                value={fields.phone}
                onChange={(v) => setFields((f) => ({ ...f, phone: v }))}
                error={fieldErrors.phone}
                autoComplete="tel"
                inputMode="tel"
                placeholder="+1 555 555 5555"
              />

              {stage === "error" && (
                <p
                  role="alert"
                  className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                data-testid="lead-submit"
                className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-6 py-3.5 text-base font-bold uppercase tracking-wide text-black shadow-lg shadow-orange-500/30 transition-all hover:shadow-orange-500/60 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:ring-offset-2 focus:ring-offset-[#0b0b0e]"
              >
                Email Me the Playbook →
              </button>

              <p className="pt-1 text-center text-[11px] text-white/40">
                No spam. Reply STOP anytime.
              </p>
            </form>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-white/50 transition-colors hover:bg-white/5 hover:text-white"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SpinnerStages({ currentIdx }: { currentIdx: number }) {
  const pct = ((currentIdx + 1) / LOADING_COPY.length) * 100;
  return (
    <div data-testid="lead-spinner" className="py-4">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="mt-6 space-y-3">
        {LOADING_COPY.map((row, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <li
              key={row.text}
              className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                done ? "text-white" : "text-white/40"
              } ${active ? "font-semibold" : ""}`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition-all duration-300 ${
                  done ? "bg-emerald-500" : "bg-white/10"
                }`}
              >
                {done ? (
                  <svg
                    className="h-3 w-3 text-black"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth={3}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                )}
              </span>
              <span>{row.text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  error?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
};

const Field = forwardRef<HTMLInputElement, FieldProps>(function LeadField(
  {
    label,
    name,
    value,
    onChange,
    type = "text",
    required,
    error,
    autoComplete,
    inputMode,
    placeholder,
  },
  ref,
) {
  const id = `join-field-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs font-medium text-white/60"
      >
        {label} {required && <span className="text-yellow-400">*</span>}
      </label>
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border bg-black/40 px-3.5 py-2.5 text-[15px] text-white placeholder:text-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-400/40 ${
          error
            ? "border-red-500/60"
            : "border-white/10 focus:border-yellow-400/50"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
});
