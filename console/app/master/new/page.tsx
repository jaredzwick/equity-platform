import Link from "next/link";
import { isConfigured, repoUrl } from "@/lib/github";
import ValidatedInput from "@/components/ValidatedInput";
import { provisionBusinessFromForm } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function NewBusinessPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const configured = isConfigured();
  const configuredRepoUrl = configured ? await repoUrl() : null;

  return (
    <div className="max-w-xl">
      <Link
        href="/master"
        className="inline-flex items-center gap-1 text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] mb-4"
      >
        ← Businesses
      </Link>

      <h1 className="text-2xl font-semibold mb-2">New Business</h1>
      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        Add a new business (tenant) to the agency. Submitting appends a namespace
        block to <code className="text-neutral-400">bootstrap/00-namespaces.yaml</code>{" "}
        via GitHub{" "}
        {configured ? (
          <>
            (<a href={configuredRepoUrl ?? "#"} className="underline">the platform repo</a>)
          </>
        ) : (
          "(the platform repo)"
        )}{" "}
        AND applies the namespace to the live cluster so it shows up immediately.
      </p>

      {!configured && (
        <div className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">GitOps writeback not configured</div>
          <div className="text-neutral-300">
            Set <code className="text-neutral-100">GITHUB_TOKEN</code> and{" "}
            <code className="text-neutral-100">GITHUB_REPO</code> in{" "}
            <code className="text-neutral-100">console/.env.local</code>.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          {error}
        </div>
      )}

      <form action={provisionBusinessFromForm} className="flex flex-col gap-4">
        <ValidatedInput
          name="name"
          label="Display name"
          validator="displayName"
          required
          hint="Shown in the sidebar and on cards (e.g. Pypes, HiringFunnel)."
        />

        <ValidatedInput
          name="slug"
          label="Slug"
          validator="slug"
          required
          hint="kebab-case; used in URLs (/<slug>) and as the label value."
        />

        <ValidatedInput
          name="namespace"
          label="Namespace"
          validator="namespace"
          hint="k8s namespace name. Defaults to <slug>-prod."
        />

        <div className="flex items-center gap-3 mt-2">
          <button
            type="submit"
            disabled={!configured}
            className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed font-medium text-sm"
          >
            Commit + create namespace
          </button>
          <span className="text-xs text-[color:var(--color-muted)]">
            1 commit + 1 namespace. Appears in the sidebar immediately.
          </span>
        </div>
      </form>
    </div>
  );
}
