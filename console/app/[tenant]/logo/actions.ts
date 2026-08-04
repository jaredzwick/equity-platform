"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFile, putFile, rawUrl } from "@/lib/github";
import { loadProfile, saveProfile, setAtPath } from "@/lib/business-profile";
import { MASTER_SLUG } from "@/lib/tenants";

function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e
    && typeof (e as { digest: unknown }).digest === "string"
    && (e as { digest: string }).digest.startsWith("NEXT_REDIRECT");
}

function logoPath(slug: string): string {
  return `businesses/${slug}/logo.png`;
}

export async function saveLogoFromForm(formData: FormData): Promise<void> {
  const tenant = String(formData.get("tenant") ?? "").trim();
  const b64 = String(formData.get("b64") ?? "");

  const back = `/${tenant}/logo`;
  if (!tenant || tenant === MASTER_SLUG) redirect(`${back}?error=${encodeURIComponent("Pick a business first.")}`);
  if (!b64) redirect(`${back}?error=${encodeURIComponent("No image data to save.")}`);

  const path = logoPath(tenant);
  const bytes = Buffer.from(b64, "base64");

  // 1) Commit the PNG bytes to git (idempotent — pass current sha if the file
  //    exists so we overwrite; omit for the first save).
  try {
    const existing = await getFile(path);
    await putFile({
      path,
      content: bytes,
      message: `feat(${tenant}): update brand logo`,
      sha: existing?.sha,
    });
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    redirect(`${back}?error=${encodeURIComponent(`Logo commit failed: ${msg}`)}`);
  }

  // 2) Point brand.logo_url at the raw URL so downstream pages (landing pages,
  //    emails, the console itself) render the new logo automatically.
  try {
    const url = await rawUrl(path);
    const profile = (await loadProfile(tenant).catch(() => null)) ?? {};
    const updated = setAtPath(profile, "brand.logo_url", url);
    await saveProfile(tenant, updated);
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    // PNG landed but profile didn't — surface but don't rollback the image.
    redirect(`${back}?warn=${encodeURIComponent(`Logo committed but profile update failed: ${msg}`)}`);
  }

  revalidatePath(`/${tenant}/logo`);
  revalidatePath(`/${tenant}/profile`);
  revalidatePath(`/${tenant}`);
  redirect(`/${tenant}/profile?saved=1`);
}
