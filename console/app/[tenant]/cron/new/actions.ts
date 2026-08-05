"use server";

import { batch } from "@/lib/k8s";
import { getFileSha, isConfigured, putFile } from "@/lib/github";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function isRedirect(e: unknown): boolean {
  return typeof e === "object" && e !== null && "digest" in e
    && typeof (e as { digest: unknown }).digest === "string"
    && (e as { digest: string }).digest.startsWith("NEXT_REDIRECT");
}

// A very rough cron-expression check. Full parsing is non-trivial (@daily,
// L, W, ?, etc.) — we let kubectl reject anything genuinely broken and just
// catch obvious garbage here.
function looksLikeCron(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.startsWith("@")) return /^@(hourly|daily|weekly|monthly|yearly|annually|reboot)$/.test(trimmed);
  const parts = trimmed.split(/\s+/);
  return parts.length === 5 || parts.length === 6;
}

function validName(s: string): boolean {
  return /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(s) && s.length <= 52;
}

function renderCronYaml(input: {
  name: string;
  namespace: string;
  tenant: string;
  schedule: string;
  image: string;
  command: string;
  concurrencyPolicy: "Allow" | "Forbid" | "Replace";
}): string {
  // Command is passed through /bin/sh -c so users can write natural shell
  // pipelines. If they want a raw exec form, they can add "sh -c '...'"
  // themselves (idempotent — the outer sh -c will just eval another sh -c).
  const escapedCmd = input.command.replace(/'/g, "'\\''");
  return `apiVersion: batch/v1
kind: CronJob
metadata:
  name: ${input.name}
  namespace: ${input.namespace}
  labels:
    equity.io/tenant: ${input.tenant}
    equity.io/managed-by: console
spec:
  schedule: "${input.schedule}"
  concurrencyPolicy: ${input.concurrencyPolicy}
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: worker
              image: ${input.image}
              command: ["/bin/sh", "-c"]
              args:
                - '${escapedCmd}'
`;
}

export async function provisionCronFromForm(formData: FormData): Promise<void> {
  const tenant = String(formData.get("tenant") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const namespace = String(formData.get("namespace") ?? "").trim();
  const schedule = String(formData.get("schedule") ?? "").trim();
  const image = String(formData.get("image") ?? "").trim();
  const command = String(formData.get("command") ?? "").trim();
  const concurrencyPolicy = (String(formData.get("concurrencyPolicy") ?? "Allow") as
    | "Allow"
    | "Forbid"
    | "Replace");

  const back = `/${tenant}/cron/new`;

  if (tenant === MASTER_SLUG) redirect(back + `?error=${encodeURIComponent("Pick a business first — master view can't own crons.")}`);
  if (!validName(name)) redirect(back + `?error=${encodeURIComponent("Name must be kebab-case, ≤52 chars.")}`);
  if (!namespace) redirect(back + `?error=${encodeURIComponent("Namespace required.")}`);
  if (!looksLikeCron(schedule)) redirect(back + `?error=${encodeURIComponent("Schedule must be a 5-field cron expression or an @keyword.")}`);
  if (!image) redirect(back + `?error=${encodeURIComponent("Image required (e.g. busybox:1.36).")}`);
  if (!command) redirect(back + `?error=${encodeURIComponent("Command required.")}`);
  if (!["Allow", "Forbid", "Replace"].includes(concurrencyPolicy)) {
    redirect(back + `?error=${encodeURIComponent("Invalid concurrency policy.")}`);
  }
  if (!(await isConfigured())) redirect(back + `?error=${encodeURIComponent("GITHUB_TOKEN + GITHUB_REPO must be set in console/.env.local.")}`);

  const tenantObj = await resolveTenant(tenant);
  if (!tenantObj) redirect(back + `?error=${encodeURIComponent(`Unknown tenant: ${tenant}`)}`);

  const path = `crons/${name}.yaml`;
  const manifest = renderCronYaml({ name, namespace, tenant, schedule, image, command, concurrencyPolicy });

  // 1) Refuse if the file already exists — collisions are worse than a
  //    friendly error message.
  try {
    const existing = await getFileSha(path);
    if (existing) {
      redirect(back + `?error=${encodeURIComponent(`A cron named "${name}" already exists at ${path}.`)}`);
    }
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    redirect(back + `?error=${encodeURIComponent(`GitHub read failed: ${msg}`)}`);
  }

  // 2) Commit to git — canonical, versioned, revertable via History tab.
  try {
    await putFile({
      path,
      content: manifest,
      message: `feat(${tenant}): add cron ${name} via console`,
    });
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    redirect(back + `?error=${encodeURIComponent(`GitHub write failed: ${msg}`)}`);
  }

  // 3) Apply directly to the cluster so the cron shows up in the /cron tab
  //    without waiting for a git-watching Application (we don't have one for
  //    crons yet — see follow-up in the README roadmap).
  try {
    await batch().createNamespacedCronJob({
      namespace,
      body: {
        apiVersion: "batch/v1",
        kind: "CronJob",
        metadata: {
          name,
          namespace,
          labels: {
            "equity.io/tenant": tenant,
            "equity.io/managed-by": "console",
          },
        },
        spec: {
          schedule,
          concurrencyPolicy,
          successfulJobsHistoryLimit: 3,
          failedJobsHistoryLimit: 1,
          jobTemplate: {
            spec: {
              template: {
                spec: {
                  restartPolicy: "OnFailure",
                  containers: [
                    {
                      name: "worker",
                      image,
                      command: ["/bin/sh", "-c"],
                      args: [command],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    });
  } catch (e) {
    if (isRedirect(e)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    // Commit landed but cluster-apply failed — surface but don't rollback the
    // git commit. On the next ArgoCD-crons reconcile (once wired) it'd sync.
    if (!msg.includes("already exists")) {
      redirect(`/${tenant}/cron?warn=${encodeURIComponent(`Committed but cluster-apply failed: ${msg}. Run kubectl apply -f ${path} manually.`)}`);
    }
  }

  revalidatePath(`/${tenant}/cron`);
  revalidatePath(`/${tenant}/history`);
  redirect(`/${tenant}/cron?created=${name}`);
}
