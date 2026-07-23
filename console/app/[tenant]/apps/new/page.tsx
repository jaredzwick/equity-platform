import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { isConfigured, repoUrl } from "@/lib/github";
import { notFound, redirect } from "next/navigation";
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

  const configured = isConfigured();
  const defaultNamespace = tenant.namespaces[0] ?? "";

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        Provision a new Helm-chart-backed ArgoCD Application for{" "}
        <span className="font-medium text-[color:var(--color-fg)]">{tenant.name}</span>.
        Submitting writes two files to git (
        <a href={configured ? repoUrl() : "#"} className="underline">the platform repo</a>
        ) and ArgoCD picks it up on next sync.
      </p>

      {!configured && (
        <div className="mb-6 p-4 border border-amber-900 rounded bg-amber-950/40 text-sm">
          <div className="font-semibold text-amber-400 mb-1">Console not configured for GitOps writeback</div>
          <div className="text-neutral-400">
            Set <code className="text-neutral-300">GITHUB_TOKEN</code> and{" "}
            <code className="text-neutral-300">GITHUB_REPO</code> in{" "}
            <code className="text-neutral-300">console/.env.local</code>. See{" "}
            <code className="text-neutral-300">console/.env.example</code>.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 border border-red-900 rounded bg-red-950/40 text-sm text-red-400">
          {error}
        </div>
      )}

      <form action={provisionAppFromForm} className="flex flex-col gap-4">
        <input type="hidden" name="tenant" value={slug} />

        <Field label="Application name" hint="kebab-case; becomes filename + ArgoCD Application name">
          <input
            name="name"
            required
            pattern="[a-z0-9]([-a-z0-9]*[a-z0-9])?"
            placeholder="redis"
            className="input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Chart repo URL" hint="Helm repo (https)">
            <input
              name="chartRepo"
              required
              defaultValue="https://charts.bitnami.com/bitnami"
              className="input"
            />
          </Field>
          <Field label="Chart name">
            <input name="chartName" required placeholder="redis" className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Chart version" hint="Pin exactly — no ^ or ~">
            <input name="chartVersion" required placeholder="20.1.0" className="input" />
          </Field>
          <Field label="Target namespace">
            <input name="namespace" required defaultValue={defaultNamespace} className="input" />
          </Field>
        </div>

        <Field
          label="Values YAML"
          hint={`Written to charts/<name>/values.yaml. Empty = chart defaults.`}
        >
          <textarea
            name="valuesYaml"
            rows={10}
            defaultValue="# Helm values for this chart. Empty = chart defaults.\n"
            className="input font-mono text-xs"
          />
        </Field>

        <div className="flex items-center gap-3 mt-2">
          <button
            type="submit"
            disabled={!configured}
            className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
          >
            Commit + reconcile
          </button>
          <span className="text-xs text-[color:var(--color-muted)]">
            Writes 2 files, 2 commits. ArgoCD picks up within ~1 min.
          </span>
        </div>
      </form>

      <style>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
          color: var(--color-fg);
          font-size: 0.875rem;
        }
        .input:focus {
          outline: none;
          border-color: rgba(16, 185, 129, 0.6);
        }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-[color:var(--color-muted)]">{hint}</span>}
    </label>
  );
}
