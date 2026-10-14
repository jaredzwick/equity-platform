// Client-safe schema + types for daily business metrics. No server-only
// imports — this file gets bundled into the metrics client component.
//
// The server-only counterpart (lib/metrics.ts) has load / save + YAML
// round-trip, and reuses the local-state + github helpers already wired
// for the business profile.
//
// Data model — one YAML file per business at businesses/<slug>.metrics.yaml,
// keyed by ISO date. Each entry is a flat bag of numbers. Derived KPIs
// (CPL, CAC, show rate, close rate, ROAS) are computed at render time.

export type MetricKind = "money" | "count";

export type MetricField = {
  key: string;
  label: string;
  hint?: string;
  kind: MetricKind;
  group: "marketing" | "sales";
};

// The direct-entry surface. Kept tight — 8 numbers a solo operator can
// realistically fill in daily. Anything more elaborate belongs in a
// materialized integration pull, not the hand-entry form.
export const METRIC_FIELDS: MetricField[] = [
  { key: "ad_spend", label: "Ad spend", kind: "money", group: "marketing", hint: "Meta + Google + other, combined." },
  { key: "impressions", label: "Impressions", kind: "count", group: "marketing" },
  { key: "clicks", label: "Clicks", kind: "count", group: "marketing" },
  { key: "leads", label: "Leads", kind: "count", group: "marketing", hint: "New email / phone captures." },
  { key: "calls_booked", label: "Calls booked", kind: "count", group: "sales", hint: "Appointments set." },
  { key: "calls_taken", label: "Calls taken", kind: "count", group: "sales", hint: "Appointments held (shows)." },
  { key: "deals_closed", label: "Deals closed", kind: "count", group: "sales" },
  { key: "revenue", label: "Revenue", kind: "money", group: "sales", hint: "Cash collected today." },
];

export type MetricEntry = Partial<Record<(typeof METRIC_FIELDS)[number]["key"], number>>;

// Full document written to businesses/<slug>.metrics.yaml.
export type MetricsDoc = {
  entries: Record<string, MetricEntry>; // ISO date "YYYY-MM-DD" → entry
};

// ─── Aggregation ──────────────────────────────────────────────────────────

export type Totals = MetricEntry;

export function emptyEntry(): MetricEntry {
  return {};
}

export function sumEntries(entries: MetricEntry[]): Totals {
  const out: Totals = {};
  for (const e of entries) {
    for (const f of METRIC_FIELDS) {
      const v = e[f.key];
      if (typeof v === "number" && Number.isFinite(v)) {
        out[f.key] = (out[f.key] ?? 0) + v;
      }
    }
  }
  return out;
}

// ─── Derived KPIs ────────────────────────────────────────────────────────
// Rendered as read-only tiles. Undefined when the denominator is 0 — the UI
// shows "—" rather than Infinity / NaN.

export type DerivedKind = "money" | "ratio" | "percent";

export type DerivedKpi = {
  key: string;
  label: string;
  kind: DerivedKind;
  hint: string;
  compute: (t: Totals) => number | undefined;
};

function safeDiv(num: number | undefined, den: number | undefined): number | undefined {
  if (num == null || den == null || den === 0) return undefined;
  return num / den;
}

export const DERIVED_KPIS: DerivedKpi[] = [
  {
    key: "cpl",
    label: "Cost per lead",
    kind: "money",
    hint: "ad_spend ÷ leads",
    compute: (t) => safeDiv(t.ad_spend, t.leads),
  },
  {
    key: "cost_per_booked",
    label: "Cost per booked call",
    kind: "money",
    hint: "ad_spend ÷ calls_booked",
    compute: (t) => safeDiv(t.ad_spend, t.calls_booked),
  },
  {
    key: "cac",
    label: "CAC",
    kind: "money",
    hint: "ad_spend ÷ deals_closed",
    compute: (t) => safeDiv(t.ad_spend, t.deals_closed),
  },
  {
    key: "show_rate",
    label: "Show rate",
    kind: "percent",
    hint: "calls_taken ÷ calls_booked",
    compute: (t) => safeDiv(t.calls_taken, t.calls_booked),
  },
  {
    key: "close_rate",
    label: "Close rate",
    kind: "percent",
    hint: "deals_closed ÷ calls_taken",
    compute: (t) => safeDiv(t.deals_closed, t.calls_taken),
  },
  {
    key: "roas",
    label: "ROAS",
    kind: "ratio",
    hint: "revenue ÷ ad_spend",
    compute: (t) => safeDiv(t.revenue, t.ad_spend),
  },
];

// ─── Formatting ──────────────────────────────────────────────────────────

export function formatMetric(kind: MetricKind, value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (kind === "money") {
    return "$" + Math.round(value).toLocaleString();
  }
  return Math.round(value).toLocaleString();
}

export function formatDerived(kind: DerivedKind, value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (kind === "money") return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (kind === "percent") return (value * 100).toFixed(1) + "%";
  return value.toFixed(2) + "×";
}

// Percent-change badge for period-over-period deltas. Returns undefined if
// the prior period had no signal so the UI can render "new" instead of a
// misleading +∞%.
export function pctChange(current: number | undefined, prior: number | undefined): number | undefined {
  if (current == null || prior == null || prior === 0) return undefined;
  return (current - prior) / prior;
}

// ─── Date helpers ────────────────────────────────────────────────────────

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Sorted descending (newest first). Used by the recent-entries table.
export function sortedEntryDates(doc: MetricsDoc): string[] {
  return Object.keys(doc.entries).sort().reverse();
}

// Sum entries falling in the last N days (inclusive of today). Used by the
// KPI cards. `now` is injectable for tests.
export function sumLastNDays(
  doc: MetricsDoc,
  n: number,
  now: Date = new Date(),
): { current: Totals; prior: Totals } {
  const currentCutoff = new Date(now);
  currentCutoff.setUTCDate(currentCutoff.getUTCDate() - n + 1);
  const currentCutoffIso = currentCutoff.toISOString().slice(0, 10);
  const priorCutoff = new Date(now);
  priorCutoff.setUTCDate(priorCutoff.getUTCDate() - 2 * n + 1);
  const priorCutoffIso = priorCutoff.toISOString().slice(0, 10);
  const nowIso = now.toISOString().slice(0, 10);

  const current: MetricEntry[] = [];
  const prior: MetricEntry[] = [];
  for (const [date, entry] of Object.entries(doc.entries)) {
    if (date > nowIso) continue;
    if (date >= currentCutoffIso) current.push(entry);
    else if (date >= priorCutoffIso) prior.push(entry);
  }
  return { current: sumEntries(current), prior: sumEntries(prior) };
}
