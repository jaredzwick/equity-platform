// SERVER-ONLY. Load / save the per-tenant metrics document. Mirrors the
// business-profile pattern: local file is primary, git is opt-in async
// backup. A busted GitHub session never blocks a metrics save.

import "server-only";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import { getFile, getFileSha, putFile, isConfigured } from "@/lib/github";
import { readStateFile, writeStateFile } from "@/lib/local-state";
import {
  METRIC_FIELDS,
  type MetricsDoc,
  type MetricEntry,
} from "@/lib/metrics-schema";

export {
  METRIC_FIELDS,
  DERIVED_KPIS,
  formatMetric,
  formatDerived,
  pctChange,
  sumEntries,
  sumLastNDays,
  sortedEntryDates,
  todayIso,
  isoDaysAgo,
  type MetricEntry,
  type MetricsDoc,
  type Totals,
} from "@/lib/metrics-schema";

export function metricsPath(slug: string): string {
  return `businesses/${slug}.metrics.yaml`;
}

function localMetricsPath(slug: string): string {
  return `metrics/${slug}.yaml`;
}

// ─── Validation ──────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Strip anything that isn't a known metric key + finite number. Silent —
// we treat the YAML as user-authored config and just discard noise rather
// than blowing up a page render.
function sanitizeEntry(raw: unknown): MetricEntry {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: MetricEntry = {};
  const knownKeys = new Set(METRIC_FIELDS.map((f) => f.key));
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!knownKeys.has(k)) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    (out as Record<string, number>)[k] = v;
  }
  return out;
}

function sanitizeDoc(raw: unknown): MetricsDoc {
  const out: MetricsDoc = { entries: {} };
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return out;
  const entries = (raw as Record<string, unknown>).entries;
  if (entries == null || typeof entries !== "object" || Array.isArray(entries)) return out;
  for (const [date, entry] of Object.entries(entries as Record<string, unknown>)) {
    if (!ISO_DATE.test(date)) continue;
    const clean = sanitizeEntry(entry);
    if (Object.keys(clean).length === 0) continue;
    out.entries[date] = clean;
  }
  return out;
}

// ─── YAML round-trip ──────────────────────────────────────────────────────

export function serializeDoc(doc: MetricsDoc): string {
  const header =
    "# Daily business metrics for this tenant.\n" +
    "# Edited via console/[tenant]/metrics OR by hand + commit.\n" +
    "# Schema: console/lib/metrics-schema.ts\n\n";
  // Sort dates ascending in the on-disk file so diffs are stable regardless
  // of which entry was last edited.
  const sorted: MetricsDoc = { entries: {} };
  for (const date of Object.keys(doc.entries).sort()) {
    sorted.entries[date] = doc.entries[date];
  }
  return header + yamlDump(sorted, { sortKeys: false, lineWidth: 100, noRefs: true });
}

export function parseDoc(text: string): MetricsDoc {
  return sanitizeDoc(yamlLoad(text));
}

// ─── Persistence ──────────────────────────────────────────────────────────

export type SaveResult = {
  saved: true;
  gitCommitSha: string | null;
  gitError: string | null;
};

export async function loadMetrics(slug: string): Promise<MetricsDoc> {
  // Local file wins. Fall back to git for operators who saved via git
  // before local-state landed. Empty doc if neither exists — the UI treats
  // "no entries" as first-run and shows an inviting empty state.
  const local = await readStateFile(localMetricsPath(slug));
  if (local != null) return parseDoc(local);
  if (await isConfigured()) {
    try {
      const file = await getFile(metricsPath(slug));
      if (file) return parseDoc(file.content);
    } catch {
      // fall through
    }
  }
  return { entries: {} };
}

export async function saveMetrics(slug: string, doc: MetricsDoc): Promise<SaveResult> {
  const serialized = serializeDoc(doc);
  await writeStateFile(localMetricsPath(slug), serialized);

  let gitCommitSha: string | null = null;
  let gitError: string | null = null;
  if (await isConfigured()) {
    try {
      const path = metricsPath(slug);
      const existingSha = await getFileSha(path);
      const commit = await putFile({
        path,
        content: serialized,
        message: existingSha
          ? `chore(${slug}): update metrics`
          : `feat(${slug}): initialize metrics`,
        sha: existingSha ?? undefined,
      });
      gitCommitSha = commit.commitSha;
    } catch (e) {
      gitError = e instanceof Error ? e.message : String(e);
    }
  }
  return { saved: true, gitCommitSha, gitError };
}

// Convenience: upsert a single day's entry without the caller having to
// juggle the whole doc.
export async function upsertEntry(
  slug: string,
  date: string,
  entry: MetricEntry,
): Promise<SaveResult> {
  const doc = await loadMetrics(slug);
  // Empty entry (all fields blank) is a delete — keeps the file lean.
  if (Object.keys(entry).length === 0) {
    delete doc.entries[date];
  } else {
    doc.entries[date] = entry;
  }
  return saveMetrics(slug, doc);
}
