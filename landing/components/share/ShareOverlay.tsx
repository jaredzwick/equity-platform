"use client";

import { useEffect, useRef, useState } from "react";
import {
  destinationUrl,
  shareUrl,
  type ShareableDeal,
  type ShareChannel,
} from "@/lib/share";
import { useToast } from "@/lib/useToast";

// ShareOverlay — modal of 5 share destinations for one deal. Opens from
// ShareButton; owns no visible button of its own. Dismissed via ESC,
// backdrop click, close-button, or any destination click (except Copy
// link under clipboard-failure, which keeps the overlay open with a
// readOnly URL input so iOS webview users can select the URL manually).
//
// The 5 destinations are kept in an array literal below so the keyboard
// tab order mirrors the visual order 1→5. Icons are inline SVG — the
// landing app doesn't ship lucide-react, and inlining keeps the overlay
// small enough that lazy-loading it isn't worth the bundler complexity.

type Props = {
  deal: ShareableDeal;
  onClose: () => void;
  /** Element to restore focus to when the overlay closes. */
  returnFocusTo: HTMLElement | null;
};

type Destination = {
  key: Exclude<ShareChannel, "copy">;
  label: string;
  Icon: React.FC<{ className?: string }>;
  colorClass: string;
};

const DESTINATIONS: Destination[] = [
  { key: "twitter", label: "X (Twitter)", Icon: IconX, colorClass: "text-white" },
  { key: "linkedin", label: "LinkedIn", Icon: IconLinkedIn, colorClass: "text-sky-500" },
  { key: "whatsapp", label: "WhatsApp", Icon: IconWhatsApp, colorClass: "text-emerald-500" },
  { key: "email", label: "Email", Icon: IconEmail, colorClass: "text-yellow-300" },
];

export function ShareOverlay({ deal, onClose, returnFocusTo }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyUrl = shareUrl(deal, "copy");
  const toast = useToast();

  // ESC + click-outside + initial focus + focus restore.
  useEffect(() => {
    firstFocusableRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restore focus on unmount. If the user tabbed OUT of the overlay
      // (unlikely but possible without a true focus-trap) their explicit
      // focus wins over our restore.
      if (returnFocusTo && document.activeElement === document.body) {
        returnFocusTo.focus();
      } else if (returnFocusTo) {
        returnFocusTo.focus();
      }
    };
  }, [onClose, returnFocusTo]);

  function openDestination(channel: Destination["key"]) {
    const url = destinationUrl(deal, channel);
    // Email uses mailto: — window.open is unreliable (some browsers block
    // popups for mailto); set location.href instead.
    if (channel === "email") {
      window.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    onClose();
  }

  async function onCopy() {
    try {
      // iOS Safari in-app webviews (LinkedIn, Instagram, Facebook) can throw
      // or reject here. The failure path renders a readOnly URL input so the
      // user can select-and-copy manually — users with no clipboard permission
      // would otherwise hit a dead end with no visible URL to copy.
      await navigator.clipboard.writeText(copyUrl);
      toast.show({ text: "Link copied", kind: "success" });
      onClose();
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in"
      onClick={(e) => {
        // Only backdrop clicks dismiss — clicks inside the dialog shouldn't.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-overlay-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-black/90 p-6 shadow-2xl motion-safe:animate-in motion-safe:zoom-in-95"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="share-overlay-title" className="text-base font-semibold text-white">
            Share this deal
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <ul className="space-y-2">
          {DESTINATIONS.map((d, i) => {
            const Icon = d.Icon;
            return (
              <li key={d.key}>
                <button
                  type="button"
                  ref={i === 0 ? firstFocusableRef : null}
                  onClick={() => openDestination(d.key)}
                  aria-label={`Share on ${d.label}`}
                  className="group flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/90 transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <Icon className={`h-5 w-5 ${d.colorClass}`} />
                  <span>{d.label}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={onCopy}
              aria-label="Copy link to clipboard"
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/90 transition hover:border-white/25 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <IconLink className="h-5 w-5 text-white/70" />
              <span>Copy link</span>
            </button>
          </li>
        </ul>

        {copyFailed && (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.08] p-3">
            <div
              role="status"
              aria-live="polite"
              className="mb-2 text-xs text-amber-200/90"
            >
              Automatic copy blocked by your browser. Select the URL below and copy manually.
            </div>
            <input
              readOnly
              value={copyUrl}
              aria-label="Deal URL"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-md border border-white/15 bg-black/50 px-3 py-2 text-xs text-white/90 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconLinkedIn({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IconEmail({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function IconLink({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71" />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
