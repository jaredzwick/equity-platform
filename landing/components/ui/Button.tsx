import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

// Button — single source of truth for the LamboApp CTA look. Grew out
// of the sprint 2 audit finding that button radii (rounded-full,
// rounded-lg, rounded-2xl) and gradient shadows were drifting across
// 15+ call sites. Any new CTA on the landing app should reach for this;
// existing call sites migrate opportunistically.
//
// Variants:
//   - primary: yellow → red gradient on black text. Use for the ONE
//     "do the thing" moment per section (Save this deal, Get playbook).
//   - secondary: white/10 outline over glass background. Companion to
//     a primary — "browse more deals", "how it works".
//   - ghost: transparent, low-contrast underlined text. For inline
//     tertiary asks that shouldn't compete with the primary.
//   - danger: red gradient, reserved for destructive confirms.
//
// Sizes: sm (compact chips), md (inline row CTAs), lg (hero + section
// CTAs). Full-width via `fullWidth`.
//
// Polymorphism: pass `href` (string) and the button renders a next/link
// anchor with the same styling. `external` prop renders a bare <a> with
// target=_blank, rel=noopener.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
  children: ReactNode;
};

type ButtonElementProps = CommonProps &
  Omit<ComponentPropsWithoutRef<"button">, keyof CommonProps> & {
    href?: undefined;
    external?: undefined;
  };

type LinkElementProps = CommonProps &
  Omit<ComponentPropsWithoutRef<"a">, keyof CommonProps | "href"> & {
    href: string;
    external?: boolean;
  };

export type ButtonProps = ButtonElementProps | LinkElementProps;

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-black shadow-lg shadow-orange-500/40 hover:shadow-orange-500/70 uppercase tracking-wide",
  secondary:
    "border border-white/15 bg-white/[0.03] text-white backdrop-blur hover:bg-white/[0.08]",
  ghost:
    "text-white/70 underline underline-offset-4 hover:text-yellow-200",
  danger:
    "bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white shadow-lg shadow-red-500/40 hover:shadow-red-500/70 uppercase tracking-wide",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm md:px-8 md:py-4 md:text-base",
};

function classesFor(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
  extra: string,
): string {
  const width = fullWidth ? "w-full" : "";
  return [BASE, VARIANT[variant], SIZE[size], width, extra]
    .filter(Boolean)
    .join(" ");
}

function Contents({
  leadingIcon,
  trailingIcon,
  loading,
  children,
}: {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <>
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black"
          aria-hidden
        />
        <span>{children}</span>
      </>
    );
  }
  return (
    <>
      {leadingIcon && <span aria-hidden>{leadingIcon}</span>}
      <span>{children}</span>
      {trailingIcon && <span aria-hidden>{trailingIcon}</span>}
    </>
  );
}

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    fullWidth = false,
    loading = false,
    leadingIcon,
    trailingIcon,
    className = "",
    children,
    ...rest
  } = props;

  const cls = classesFor(variant, size, fullWidth, className);

  if ("href" in rest && typeof rest.href === "string") {
    const { href, external, ...anchor } = rest;
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
          {...anchor}
        >
          <Contents
            leadingIcon={leadingIcon}
            trailingIcon={trailingIcon}
            loading={loading}
          >
            {children}
          </Contents>
        </a>
      );
    }
    return (
      <Link href={href} className={cls} {...anchor}>
        <Contents
          leadingIcon={leadingIcon}
          trailingIcon={trailingIcon}
          loading={loading}
        >
          {children}
        </Contents>
      </Link>
    );
  }

  const buttonRest = rest as ComponentPropsWithoutRef<"button">;
  return (
    <button
      {...buttonRest}
      className={cls}
      aria-busy={loading || undefined}
      disabled={loading || buttonRest.disabled}
    >
      <Contents
        leadingIcon={leadingIcon}
        trailingIcon={trailingIcon}
        loading={loading}
      >
        {children}
      </Contents>
    </button>
  );
}
