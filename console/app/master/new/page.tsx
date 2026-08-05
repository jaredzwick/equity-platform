import Link from "next/link";
import { canWriteToRepo } from "@/lib/github";
import { provisionBusinessFromForm } from "./actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function NewBusinessPage({ searchParams }: Props) {
  const { error } = await searchParams;
  // "Configured and working" — surface the GitHub-backed path only when the
  // token actually has push access. This is the difference between "config
  // says we have a repo" and "we can really commit." Users see the git-write
  // messaging only when the write will actually succeed.
  const canCommit = await canWriteToRepo();

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
        Add a business (tenant) to the agency. Give it a URL or a name —
        we'll derive the slug and namespace from that. Applies to the live
        cluster so it appears in the sidebar immediately
        {canCommit
          ? ", and commits the namespace definition to git so it's recreated on every rebuild."
          : "."}
      </p>

      {error && (
        <div className="mb-6 p-4 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          {error}
        </div>
      )}

      <form action={provisionBusinessFromForm} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-[color:var(--color-fg)]">
            Business URL or name
            <span className="text-red-400 ml-1">*</span>
          </span>
          <input
            name="input"
            required
            autoFocus
            placeholder="myshop.com"
            className="w-full px-3 py-2 rounded border border-[color:var(--color-border)] bg-white/[0.03] text-sm text-[color:var(--color-fg)] font-mono focus:outline-none focus:border-emerald-600/60"
          />
          <span className="text-[11px] text-[color:var(--color-muted)]">
            e.g. <code>myshop.com</code>, <code>https://app.hiringfunnel.co.uk</code>,
            or a bare name like <code>hiring-funnel</code>. We derive slug,
            display name, and Kubernetes namespace from this.
          </span>
        </label>

        <div className="flex items-center gap-3 mt-2">
          <button
            type="submit"
            className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-500 font-medium text-sm"
          >
            {canCommit ? "Create business (commit + apply)" : "Create business"}
          </button>
          <span className="text-xs text-[color:var(--color-muted)]">
            {canCommit
              ? "1 commit + 1 namespace. Appears in the sidebar immediately."
              : "1 namespace. Appears in the sidebar immediately."}
          </span>
        </div>

        {!canCommit && (
          <p className="text-[11px] text-[color:var(--color-muted)] mt-1">
            Namespace will be applied to the live cluster only. To have it
            recreated on rebuild, enable GitHub backup on the GitHub tab.
          </p>
        )}
      </form>
    </div>
  );
}
