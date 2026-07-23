"use client";

import { useState } from "react";
import {
  AGENCY_SCHEMA,
  type AgencyConfig,
  type Field,
} from "@/lib/agency-schema";
import { saveAgencyFromForm } from "./actions";

type Props = {
  initialConfig: AgencyConfig;
  hasExisting: boolean;
  configured: boolean;
};

function readAtPath(obj: AgencyConfig, path: string): string {
  const v = path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
  if (v == null) return "";
  return String(v);
}

export default function AgencyEditor({ initialConfig, hasExisting, configured }: Props) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <form
      action={saveAgencyFromForm}
      onSubmit={() => setSubmitting(true)}
      className="space-y-6"
    >
      {AGENCY_SCHEMA.map((section) => (
        <fieldset
          key={section.key}
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
                defaultValue={readAtPath(initialConfig, field.path)}
              />
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center gap-3 sticky bottom-0 py-4 bg-[color:var(--color-bg)] border-t border-[color:var(--color-border)]">
        <button
          type="submit"
          disabled={submitting || !configured}
          title={!configured ? "Sign in with GitHub to enable saving" : undefined}
          className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed font-medium text-sm"
        >
          {submitting ? "Saving…" : hasExisting ? "Save changes" : "Create agency.yaml"}
        </button>
        <span className="text-xs text-[color:var(--color-muted)] ml-auto">
          1 commit → <code>agency.yaml</code>
        </span>
      </div>
    </form>
  );
}

function FieldInput({ field, defaultValue }: { field: Field; defaultValue: string }) {
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
  } else {
    control = <input type="text" {...commonProps} />;
  }

  const isWide = field.kind === "textarea";

  return (
    <label className={`flex flex-col gap-1 ${isWide ? "col-span-2" : ""}`}>
      <span className="text-sm font-medium text-[color:var(--color-fg)]">
        {field.label}
        {field.required && <span className="text-red-400 ml-1">*</span>}
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
