"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Map of internal error codes → human copy. Anything not in the map falls
// back to the generic entry. Keep messages second-person, actionable, and
// specific about who owns the fix (you vs GitHub vs us).
type ErrorEntry = {
  title: string;
  detail: string;
  actions?: Array<{ label: string; href: string; primary?: boolean }>;
};

// GitHub OAuth is currently disabled on lamboapp.com — every auth error
// funnels users to the phone-signup form at /signup instead of retrying
// the broken GH flow. The `oauth_*` / `token_*` / `csrf` codes still get
// mapped so error links that were emailed or bookmarked before the swap
// don't render as raw codes.
const SIGNUP_ACTION = { label: "Get on the list", href: "/signup", primary: true } as const;

const ERROR_MAP: Record<string, ErrorEntry> = {
  not_authenticated: {
    title: "Get on the list first",
    detail:
      "Drop your name and phone number and we'll text you when the next scored deal lands. Takes 10 seconds.",
    actions: [SIGNUP_ACTION],
  },
  csrf: {
    title: "Session expired",
    detail:
      "Your sign-in link was too old, or your browser cleared cookies mid-flow. GitHub sign-in is offline right now — use the phone signup instead.",
    actions: [SIGNUP_ACTION],
  },
  missing_code_or_state: {
    title: "Sign-in didn't complete",
    detail:
      "GitHub sign-in is temporarily disabled while we swap the auth flow. Sign up with your phone number instead — same result, no GitHub account required.",
    actions: [SIGNUP_ACTION],
  },
  user_fetch_failed: {
    title: "GitHub sign-in is offline",
    detail:
      "We're mid-migration off GitHub OAuth. Use the phone signup below and we'll text you when the next deal drops.",
    actions: [SIGNUP_ACTION],
  },
};

function fallback(code: string): ErrorEntry {
  if (code.startsWith("oauth_") || code.startsWith("token_")) {
    return {
      title: "GitHub sign-in is offline",
      detail:
        "We're moving off GitHub OAuth. Sign up with your phone number instead — takes 10 seconds and no GitHub account required.",
      actions: [SIGNUP_ACTION],
    };
  }
  return {
    title: "Something went wrong",
    detail: `Unexpected error: ${code}. Sign up with your phone number instead — GitHub OAuth is currently disabled.`,
    actions: [SIGNUP_ACTION],
  };
}

export default function AuthErrorBanner({
  errorCode,
  message,
}: {
  errorCode: string;
  message?: string;
}) {
  const router = useRouter();

  // Strip the ?error=&msg= from the URL after we've rendered them so a
  // refresh or a share of the URL doesn't re-show the same error. Uses
  // history.replaceState via router.replace so the banner stays visible
  // until the user dismisses it (React state on the component keeps the
  // props, even after the URL changes).
  useEffect(() => {
    router.replace("/", { scroll: false });
    // Only run on first mount — the URL is now clean, don't re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entry = ERROR_MAP[errorCode] ?? fallback(errorCode);

  return (
    <div className="fixed left-1/2 top-6 z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2">
      <div className="overflow-hidden rounded-2xl border border-amber-400/40 bg-neutral-950/95 shadow-2xl shadow-amber-500/10 backdrop-blur-xl">
        {/* Accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-rose-400 to-amber-400" />

        <div className="p-5">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">{entry.title}</h3>
                <button
                  type="button"
                  onClick={() => router.replace("/", { scroll: false })}
                  aria-label="Dismiss"
                  className="ml-2 rounded p-1 text-white/40 transition hover:bg-white/5 hover:text-white/80"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 0 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </div>

              <p className="mt-1.5 text-sm leading-relaxed text-white/70">{entry.detail}</p>

              {message && (
                <details className="mt-3 group">
                  <summary className="cursor-pointer list-none text-xs text-white/40 transition hover:text-white/70">
                    <span className="inline-flex items-center gap-1.5">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 transition group-open:rotate-90" aria-hidden>
                        <path
                          fillRule="evenodd"
                          d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Technical details
                    </span>
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-auto rounded-md border border-white/10 bg-black/40 p-2.5 text-[11px] leading-relaxed text-white/60">
                    {message}
                  </pre>
                </details>
              )}

              {entry.actions && entry.actions.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {entry.actions.map((a) =>
                    a.primary ? (
                      <Link
                        key={a.label}
                        href={a.href}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-indigo-500/40"
                      >
                        {a.label}
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden>
                          <path
                            fillRule="evenodd"
                            d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </Link>
                    ) : (
                      <Link
                        key={a.label}
                        href={a.href}
                        className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/[0.08]"
                        {...(a.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                      >
                        {a.label}
                      </Link>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
