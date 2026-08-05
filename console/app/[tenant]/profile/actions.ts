"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PROFILE_SCHEMA,
  saveProfile,
  setAtPath,
  type BusinessProfile,
  type Field,
} from "@/lib/business-profile";
import { isConfigured } from "@/lib/github";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";

// Coerce form value strings into the right JS type for the schema field.
function coerce(field: Field, raw: string): string | number | null {
  const s = raw.trim();
  if (s === "") return null;
  if (field.kind === "number") {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (field.kind === "money") {
    // Money stored as whole dollars (integer). Strip $ , commas.
    const n = Number(s.replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return s;
}

export async function saveProfileFromForm(formData: FormData): Promise<void> {
  const tenant = String(formData.get("__tenant") ?? "");
  const back = `/${tenant}/profile`;

  if (tenant === MASTER_SLUG || !tenant) {
    redirect(`${back}?error=${encodeURIComponent("Pick a business first.")}`);
  }
  if (!(await isConfigured())) {
    redirect(`${back}?error=${encodeURIComponent("GITHUB_TOKEN + GITHUB_REPO must be set in console/.env.local.")}`);
  }

  const t = await resolveTenant(tenant);
  if (!t) redirect(`${back}?error=${encodeURIComponent(`Unknown tenant: ${tenant}`)}`);

  // Build the profile object by iterating the schema and reading each field
  // from the FormData. Missing/empty fields are omitted from the YAML (not
  // written as null) so the file stays lean.
  let profile: BusinessProfile = {};
  for (const section of PROFILE_SCHEMA) {
    for (const field of section.fields) {
      const raw = formData.get(field.path);
      if (raw === null) continue;
      const coerced = coerce(field, String(raw));
      if (coerced === null) continue;
      profile = setAtPath(profile, field.path, coerced);
    }
  }

  try {
    await saveProfile(tenant, profile);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    redirect(`${back}?error=${encodeURIComponent(`Save failed: ${msg}`)}`);
  }

  revalidatePath(back);
  revalidatePath(`/${tenant}/history`);
  redirect(`${back}?saved=1`);
}
