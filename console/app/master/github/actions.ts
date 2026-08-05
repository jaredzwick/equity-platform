"use server";

import { revalidatePath } from "next/cache";
import { readBackupConfig, writeBackupConfig } from "@/lib/backup-config";

// Enable GitHub backup with the given repoUrl. Writes local/.config.json;
// the next `local/up.sh` run picks it up for ArgoCD, and the console
// resolves this as the write target immediately (no restart needed).
export async function enableBackup(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const repoUrl = String(formData.get("repoUrl") ?? "").trim();
  const branch = String(formData.get("branch") ?? "").trim() || undefined;
  try {
    const current = await readBackupConfig();
    await writeBackupConfig({
      githubBackup: {
        ...current.githubBackup,
        enabled: true,
        repoUrl,
        branch,
      },
    });
    revalidatePath("/master/github");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Disable — drops the backup target from disk. Cluster keeps running;
// next up.sh boots LOCAL-ONLY. Anything currently in-cluster stays until
// down.sh. Doesn't repoint ArgoCD live — that requires the tear-down/re-up
// cycle for the ArgoCD Application to change repoURL.
export async function disableBackup(): Promise<{ ok: boolean; error?: string }> {
  try {
    const current = await readBackupConfig();
    await writeBackupConfig({
      githubBackup: {
        ...current.githubBackup,
        enabled: false,
      },
    });
    revalidatePath("/master/github");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
