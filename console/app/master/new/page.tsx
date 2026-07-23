import { isConfigured, repoUrl } from "@/lib/github";
import { provisionBusinessFromForm } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function NewBusinessPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const configured = isConfigured();

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold mb-2">New Business</h1>
      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        Add a new business (tenant) to the agency. Submitting appends a namespace
        block to <code className="text-neutral-400">bootstrap/00-namespaces.yaml</code>{" "}
        via GitHub{" "}
        {configured ? (
          <a href={repoUrl()} className="underline">
            (the platform repo)
          </a>
        ) : (
          "(the platform repo)"
        )}{" "}
        AND applies the namespace to the live cluster so it shows up immediately.
      </p>

      {!configured && (
        <div className="mb-6 p-4 border border-amber-900 rounded bg-amber-950/40 text-sm">
          <div className="font-semibold text-amber-400 mb-1">GitOps writeback not configured</div>
          <div className="text-neutral-400">
            Set <code className="text-neutral-300">GITHUB_TOKEN</code> and{" "}
            <code className="text-neutral-300">GITHUB_REPO</code> in{" "}
            <code className="text-neutral-300">console/.env.local</code> to enable this form.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 border border-red-900 rounded bg-red-950/40 text-sm text-red-400">
          {error}
        </div>
      )}

      <form action={provisionBusinessFromForm} className="flex flex-col gap-4">
        <Field label="Display name" hint="Shown in the sidebar and on cards (e.g. Pypes, HiringFunnel).">
          <input
            name="name"
            required
            placeholder="MyShop"
            className="input"
          />
        </Field>

        <Field label="Slug" hint="kebab-case; used in URLs (/<slug>) and as the label value.">
          <input
            name="slug"
            required
            pattern="[a-z0-9]([-a-z0-9]*[a-z0-9])?"
            placeholder="myshop"
            className="input"
          />
        </Field>

        <Field label="Namespace" hint="k8s namespace name. Defaults to <slug>-prod.">
          <input
            name="namespace"
            pattern="[a-z0-9]([-a-z0-9]*[a-z0-9])?"
            placeholder="myshop-prod"
            className="input"
          />
        </Field>

        <div className="flex items-center gap-3 mt-2">
          <button
            type="submit"
            disabled={!configured}
            className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
          >
            Commit + create namespace
          </button>
          <span className="text-xs text-[color:var(--color-muted)]">
            1 commit + 1 namespace. Appears in the sidebar immediately.
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
        .input:focus { outline: none; border-color: rgba(16, 185, 129, 0.6); }
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
