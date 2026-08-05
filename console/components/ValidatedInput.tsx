"use client";

import { useState } from "react";

// Client-side input validators. Failing gracefully — server always re-validates.
export const validators = {
  kebab: {
    pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
    message: "lowercase letters, digits, and dashes only; can't start or end with a dash",
    example: "cleanup-old-jobs",
  },
  namespace: {
    // RFC 1123 label subset: same as kebab but also enforced by k8s.
    pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
    message: "must be a valid Kubernetes namespace name",
    example: "acme-prod",
  },
  slug: {
    pattern: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
    message: "lowercase kebab-case; used in URLs",
    example: "myshop",
  },
  displayName: {
    // Human-facing; allow spaces + basic punctuation.
    pattern: /^[A-Za-z0-9][A-Za-z0-9 _.'-]{0,63}$/,
    message: "1-64 chars, letters/numbers/spaces/basic punctuation",
    example: "My Shop",
  },
  chartRepoUrl: {
    pattern: /^https:\/\/[^\s]+$/,
    message: "must be an https:// URL",
    example: "https://charts.bitnami.com/bitnami",
  },
  chartVersion: {
    // SemVer-ish — allow x.y.z with optional -prerelease.
    pattern: /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/,
    message: "pinned semver (no ^ or ~); avoid tags like latest",
    example: "20.1.0",
  },
  image: {
    // registry/image:tag — accept everything except empty tag or :latest
    pattern: /^[\w./-]+(:[\w.-]+)?$/,
    message: "must be a valid image reference (avoid :latest in prod)",
    example: "busybox:1.36",
  },
  cronSchedule: {
    // Cron: 5 or 6 fields, OR @keyword. Loose check.
    pattern: /^(@(hourly|daily|weekly|monthly|yearly|annually|reboot)|(\S+\s+){4}\S+(\s+\S+)?)$/,
    message: "5-field cron expression or @keyword (@hourly, @daily, …)",
    example: "*/5 * * * *",
  },
} as const;

export type ValidatorKey = keyof typeof validators;

type Props = {
  name: string;
  label: string;
  validator?: ValidatorKey;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  type?: "input" | "textarea";
  rows?: number;
  className?: string;
  disabled?: boolean;
  // Progressive-disclosure help (v1 of the add-app UX pass):
  //   tooltip  — short definition on hover of a "?" badge next to the label
  //   help     — richer explanation revealed by a native <details> under the field
  //   docsHref — appended as "Learn more →" inside the help block when set
  tooltip?: string;
  help?: React.ReactNode;
  docsHref?: string;
};

// Client-side validated input. Shows an inline error when the value doesn't
// match the validator pattern. Server always re-validates — this is UX polish
// on top of a real check, never the security boundary.
export default function ValidatedInput({
  name,
  label,
  validator,
  required,
  defaultValue = "",
  placeholder,
  hint,
  maxLength,
  type = "input",
  rows = 4,
  className = "",
  disabled,
  tooltip,
  help,
  docsHref,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [touched, setTouched] = useState(false);

  const rule = validator ? validators[validator] : null;
  const isEmpty = value.trim().length === 0;
  const passes = !rule || isEmpty || rule.pattern.test(value);
  const showError = touched && !isEmpty && !passes;
  const showEmptyError = touched && required && isEmpty;

  const inputProps = {
    name,
    required,
    disabled,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(e.target.value),
    onBlur: () => setTouched(true),
    placeholder: placeholder ?? rule?.example,
    pattern: rule?.pattern.source,
    maxLength,
    className: `input ${className} ${showError || showEmptyError ? "border-red-600" : ""}`,
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-[color:var(--color-fg)] inline-flex items-center gap-1.5">
        {label}
        {required && <span className="text-red-400">*</span>}
        {tooltip && (
          <span
            className="help-badge"
            title={tooltip}
            aria-label={tooltip}
            role="img"
          >
            ?
          </span>
        )}
      </span>

      {type === "textarea" ? (
        <textarea rows={rows} {...inputProps} />
      ) : (
        <input {...inputProps} />
      )}

      {showError && rule && (
        <span className="text-[11px] text-red-400">
          {rule.message}. Example: <code className="text-red-300">{rule.example}</code>
        </span>
      )}
      {showEmptyError && (
        <span className="text-[11px] text-red-400">Required.</span>
      )}
      {!showError && !showEmptyError && hint && (
        <span className="text-[11px] text-[color:var(--color-muted)]">{hint}</span>
      )}

      {(help || docsHref) && (
        <details className="help-panel">
          <summary>What is this?</summary>
          <div className="help-body">
            {help}
            {docsHref && (
              <div className="help-docs">
                <a href={docsHref} target="_blank" rel="noreferrer">
                  Full docs →
                </a>
              </div>
            )}
          </div>
        </details>
      )}

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          color: var(--color-fg);
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: rgba(16, 185, 129, 0.6);
        }
        .input.border-red-600 {
          border-color: rgb(220, 38, 38);
        }
        .input.font-mono {
          font-family: ui-monospace, SFMono-Regular, monospace;
        }
        .input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .help-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          border: 1px solid var(--color-border);
          background: rgba(255,255,255,0.04);
          font-size: 10px;
          font-weight: 600;
          color: var(--color-muted);
          cursor: help;
        }
        .help-badge:hover {
          color: var(--color-fg);
          border-color: var(--color-fg);
        }
        .help-panel {
          margin-top: 0.25rem;
          font-size: 11px;
        }
        .help-panel summary {
          color: var(--color-muted);
          cursor: pointer;
          list-style: none;
          user-select: none;
          padding: 0.125rem 0;
        }
        .help-panel summary::before {
          content: "▸ ";
          display: inline-block;
          transition: transform 0.15s ease;
        }
        .help-panel[open] summary::before {
          transform: rotate(90deg);
        }
        .help-panel summary:hover {
          color: var(--color-fg);
        }
        .help-body {
          margin-top: 0.5rem;
          padding: 0.625rem 0.75rem;
          background: rgba(255,255,255,0.02);
          border-left: 2px solid var(--color-border);
          color: var(--color-muted);
          line-height: 1.5;
        }
        .help-docs {
          margin-top: 0.5rem;
        }
        .help-docs a {
          color: rgb(52, 211, 153);
          text-decoration: none;
          font-weight: 500;
        }
        .help-docs a:hover {
          text-decoration: underline;
        }
      `}</style>
    </label>
  );
}
