"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { upsertEntry } from "@/lib/metrics";
import { METRIC_FIELDS, type MetricEntry } from "@/lib/metrics-schema";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function coerce(raw: string): number | undefined {
  const s = raw.trim();
  if (s === "") return undefined;
  // Money fields may arrive with $ / commas from the input — strip both.
  const n = Number(s.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export async function saveEntryFromForm(formData: FormData): Promise<void> {
  const tenant = String(formData.get("__tenant") ?? "");
  const date = String(formData.get("__date") ?? "");
  const back = `/${tenant}/metrics`;

  if (tenant === MASTER_SLUG || !tenant) {
    redirect(`${back}?error=${encodeURIComponent("Pick a business first.")}`);
  }
  if (!ISO_DATE.test(date)) {
    redirect(`${back}?error=${encodeURIComponent("Invalid date.")}`);
  }
  const t = await resolveTenant(tenant);
  if (!t) redirect(`${back}?error=${encodeURIComponent(`Unknown tenant: ${tenant}`)}`);

  const entry: MetricEntry = {};
  for (const field of METRIC_FIELDS) {
    const raw = formData.get(field.key);
    if (raw === null) continue;
    const coerced = coerce(String(raw));
    if (coerced === undefined) continue;
    (entry as Record<string, number>)[field.key] = coerced;
  }

  let result;
  try {
    result = await upsertEntry(tenant, date, entry);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirect(`${back}?error=${encodeURIComponent(`Save failed: ${msg}`)}`);
  }

  revalidatePath(back);
  const qs = new URLSearchParams({ saved: date });
  if (result.gitError) qs.set("gitwarn", result.gitError);
  if (result.gitCommitSha) qs.set("git", result.gitCommitSha.slice(0, 7));
  redirect(`${back}?${qs.toString()}`);
}
