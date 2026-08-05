import Link from "next/link";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { isConfigured, repoUrl } from "@/lib/github";
import { notFound, redirect } from "next/navigation";
import ValidatedInput from "@/components/ValidatedInput";
import { provisionAppFromForm } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function NewAppPage({ params, searchParams }: Props) {
  const { tenant: slug } = await params;
  const { error } = await searchParams;
  if (slug === MASTER_SLUG) redirect("/master");

  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const configured = (await isConfigured());
  const configuredRepoUrl = configured ? await repoUrl() : null;
  const defaultNamespace = tenant.namespaces[0] ?? "";
  const defaultValuesYaml = `# Helm values. Empty = chart defaults.\n`;

  return (
    <div className="max-w-2xl">
      <Link
        href={`/${slug}/apps`}
        className="inline-flex items-center gap-1 text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] mb-4"
      >
        ← Apps
      </Link>

      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        Provision a new Helm-chart-backed ArgoCD Application for{" "}
        <span className="font-medium text-[color:var(--color-fg)]">{tenant.name}</span>.
        Submitting writes two files to git{" "}
        {configured ? (
          <>
            (<a href={configuredRepoUrl ?? "#"} className="underline">the platform repo</a>)
          </>
        ) : (
          "(the platform repo)"
        )}{" "}
        and ArgoCD picks it up on next sync.
      </p>

      {!configured && (
        <div className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">Not configured for GitOps writeback</div>
          <div className="text-neutral-300">
            Set <code className="text-neutral-100">GITHUB_TOKEN</code> and{" "}
            <code className="text-neutral-100">GITHUB_REPO</code> in{" "}
            <code className="text-neutral-100">console/.env.local</code>. See{" "}
            <code className="text-neutral-100">console/.env.example</code>.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          {error}
        </div>
      )}

      <form action={provisionAppFromForm} className="flex flex-col gap-4">
        <input type="hidden" name="tenant" value={slug} />

        <ValidatedInput
          name="name"
          label="Application name"
          validator="kebab"
          required
          hint="kebab-case; becomes filename + ArgoCD Application name"
        />

        <div className="grid grid-cols-2 gap-4">
          <ValidatedInput
            name="chartRepo"
            label="Chart repo URL"
            validator="chartRepoUrl"
            required
            defaultValue="https://charts.bitnami.com/bitnami"
            hint="Helm repo (https)"
          />
          <ValidatedInput
            name="chartName"
            label="Chart name"
            required
            hint="e.g. redis, postgresql"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ValidatedInput
            name="chartVersion"
            label="Chart version"
            validator="chartVersion"
            required
            hint="Pin exactly — no ^ or ~"
          />
          <ValidatedInput
            name="namespace"
            label="Target namespace"
            validator="namespace"
            required
            defaultValue={defaultNamespace}
            hint="Kubernetes namespace"
          />
        </div>

        <ValidatedInput
          name="valuesYaml"
          label="Values YAML"
          type="textarea"
          rows={8}
          defaultValue={defaultValuesYaml}
          hint="Written to charts/<name>/values.yaml. Empty = chart defaults."
          className="font-mono"
        />

        <div className="flex items-center gap-3 mt-2">
          <button
            type="submit"
            disabled={!configured}
            className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed font-medium text-sm"
          >
            Commit + reconcile
          </button>
          <span className="text-xs text-[color:var(--color-muted)]">
            Writes 2 files, 2 commits. ArgoCD picks up within ~1 min.
          </span>
        </div>
      </form>
    </div>
  );
}
