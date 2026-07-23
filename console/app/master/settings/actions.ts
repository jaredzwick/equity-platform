"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AGENCY_SCHEMA,
  saveAgency,
  setAtPath,
  type AgencyConfig,
  type Field,
} from "@/lib/agency";
import { isAuthenticated } from "@/lib/github";

function coerce(field: Field, raw: string): string | number | null {
  const s = raw.trim();
  if (s === "") return null;
  if (field.kind === "number") {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (field.kind === "money") {
    const n = Number(s.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return s;
}

export async function saveAgencyFromForm(formData: FormData): Promise<void> {
  const back = "/master/settings";
  if (!(await isAuthenticated())) {
    redirect(`${back}?error=${encodeURIComponent("Sign in with GitHub first.")}`);
  }

  let cfg: AgencyConfig = {};
  for (const section of AGENCY_SCHEMA) {
    for (const field of section.fields) {
      const raw = formData.get(field.path);
      if (raw === null) continue;
      const coerced = coerce(field, String(raw));
      if (coerced === null) continue;
      cfg = setAtPath(cfg, field.path, coerced);
    }
  }

  try {
    await saveAgency(cfg);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirect(`${back}?error=${encodeURIComponent(`Save failed: ${msg}`)}`);
  }

  revalidatePath(back);
  redirect(`${back}?saved=1`);
}
