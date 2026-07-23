import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { isConfigured, repoUrl } from "@/lib/github";
import { loadProfile, PROFILE_SCHEMA, profilePath } from "@/lib/business-profile";
import ProfileEditor from "./ProfileEditor";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ saved?: string; error?: string; edit?: string }>;
};

export default async function ProfilePage({ params, searchParams }: Props) {
  const { tenant: slug } = await params;
  const { saved, error, edit } = await searchParams;
  if (slug === MASTER_SLUG) notFound();

  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const configured = isConfigured();

  let profile: Awaited<ReturnType<typeof loadProfile>> = null;
  let loadError: string | null = null;
  if (configured) {
    try {
      profile = await loadProfile(slug);
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    }
  }

  const editing = edit === "1" || !profile;

  return (
    <div className="max-w-4xl">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-sm text-[color:var(--color-muted)]">
          Declarative source of truth for <span className="text-[color:var(--color-fg)]">{tenant.name}</span>.
          Saved as{" "}
          {configured ? (
            <a
              href={`${repoUrl()}/blob/main/${profilePath(slug)}`}
              className="underline text-emerald-400"
              target="_blank"
              rel="noreferrer"
            >
              <code className="text-xs">{profilePath(slug)}</code>
            </a>
          ) : (
            <code className="text-xs text-neutral-400">{profilePath(slug)}</code>
          )}{" "}
          in the platform repo.
        </div>
        {!editing && profile && (
          <Link
            href={`/${slug}/profile?edit=1`}
            className="text-xs px-3 py-1.5 rounded border border-[color:var(--color-border)] hover:bg-white/5"
          >
            Edit
          </Link>
        )}
      </div>

      {!configured && (
        <div className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">Not configured for GitOps writeback</div>
          <div className="text-neutral-300">
            Profile viewing and editing requires <code className="text-neutral-100">GITHUB_TOKEN</code> +{" "}
            <code className="text-neutral-100">GITHUB_REPO</code> in{" "}
            <code className="text-neutral-100">console/.env.local</code>.
          </div>
        </div>
      )}

      {loadError && (
        <div className="mb-6 p-4 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          Load failed: {loadError}
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-6 p-4 border border-emerald-500/40 rounded-lg bg-emerald-950/80 text-sm text-emerald-200">
          Saved. Committed to git. Refreshed live.
        </div>
      )}

      {!editing && profile && configured && <ReadOnlyProfile profile={profile} />}

      {(editing || !configured) && (
        <ProfileEditor
          tenantSlug={slug}
          initialProfile={profile ?? {}}
          hasExisting={!!profile}
          configured={configured}
        />
      )}
    </div>
  );
}

// Server-rendered read-only view. Iterates the same schema so what you see
// is what you get in the editor.
function ReadOnlyProfile({ profile }: { profile: Record<string, unknown> }) {
  return (
    <div className="space-y-6">
      {PROFILE_SCHEMA.map((section) => (
        <section
          key={section.key}
          className="border border-[color:var(--color-border)] rounded-lg p-5"
        >
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {section.description && (
              <p className="text-xs text-[color:var(--color-muted)] mt-0.5">{section.description}</p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            {section.fields.map((field) => {
              const value = readAtPath(profile, field.path);
              const hasValue = value !== undefined && value !== null && value !== "";
              return (
                <div key={field.path} className="text-sm">
                  <dt className="text-xs text-[color:var(--color-muted)]">{field.label}</dt>
                  <dd className="mt-0.5">
                    {hasValue ? (
                      renderReadOnlyValue(field.kind, value)
                    ) : (
                      <span className="text-[color:var(--color-muted)] italic">not set</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}

function readAtPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function renderReadOnlyValue(kind: string, value: unknown): React.ReactNode {
  const s = String(value);
  if (kind === "color") {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className="inline-block w-4 h-4 rounded border border-[color:var(--color-border)]"
          style={{ background: s }}
        />
        <code className="text-xs">{s}</code>
      </span>
    );
  }
  if (kind === "url") {
    return (
      <a href={s} className="text-emerald-400 hover:underline text-xs break-all" target="_blank" rel="noreferrer">
        {s}
      </a>
    );
  }
  if (kind === "money") {
    const n = Number(s);
    return <span>${Number.isFinite(n) ? n.toLocaleString() : s}</span>;
  }
  if (kind === "textarea") {
    return <span className="whitespace-pre-wrap">{s}</span>;
  }
  return <span>{s}</span>;
}
