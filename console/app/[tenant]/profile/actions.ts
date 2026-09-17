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

  let result;
  try {
    result = await saveProfile(tenant, profile);
  } catch (e) {
    // Only fires on local-write failure — filesystem/permissions/disk.
    const msg = e instanceof Error ? e.message : String(e);
    redirect(`${back}?error=${encodeURIComponent(`Save failed: ${msg}`)}`);
  }

  revalidatePath(back);
  revalidatePath(`/${tenant}/history`);

  const qs = new URLSearchParams({ saved: "1" });
  if (result.gitError) qs.set("gitwarn", result.gitError);
  if (result.gitCommitSha) qs.set("git", result.gitCommitSha.slice(0, 7));
  redirect(`${back}?${qs.toString()}`);
}
