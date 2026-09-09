"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const LeadModal = dynamic(() => import("./LeadModal"), { ssr: false });

type Variant = "primary" | "secondary" | "compact";

type Props = {
  label?: string;
  variant?: Variant;
  className?: string;
};

export default function CTAButton({
  label = "Send Me the Free Playbook →",
  variant = "primary",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`join-cta-${variant}`}
        className={cx(variant, className)}
      >
        {label}
      </button>
      <LeadModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function cx(variant: Variant, extra: string): string {
  const base =
    "inline-flex items-center justify-center font-bold uppercase tracking-wide transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400/60 focus:ring-offset-2 focus:ring-offset-black";
  const gradient =
    "bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-black shadow-lg shadow-orange-500/40 hover:shadow-orange-500/70 hover:-translate-y-0.5";
  const primary = `w-full rounded-lg px-8 py-4 text-base sm:text-lg ${gradient}`;
  const secondary = `rounded-lg px-8 py-4 text-base ${gradient}`;
  const compact = `rounded-lg px-6 py-3 text-sm ${gradient}`;
  const size =
    variant === "primary"
      ? primary
      : variant === "secondary"
        ? secondary
        : compact;
  return `${base} ${size} ${extra}`;
}
