import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listArgoApps } from "@/lib/k8s";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { isConfigured } from "@/lib/github";
import {
  CATEGORIES,
  TEMPLATES,
  templatesByCategory,
  type AppTemplate,
} from "@/lib/app-templates";
import {
  availabilityKey,
  getManyChartAvailabilities,
  type Availability,
} from "@/lib/helm-repo";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function NewAppPickerPage({ params, searchParams }: Props) {
  const { tenant: slug } = await params;
  const { error } = await searchParams;
  if (slug === MASTER_SLUG) redirect("/master");

  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const configured = await isConfigured();
  const [apps, availabilities] = await Promise.all([
    listArgoApps(tenant.namespaces).catch(() => []),
    getManyChartAvailabilities(TEMPLATES).catch(
      () => new Map<string, Availability>(),
    ),
  ]);
  const installedChartNames = new Set(
    apps
      .map((a) => a.spec.sources?.[0]?.chart ?? a.spec.source?.chart)
      .filter((c): c is string => !!c),
  );

  const grouped = templatesByCategory();

  return (
    <div className="max-w-6xl">
      <Link
        href={`/${slug}/apps`}
        className="inline-flex items-center gap-1 text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] mb-4"
      >
        ← Apps
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[color:var(--color-fg)] mb-2">
          Add an app to {tenant.name}
        </h1>
        <p className="text-sm text-[color:var(--color-muted)] max-w-2xl">
          Pick a curated template for one-click provisioning, or bring your own
          Helm chart from anywhere. Each app is committed to git and reconciled
          by ArgoCD within about a minute.{" "}
          <a
            href="https://www.lamboapp.com/docs/apps-overview"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-[color:var(--color-fg)]"
          >
            How this works →
          </a>
        </p>
      </div>

      {!configured && (
        <div className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">
            Not configured for GitOps writeback
          </div>
          <div className="text-neutral-300">
            Set <code className="text-neutral-100">GITHUB_TOKEN</code> and{" "}
            <code className="text-neutral-100">GITHUB_REPO</code> in{" "}
            <code className="text-neutral-100">console/.env.local</code>. Until
            then, template cards and the custom chart page won't be able to
            commit.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-10">
        {CATEGORIES.map((cat) => {
          const list = grouped[cat];
          if (list.length === 0) return null;
          return (
            <section key={cat}>
              <h2 className="text-xs font-mono uppercase tracking-[0.15em] text-[color:var(--color-muted)] mb-3">
                {cat}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.map((t) => (
                  <TemplateCard
                    key={t.id}
                    tenant={slug}
                    template={t}
                    installed={installedChartNames.has(t.chartName)}
                    configured={configured}
                    availability={availabilities.get(availabilityKey(t))}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-12 pt-8 border-t border-[color:var(--color-border)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm font-medium text-[color:var(--color-fg)] mb-1">
              Don't see what you need?
            </div>
            <p className="text-xs text-[color:var(--color-muted)] max-w-lg">
              Any public Helm chart works. You'll need the repo URL, chart name,
              and a pinned version.{" "}
              <a
                href="https://www.lamboapp.com/docs/apps-custom-chart"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-[color:var(--color-fg)]"
              >
                Custom chart guide →
              </a>
            </p>
          </div>
          <Link
            href={`/${slug}/apps/new/custom`}
            className="text-sm px-4 py-2 rounded border border-[color:var(--color-border)] text-[color:var(--color-fg)] hover:border-[color:var(--color-fg)] font-medium whitespace-nowrap"
          >
            Advanced: custom chart →
          </Link>
        </div>
      </div>

      <p className="mt-10 text-xs text-[color:var(--color-muted)]">
        {TEMPLATES.length} curated templates · updated with each release.{" "}
        <a
          href="https://www.lamboapp.com/docs/apps-choose-template"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-[color:var(--color-fg)]"
        >
          Which one should I pick? →
        </a>
      </p>
    </div>
  );
}

function TemplateCard({
  tenant,
  template,
  installed,
  configured,
  availability,
}: {
  tenant: string;
  template: AppTemplate;
  installed: boolean;
  configured: boolean;
  availability: Availability | undefined;
}) {
  const yanked = availability?.status === "yanked";
  const availabilityUnknown =
    !availability || availability.status === "unknown";
  const disabled = installed || !configured || yanked;
  const href = `/${tenant}/apps/new/${template.id}`;

  const badge = installed
    ? {
        label: "Installed",
        color: "border-emerald-900/60 bg-emerald-950/40 text-emerald-400",
      }
    : yanked
    ? {
        label: "Version yanked",
        color: "border-red-900/60 bg-red-950/40 text-red-400",
      }
    : availabilityUnknown
    ? {
        label: "Version unverified",
        color: "border-amber-900/60 bg-amber-950/40 text-amber-400",
      }
    : null;

  const versionSuffix =
    yanked && availability && "latestVersion" in availability
      ? ` · latest v${availability.latestVersion}`
      : "";

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none" aria-hidden>
            {template.icon}
          </span>
          <div className="font-medium text-[color:var(--color-fg)]">
            {template.name}
          </div>
        </div>
        {badge && (
          <span
            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border whitespace-nowrap ${badge.color}`}
          >
            {badge.label}
          </span>
        )}
      </div>
      <p className="text-xs text-[color:var(--color-muted)] leading-relaxed mb-3 min-h-[2.5rem]">
        {template.summary}
      </p>
      <div className="flex items-center justify-between text-[11px] text-[color:var(--color-muted)]">
        <span className="font-mono">{template.chartName}</span>
        <span className="font-mono">
          v{template.chartVersion}
          {versionSuffix}
        </span>
      </div>
    </>
  );

  const baseCard =
    "block p-4 rounded-lg border border-[color:var(--color-border)] bg-white/[0.02] h-full";

  const disabledTitle = installed
    ? `${template.chartName} is already installed. Use the custom chart page if you want a second copy.`
    : yanked
    ? `Chart version ${template.chartVersion} was removed from ${template.chartRepo}. The template needs a version bump — meanwhile, use the custom chart page.`
    : "GitHub writeback isn't configured — see the amber banner above.";

  if (disabled) {
    return (
      <div
        className={`${baseCard} opacity-50 cursor-not-allowed`}
        title={disabledTitle}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`${baseCard} hover:border-[color:var(--color-fg)] transition-colors`}
      title={
        availabilityUnknown
          ? "Couldn't reach the upstream chart repo to verify this version. Install may still succeed."
          : undefined
      }
    >
      {inner}
    </Link>
  );
}
