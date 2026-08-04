"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PROFILE_SCHEMA,
  type BusinessProfile,
  type Field,
} from "@/lib/business-profile-schema";
import { saveProfileFromForm } from "./actions";

type Props = {
  tenantSlug: string;
  initialProfile: BusinessProfile;
  hasExisting: boolean;
  configured: boolean;
};

function readAtPath(obj: BusinessProfile, path: string): string {
  const v = path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
  if (v == null) return "";
  return String(v);
}

export default function ProfileEditor({ tenantSlug, initialProfile, hasExisting, configured }: Props) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={saveProfileFromForm}
      onSubmit={() => setSubmitting(true)}
      className="space-y-6"
    >
      <input type="hidden" name="__tenant" value={tenantSlug} />

      {PROFILE_SCHEMA.map((section) => (
        <fieldset
          key={section.key}
          id={`section-${section.key}`}
          className="border border-[color:var(--color-border)] rounded-lg p-5"
        >
          <legend className="px-2 -ml-2">
            <h2 className="text-lg font-semibold">{section.title}</h2>
          </legend>
          {section.description && (
            <p className="text-xs text-[color:var(--color-muted)] mt-0.5 mb-4">{section.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            {section.fields.map((field) => (
              <FieldInput
                key={field.path}
                field={field}
                defaultValue={readAtPath(initialProfile, field.path)}
                tenantSlug={tenantSlug}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center gap-3 sticky bottom-0 py-4 bg-[color:var(--color-bg)] border-t border-[color:var(--color-border)]">
        <button
          type="submit"
          disabled={submitting || !configured}
          title={!configured ? "Set GITHUB_TOKEN + GITHUB_REPO in console/.env.local to enable saving" : undefined}
          className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed font-medium text-sm"
        >
          {submitting ? "Saving…" : hasExisting ? "Save changes" : "Create profile"}
        </button>
        {hasExisting && (
          <Link
            href={`/${tenantSlug}/profile`}
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          >
            Cancel
          </Link>
        )}
        <span className="text-xs text-[color:var(--color-muted)] ml-auto">
          1 commit → <code>businesses/{tenantSlug}.yaml</code>
        </span>
      </div>
    </form>
  );
}

function FieldInput({ field, defaultValue, tenantSlug }: { field: Field; defaultValue: string; tenantSlug: string }) {
  const commonProps = {
    name: field.path,
    id: `field-${field.path}`,
    defaultValue,
    placeholder: field.placeholder,
    required: field.required,
    className: "input",
  };

  let control: React.ReactNode;
  if (field.kind === "textarea") {
    control = <textarea rows={3} {...commonProps} />;
  } else if (field.kind === "select" && field.options) {
    control = (
      <select {...commonProps}>
        {!field.required && <option value="">—</option>}
        {field.options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === "color") {
    control = (
      <div className="flex items-center gap-2">
        <input type="color" {...commonProps} className="input h-9 w-16 p-1" />
        <input
          type="text"
          name={field.path + "__hex"}
          defaultValue={defaultValue}
          placeholder="#10b981"
          className="input flex-1 font-mono text-xs"
          aria-label={`${field.label} hex value`}
        />
      </div>
    );
  } else if (field.kind === "url") {
    control = <input type="url" {...commonProps} />;
  } else if (field.kind === "email") {
    control = <input type="email" {...commonProps} />;
  } else if (field.kind === "number") {
    control = <input type="number" {...commonProps} />;
  } else if (field.kind === "money") {
    control = <input type="text" inputMode="numeric" {...commonProps} />;
  } else {
    control = <input type="text" {...commonProps} />;
  }

  const wideKinds: Field["kind"][] = ["textarea"];
  const isWide = wideKinds.includes(field.kind);

  return (
    <label className={`flex flex-col gap-1 ${isWide ? "col-span-2" : ""}`}>
      <span className="text-sm font-medium text-[color:var(--color-fg)] flex items-center justify-between gap-2">
        <span>
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </span>
        {field.path === "brand.logo_url" && (
          <Link
            href={`/${tenantSlug}/logo`}
            className="text-xs text-emerald-400 hover:underline font-normal"
          >
            Generate with AI ✨
          </Link>
        )}
      </span>
      {control}
      {field.hint && <span className="text-[11px] text-[color:var(--color-muted)]">{field.hint}</span>}
      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          color: var(--color-fg);
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: rgba(16, 185, 129, 0.6);
        }
      `}</style>
    </label>
  );
}
