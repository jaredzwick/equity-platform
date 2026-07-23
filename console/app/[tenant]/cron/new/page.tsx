import Link from "next/link";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { isConfigured, repoUrl } from "@/lib/github";
import { notFound, redirect } from "next/navigation";
import ValidatedInput from "@/components/ValidatedInput";
import { provisionCronFromForm } from "./actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function NewCronPage({ params, searchParams }: Props) {
  const { tenant: slug } = await params;
  const { error } = await searchParams;
  if (slug === MASTER_SLUG) redirect("/master");

  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const configured = isConfigured();
  const configuredRepoUrl = configured ? await repoUrl() : null;
  const defaultNamespace = tenant.namespaces[0] ?? "";

  return (
    <div className="max-w-2xl">
      <Link
        href={`/${slug}/cron`}
        className="inline-flex items-center gap-1 text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] mb-4"
      >
        ← Cron
      </Link>

      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        Provision a new CronJob for{" "}
        <span className="font-medium text-[color:var(--color-fg)]">{tenant.name}</span>.
        Submitting writes <code className="text-neutral-400">crons/&lt;name&gt;.yaml</code> to{" "}
        {configured ? (
          <a href={configuredRepoUrl ?? "#"} className="underline">the platform repo</a>
        ) : (
          "the platform repo"
        )}{" "}
        AND applies the CronJob to the live cluster so it starts running immediately.
      </p>

      {!configured && (
        <div className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">GitOps writeback not configured</div>
          <div className="text-neutral-400">
            Set <code className="text-neutral-300">GITHUB_TOKEN</code> +{" "}
            <code className="text-neutral-300">GITHUB_REPO</code> in{" "}
            <code className="text-neutral-300">console/.env.local</code>.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 border border-red-900 rounded bg-red-950/40 text-sm text-red-400">
          {error}
        </div>
      )}

      <form action={provisionCronFromForm} className="flex flex-col gap-4">
        <input type="hidden" name="tenant" value={slug} />

        <ValidatedInput
          name="name"
          label="Name"
          validator="kebab"
          required
          maxLength={52}
          hint="kebab-case; becomes filename + resource name"
        />

        <div className="grid grid-cols-2 gap-4">
          <ValidatedInput
            name="namespace"
            label="Namespace"
            validator="namespace"
            required
            defaultValue={defaultNamespace}
            hint="Target Kubernetes namespace"
          />
          <ValidatedInput
            name="schedule"
            label="Schedule"
            validator="cronSchedule"
            required
            defaultValue="0 * * * *"
            hint={`Cron expression or @keyword`}
            className="font-mono"
          />
        </div>

        <ValidatedInput
          name="image"
          label="Image"
          validator="image"
          required
          hint="Docker image with a tag (avoid :latest in prod)"
        />

        <ValidatedInput
          name="command"
          label="Command"
          type="textarea"
          required
          rows={4}
          defaultValue={"echo hello from cron; date"}
          hint="Runs via /bin/sh -c. Multi-line OK. Non-zero exit = failed run."
          className="font-mono"
        />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[color:var(--color-fg)]">
            Concurrency policy
          </span>
          <select
            name="concurrencyPolicy"
            defaultValue="Allow"
            className="w-full px-3 py-2 bg-white/[0.03] border border-[color:var(--color-border)] rounded text-sm focus:outline-none focus:border-emerald-600"
          >
            <option value="Allow">Allow — run in parallel</option>
            <option value="Forbid">Forbid — skip new run</option>
            <option value="Replace">Replace — kill old, start fresh</option>
          </select>
          <span className="text-[11px] text-[color:var(--color-muted)]">
            What to do if the previous run hasn&apos;t finished
          </span>
        </label>

        <div className="flex items-center gap-3 mt-2">
          <button
            type="submit"
            disabled={!configured}
            className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed font-medium text-sm"
          >
            Commit + apply
          </button>
          <span className="text-xs text-[color:var(--color-muted)]">
            1 commit + 1 CronJob applied. Runs on its next scheduled tick.
          </span>
        </div>
      </form>
    </div>
  );
}
