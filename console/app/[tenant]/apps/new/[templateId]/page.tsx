import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { isConfigured, repoUrl } from "@/lib/github";
import ValidatedInput from "@/components/ValidatedInput";
import { getTemplate } from "@/lib/app-templates";
import { getChartAvailability } from "@/lib/helm-repo";
import { provisionAppFromForm } from "../actions";

export const dynamic = "force-dynamic";

// Docs live on the landing site. Override with DOCS_BASE_URL for staging /
// preview envs. Fallback keeps prod working with no env config.
const DOCS_BASE_URL = process.env.DOCS_BASE_URL ?? "https://www.lamboapp.com";
const docsUrl = (slug: string) => `${DOCS_BASE_URL}/docs/${slug}`;

type Props = {
  params: Promise<{ tenant: string; templateId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function TemplatedAppPage({ params, searchParams }: Props) {
  const { tenant: slug, templateId } = await params;
  const { error } = await searchParams;
  if (slug === MASTER_SLUG) redirect("/master");

  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const template = getTemplate(templateId);
  if (!template) notFound();

  const [configured, configuredRepoUrl, availability] = await Promise.all([
    isConfigured(),
    isConfigured().then((ok) => (ok ? repoUrl() : Promise.resolve(null))),
    getChartAvailability(
      template.chartRepo,
      template.chartName,
      template.chartVersion,
    ).catch(() => ({
      status: "unknown" as const,
      reason: "availability check failed",
    })),
  ]);
  const defaultNamespace = template.defaultNamespace ?? tenant.namespaces[0] ?? "";
  const returnTo = `/${slug}/apps/new/${templateId}`;
  const yanked = availability.status === "yanked";
  const availabilityUnknown = availability.status === "unknown";
  const submitBlocked = !configured || yanked;

  return (
    <div className="max-w-2xl">
      <Link
        href={`/${slug}/apps/new`}
        className="inline-flex items-center gap-1 text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] mb-4"
      >
        ← Templates
      </Link>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl leading-none" aria-hidden>
          {template.icon}
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-[color:var(--color-fg)]">
            {template.name}
          </h1>
          <div className="text-xs text-[color:var(--color-muted)] font-mono">
            {template.chartName} · v{template.chartVersion} · {template.category}
          </div>
        </div>
      </div>

      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        {template.summary} Installing writes two files to git{" "}
        {configured ? (
          <>
            (<a href={configuredRepoUrl ?? "#"} className="underline">the platform repo</a>)
          </>
        ) : (
          "(the platform repo)"
        )}{" "}
        and ArgoCD picks it up within about a minute. You can edit values below
        before submitting.
      </p>

      {!configured && (
        <div className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">
            Not configured for GitOps writeback
          </div>
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

      {yanked && "latestVersion" in availability && (
        <div className="mb-6 p-4 border border-red-500/40 rounded-lg bg-red-950/80 text-sm">
          <div className="font-semibold text-red-200 mb-1">
            Chart version {template.chartVersion} is no longer available upstream
          </div>
          <div className="text-red-100">
            The maintainer of{" "}
            <a href={template.chartRepo} target="_blank" rel="noreferrer" className="underline">
              {template.chartRepo}
            </a>{" "}
            removed v{template.chartVersion}. Latest available is{" "}
            <code className="text-red-50">v{availability.latestVersion}</code>.
            Installing now would cause an ArgoCD sync failure.
          </div>
          <div className="text-red-100 mt-2">
            Two fixes:
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>
                Bump the pin in{" "}
                <code className="text-red-50">console/lib/app-templates.ts</code>{" "}
                (send a PR — that fixes it for every tenant).
              </li>
              <li>
                Or use the{" "}
                <Link href={`/${slug}/apps/new/custom`} className="underline hover:text-red-50">
                  custom chart page
                </Link>{" "}
                with the new version now.
              </li>
            </ul>
          </div>
        </div>
      )}

      {availabilityUnknown && !yanked && (
        <div className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">
            Couldn't verify chart version
          </div>
          <div className="text-amber-100">
            We couldn't reach{" "}
            <code className="text-amber-50">{template.chartRepo}</code> to check
            whether v{template.chartVersion} is still published. You can still
            install; if the version was yanked, ArgoCD will fail with a red
            sync pill on the apps list.
          </div>
        </div>
      )}

      <form action={provisionAppFromForm} className="flex flex-col gap-4">
        <input type="hidden" name="tenant" value={slug} />
        <input type="hidden" name="_returnTo" value={returnTo} />
        <input type="hidden" name="chartRepo" value={template.chartRepo} />
        <input type="hidden" name="chartName" value={template.chartName} />
        <input type="hidden" name="chartVersion" value={template.chartVersion} />

        <ValidatedInput
          name="name"
          label="Application name"
          validator="kebab"
          required
          defaultValue={template.id}
          tooltip="Becomes the ArgoCD Application name and the filename in git (apps/<name>.yaml)."
          hint="kebab-case; must be unique within this tenant"
        />

        <ValidatedInput
          name="namespace"
          label="Target namespace"
          validator="namespace"
          required
          defaultValue={defaultNamespace}
          tooltip="Kubernetes namespace where the app's pods and services will live."
          hint={`Defaults to ${tenant.name}'s namespace`}
        />

        <div className="rounded border border-[color:var(--color-border)] bg-white/[0.02] p-3 text-xs text-[color:var(--color-muted)]">
          <div className="font-medium text-[color:var(--color-fg)] mb-1">Chart source (locked to template)</div>
          <div className="font-mono">
            {template.chartName} @ v{template.chartVersion}
          </div>
          <div className="mt-1">
            from{" "}
            <a
              href={template.chartRepo}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {template.chartRepo}
            </a>
          </div>
          <div className="mt-2">
            Need a different chart or version?{" "}
            <Link
              href={`/${slug}/apps/new/custom`}
              className="underline hover:text-[color:var(--color-fg)]"
            >
              Use the custom chart page →
            </Link>
          </div>
        </div>

        <ValidatedInput
          name="valuesYaml"
          label="Values YAML"
          type="textarea"
          rows={12}
          defaultValue={template.valuesYaml}
          className="font-mono"
          tooltip="Helm chart overrides. Written to charts/<name>/values.yaml."
          help={
            <>
              These are the settings the template comes with. Change any of them
              before submitting — for example, the placeholder passwords should
              always be replaced (or sourced from an ExternalSecret) before
              anything real depends on this app. Delete the whole thing to fall
              back to the chart's own defaults.
            </>
          }
          docsHref={docsUrl("apps-custom-chart")}
        />

        <div className="flex items-center gap-3 mt-2">
          <button
            type="submit"
            disabled={submitBlocked}
            className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed font-medium text-sm"
          >
            {yanked ? "Install blocked" : `Install ${template.name}`}
          </button>
          <span className="text-xs text-[color:var(--color-muted)]">
            {yanked
              ? "Bump the template pin or use the custom chart page."
              : "Writes 2 files, 2 commits. ArgoCD picks up within ~1 min."}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-[color:var(--color-border)] text-xs text-[color:var(--color-muted)]">
          Stuck on a sync error after install?{" "}
          <a
            href={docsUrl("apps-troubleshooting")}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-[color:var(--color-fg)]"
          >
            Troubleshooting guide →
          </a>
        </div>
      </form>
    </div>
  );
}
