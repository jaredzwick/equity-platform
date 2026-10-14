"use client";

import { useMemo, useState } from "react";
import {
  METRIC_FIELDS,
  DERIVED_KPIS,
  formatMetric,
  formatDerived,
  pctChange,
  sortedEntryDates,
  sumLastNDays,
  todayIso,
  type MetricEntry,
  type MetricsDoc,
  type Totals,
} from "@/lib/metrics-schema";
import { saveEntryFromForm } from "./actions";

type Props = { tenantSlug: string; doc: MetricsDoc };

type WindowChoice = 7 | 30 | 90;

export default function MetricsClient({ tenantSlug, doc }: Props) {
  const [window, setWindow] = useState<WindowChoice>(7);
  const [entryDate, setEntryDate] = useState(todayIso());

  const { current, prior } = useMemo(() => sumLastNDays(doc, window), [doc, window]);
  const dates = useMemo(() => sortedEntryDates(doc), [doc]);
  const initialEntry: MetricEntry = doc.entries[entryDate] ?? {};

  return (
    <>
      <WindowPicker value={window} onChange={setWindow} />
      <KpiCards current={current} prior={prior} window={window} />
      <DerivedCards current={current} />
      <EntryForm
        tenantSlug={tenantSlug}
        date={entryDate}
        onDateChange={setEntryDate}
        initial={initialEntry}
      />
      <EntriesTable doc={doc} dates={dates.slice(0, 30)} />
    </>
  );
}

// ─── Window picker ────────────────────────────────────────────────────────

function WindowPicker({ value, onChange }: { value: WindowChoice; onChange: (v: WindowChoice) => void }) {
  const options: WindowChoice[] = [7, 30, 90];
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="text-xs text-[color:var(--color-muted)] uppercase tracking-wider">Window</span>
      <div className="inline-flex rounded-lg border border-[color:var(--color-border)] overflow-hidden">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={
              "px-3 py-1.5 text-xs " +
              (o === value
                ? "bg-white/10 text-[color:var(--color-fg)]"
                : "text-[color:var(--color-muted)] hover:bg-white/5")
            }
          >
            Last {o}d
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── KPI cards (direct-entry totals) ─────────────────────────────────────

function KpiCards({ current, prior, window }: { current: Totals; prior: Totals; window: number }) {
  return (
    <section className="mb-6">
      <SectionHeader label="Totals" hint={`Sum of the last ${window} days · vs prior ${window}d`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {METRIC_FIELDS.map((f) => {
          const c = current[f.key];
          const p = prior[f.key];
          const delta = pctChange(c, p);
          return (
            <div key={f.key} className="border border-[color:var(--color-border)] rounded-lg p-3 bg-white/[0.02]">
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                {f.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {formatMetric(f.kind, c)}
              </div>
              <DeltaBadge delta={delta} priorEmpty={p == null || p === 0} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Derived KPI tiles (rates + ratios) ──────────────────────────────────

function DerivedCards({ current }: { current: Totals }) {
  return (
    <section className="mb-8">
      <SectionHeader label="Rates" hint="Derived from the totals above" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {DERIVED_KPIS.map((k) => {
          const v = k.compute(current);
          return (
            <div key={k.key} className="border border-[color:var(--color-border)] rounded-lg p-3 bg-white/[0.02]">
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                {k.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {formatDerived(k.kind, v)}
              </div>
              <div className="mt-1 text-[10px] text-[color:var(--color-muted)] font-mono">
                {k.hint}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Delta badge ──────────────────────────────────────────────────────────

function DeltaBadge({ delta, priorEmpty }: { delta: number | undefined; priorEmpty: boolean }) {
  if (priorEmpty) {
    return <div className="mt-1 text-[10px] text-[color:var(--color-muted)]">no prior data</div>;
  }
  if (delta == null) return <div className="mt-1 text-[10px] text-[color:var(--color-muted)]">—</div>;
  const positive = delta >= 0;
  const color = positive ? "text-emerald-400" : "text-red-400";
  const sign = positive ? "+" : "";
  return (
    <div className={`mt-1 text-[10px] font-mono ${color}`}>
      {sign}
      {(delta * 100).toFixed(1)}% vs prior
    </div>
  );
}

// ─── Entry form ──────────────────────────────────────────────────────────

function EntryForm({
  tenantSlug,
  date,
  onDateChange,
  initial,
}: {
  tenantSlug: string;
  date: string;
  onDateChange: (v: string) => void;
  initial: MetricEntry;
}) {
  const [submitting, setSubmitting] = useState(false);
  const hasExisting = Object.keys(initial).length > 0;

  return (
    <section className="mb-8">
      <SectionHeader
        label="Log a day"
        hint={hasExisting ? "Editing existing entry — save overwrites it" : "New entry"}
      />
      <form
        action={saveEntryFromForm}
        onSubmit={() => setSubmitting(true)}
        className="border border-[color:var(--color-border)] rounded-lg p-4 bg-white/[0.02]"
      >
        <input type="hidden" name="__tenant" value={tenantSlug} />

        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs text-[color:var(--color-muted)] uppercase tracking-wider">Date</label>
          <input
            type="date"
            name="__date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="input w-40"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {METRIC_FIELDS.map((f) => {
            const v = initial[f.key];
            return (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-xs text-[color:var(--color-muted)]">
                  {f.label}
                  {f.kind === "money" && <span className="ml-1 opacity-60">($)</span>}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  name={f.key}
                  defaultValue={v ?? ""}
                  placeholder="0"
                  className="input"
                />
                {f.hint && (
                  <span className="text-[10px] text-[color:var(--color-muted)]">{f.hint}</span>
                )}
              </label>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 font-medium text-sm"
          >
            {submitting ? "Saving…" : hasExisting ? "Update entry" : "Save entry"}
          </button>
          <span className="text-xs text-[color:var(--color-muted)]">
            Blank fields are omitted. Clear every field to delete the day.
          </span>
        </div>

        <style jsx>{`
          .input {
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
      </form>
    </section>
  );
}

// ─── Recent entries table ────────────────────────────────────────────────

function EntriesTable({ doc, dates }: { doc: MetricsDoc; dates: string[] }) {
  if (dates.length === 0) {
    return (
      <section>
        <SectionHeader label="Recent entries" hint="Nothing logged yet" />
        <div className="border border-dashed border-[color:var(--color-border)] rounded-lg p-8 text-center text-sm text-[color:var(--color-muted)]">
          Log your first day above. Watch the totals + rates fill in as the week accumulates.
        </div>
      </section>
    );
  }
  return (
    <section>
      <SectionHeader label="Recent entries" hint={`${dates.length} day${dates.length === 1 ? "" : "s"}`} />
      <div className="overflow-x-auto border border-[color:var(--color-border)] rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
            <tr>
              <th className="text-left px-3 py-2 font-normal">Date</th>
              {METRIC_FIELDS.map((f) => (
                <th key={f.key} className="text-right px-3 py-2 font-normal">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map((date) => {
              const e = doc.entries[date];
              return (
                <tr key={date} className="border-t border-[color:var(--color-border)] hover:bg-white/[0.02]">
                  <td className="px-3 py-2 font-mono text-xs">{date}</td>
                  {METRIC_FIELDS.map((f) => (
                    <td key={f.key} className="text-right px-3 py-2 tabular-nums">
                      {formatMetric(f.kind, e[f.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Section header ──────────────────────────────────────────────────────

function SectionHeader({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
        {label}
      </h2>
      {hint && <span className="text-[10px] text-[color:var(--color-muted)]">{hint}</span>}
    </div>
  );
}
