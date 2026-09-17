// Console-runtime cron provisioning. Wraps the pure renderer/validator in
// @/lib/cron-render with the console's github + k8s + tenant plumbing.
// Consumed by actions.ts (the form action) — the equity-mcp server has its
// own inlined variant to preserve the "no Next runtime" constraint.

import { batch, core } from "@/lib/k8s";
import { getFileSha, isConfigured, putFile } from "@/lib/github";
import { resolveTenant } from "@/lib/tenants";
import {
  buildCronJobBody,
  CLAUDE_RUNNER_SECRET,
  renderCronYaml,
  validateProvisionInput,
  type ConcurrencyPolicy,
  type ProvisionCronInput,
} from "@/lib/cron-render";

export type { ConcurrencyPolicy, ProvisionCronInput } from "@/lib/cron-render";

export type ProvisionCronResult =
  | { ok: true; path: string; warning?: string }
  | { ok: false; error: string };

export async function provisionCron(input: ProvisionCronInput): Promise<ProvisionCronResult> {
  const v = validateProvisionInput(input);
  if (!v.ok) return v;

  const tenantObj = await resolveTenant(input.tenant);
  if (!tenantObj) return { ok: false, error: `Unknown tenant: ${input.tenant}` };

  if (!(await isConfigured())) {
    return {
      ok: false,
      error: "GITHUB_TOKEN + GITHUB_REPO must be set in console/.env.local.",
    };
  }

  // Runner-mode: fail loudly if the OAuth secret is missing rather than let
  // the pod ImagePullBackOff → CrashLoopBackOff silently forever. The secret
  // is created out-of-band by `make runner` and lives per-namespace.
  if (input.mode === "runner") {
    const secretCheck = await verifyRunnerSecret(input.namespace);
    if (!secretCheck.ok) return secretCheck;
  }

  const path = `crons/${input.name}.yaml`;
  const manifest = renderCronYaml(input);

  // 1) Refuse if the file already exists — collisions are worse than a
  //    friendly error message.
  try {
    const existing = await getFileSha(path);
    if (existing) {
      return { ok: false, error: `A cron named "${input.name}" already exists at ${path}.` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `GitHub read failed: ${msg}` };
  }

  // 2) Commit to git — canonical, versioned, revertable via History tab.
  try {
    await putFile({
      path,
      content: manifest,
      message: `feat(${input.tenant}): add cron ${input.name} via console`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `GitHub write failed: ${msg}` };
  }

  // 3) Apply directly to the cluster so the cron shows up in the /cron tab
  //    without waiting for a git-watching Application. Return a warning if
  //    cluster-apply fails — git already landed, don't roll it back.
  try {
    await batch().createNamespacedCronJob({
      namespace: input.namespace,
      body: buildCronJobBody(input),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("already exists")) {
      return {
        ok: true,
        path,
        warning: `Committed but cluster-apply failed: ${msg}. Run kubectl apply -f ${path} manually.`,
      };
    }
  }

  return { ok: true, path };
}

async function verifyRunnerSecret(
  namespace: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await core().readNamespacedSecret({ name: CLAUDE_RUNNER_SECRET, namespace });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("not found") || msg.includes("404")) {
      return {
        ok: false,
        error:
          `Secret "${CLAUDE_RUNNER_SECRET}" not found in namespace "${namespace}". ` +
          `Run \`make runner\` (or see runners/claude-runner/README.md) to bootstrap it before scheduling AI crons.`,
      };
    }
    return { ok: false, error: `Failed to verify runner secret: ${msg}` };
  }
}
