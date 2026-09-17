"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MASTER_SLUG } from "@/lib/tenants";
import { provisionCron, type ConcurrencyPolicy } from "./provision";

export async function provisionCronFromForm(formData: FormData): Promise<void> {
  const tenant = String(formData.get("tenant") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const namespace = String(formData.get("namespace") ?? "").trim();
  const schedule = String(formData.get("schedule") ?? "").trim();
  const image = String(formData.get("image") ?? "").trim();
  const command = String(formData.get("command") ?? "").trim();
  const concurrencyPolicy = String(formData.get("concurrencyPolicy") ?? "Allow") as ConcurrencyPolicy;

  const back = `/${tenant}/cron/new`;

  if (tenant === MASTER_SLUG) {
    redirect(back + `?error=${encodeURIComponent("Pick a business first — master view can't own crons.")}`);
  }

  const result = await provisionCron({
    mode: "shell",
    tenant,
    name,
    namespace,
    schedule,
    image,
    command,
    concurrencyPolicy,
  });

  if (!result.ok) {
    redirect(back + `?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(`/${tenant}/cron`);
  revalidatePath(`/${tenant}/history`);

  if (result.warning) {
    redirect(`/${tenant}/cron?warn=${encodeURIComponent(result.warning)}`);
  }
  redirect(`/${tenant}/cron?created=${name}`);
}
