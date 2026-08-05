"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFileSha, isConfigured, putFile, resolveTargetRepo } from "@/lib/github";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";

// Form input for provisioning a new ArgoCD Application.
export type NewAppInput = {
  tenant: string;
  name: string;             // kebab-case, becomes both Application name and filename
  chartRepo: string;        // "https://charts.bitnami.com/bitnami"
  chartName: string;        // "redis"
  chartVersion: string;     // "20.1.0"
  namespace: string;        // where the app deploys (defaults to tenant's ns)
  valuesYaml: string;       // arbitrary user-supplied values
};

export type ActionResult =
  | { ok: true; commitSha: string; appName: string; tenant: string }
  | { ok: false; error: string };

// Very small guard against garbage-in. Full validation happens on the form.
function validate(input: NewAppInput): string | null {
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(input.name)) {
    return "Name must be kebab-case (a-z, 0-9, dashes).";
  }
  if (!input.chartRepo.startsWith("https://")) return "Chart repo must be an https:// URL.";
  if (!input.chartName) return "Chart name required.";
  if (!input.chartVersion) return "Chart version required.";
  if (!input.namespace) return "Namespace required.";
  if (input.tenant === MASTER_SLUG) return "Cannot provision from the master view — pick a business first.";
  return null;
}

// Render the ArgoCD Application manifest. The git URL is resolved from
// the configured backup target — no more silent "jaredzwick" fallback,
// which would point brand-new users at the upstream project. The console
// commits YAML that ArgoCD reconciles as-is (no envsubst step in the
// reconcile path), so this URL has to be correct at render time.
async function renderApplication(input: NewAppInput): Promise<string> {
  const { owner, name } = await resolveTargetRepo();
  const gitRepo = `${owner}/${name}`;
  return `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${input.name}
  namespace: argocd
  labels:
    equity.io/tenant: ${input.tenant}
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  sources:
    - repoURL: ${input.chartRepo}
      chart: ${input.chartName}
      targetRevision: ${input.chartVersion}
      helm:
        valueFiles:
          - $values/charts/${input.name}/values.yaml
    - repoURL: https://github.com/${gitRepo}.git
      targetRevision: HEAD
      ref: values
  destination:
    server: https://kubernetes.default.svc
    namespace: ${input.namespace}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
`;
}

export async function provisionApp(input: NewAppInput): Promise<ActionResult> {
  if (!(await isConfigured())) {
    return { ok: false, error: "GITHUB_TOKEN and GITHUB_REPO must be set in the console env." };
  }
  const validationErr = validate(input);
  if (validationErr) return { ok: false, error: validationErr };

  const tenant = await resolveTenant(input.tenant);
  if (!tenant) return { ok: false, error: `Unknown tenant: ${input.tenant}` };

  const appPath = `apps/${input.name}.yaml`;
  const valuesPath = `charts/${input.name}/values.yaml`;

  try {
    // If either file exists, bail — the user picked a colliding name.
    const [existingApp, existingValues] = await Promise.all([
      getFileSha(appPath),
      getFileSha(valuesPath),
    ]);
    if (existingApp || existingValues) {
      return {
        ok: false,
        error: `An app named "${input.name}" already exists (${existingApp ? appPath : valuesPath}). Pick a different name.`,
      };
    }

    // Write values first so that when ArgoCD picks up the Application, the
    // values file already exists at HEAD. Two commits total.
    const valuesCommit = await putFile({
      path: valuesPath,
      content: input.valuesYaml.endsWith("\n") ? input.valuesYaml : input.valuesYaml + "\n",
      message: `feat(${input.tenant}): add values for ${input.name}`,
    });
    const appCommit = await putFile({
      path: appPath,
      content: await renderApplication(input),
      message: `feat(${input.tenant}): provision ${input.name} via console`,
    });

    revalidatePath(`/${input.tenant}/apps`);
    revalidatePath(`/${input.tenant}/history`);

    // Return so the client can show the commit link; the caller will redirect.
    return {
      ok: true,
      commitSha: appCommit.commitSha,
      appName: input.name,
      tenant: input.tenant,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ...(valuesCommit ? {} : {}),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Convenience wrapper: parse FormData, call provisionApp, redirect on success.
export async function provisionAppFromForm(formData: FormData): Promise<void> {
  const input: NewAppInput = {
    tenant: String(formData.get("tenant") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    chartRepo: String(formData.get("chartRepo") ?? "").trim(),
    chartName: String(formData.get("chartName") ?? "").trim(),
    chartVersion: String(formData.get("chartVersion") ?? "").trim(),
    namespace: String(formData.get("namespace") ?? "").trim(),
    valuesYaml: String(formData.get("valuesYaml") ?? "").trim() || "# empty values\n",
  };
  const result = await provisionApp(input);
  if (!result.ok) {
    // Encode error into query string; the form page renders it.
    redirect(`/${input.tenant}/apps/new?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`/${input.tenant}/apps?provisioned=${result.appName}&sha=${result.commitSha.slice(0, 7)}`);
}
