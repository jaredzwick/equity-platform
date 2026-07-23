import { isConfigured, listCommits, repoUrl, revertUrl } from "@/lib/github";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tenant: string }> };

export default async function HistoryPage({ params }: Props) {
  const { tenant: slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  if (!isConfigured()) {
    return (
      <div className="max-w-3xl">
        <div className="p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm">
          <div className="font-semibold text-amber-200 mb-1">Console not configured for GitOps writeback</div>
          <div className="text-neutral-400">
            Set <code className="text-neutral-300">GITHUB_TOKEN</code> and{" "}
            <code className="text-neutral-300">GITHUB_REPO</code> to see commit history. See{" "}
            <code className="text-neutral-300">console/.env.example</code>.
          </div>
        </div>
      </div>
    );
  }

  let commits: Awaited<ReturnType<typeof listCommits>> = [];
  let err: string | null = null;
  try {
    commits = await listCommits(30);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  const isMaster = slug === MASTER_SLUG;
  const filtered = isMaster
    ? commits
    : commits.filter((c) => c.message.includes(`(${slug})`) || c.message.includes(`/${slug}/`));

  return (
    <div className="max-w-4xl">
      <p className="text-sm text-[color:var(--color-muted)] mb-6">
        Every commit to <a href={repoUrl()} className="underline">the platform repo</a>. Revert opens the
        commit on GitHub — one click, GitHub creates a revert PR, merge it, ArgoCD reconciles the previous state.
      </p>

      {err && (
        <div className="mb-6 p-4 border border-red-900 rounded bg-red-950/40 text-sm text-red-400">
          {err}
        </div>
      )}

      <div className="border border-[color:var(--color-border)] rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left text-xs uppercase text-[color:var(--color-muted)]">
              <th className="p-3">Commit</th>
              <th className="p-3">Message</th>
              <th className="p-3">Author</th>
              <th className="p-3">When</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-[color:var(--color-muted)]">
                  No commits {isMaster ? "in the repo" : `mentioning ${tenant.name}`}.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.sha} className="border-t border-[color:var(--color-border)]">
                <td className="p-3 font-mono text-xs">
                  <a href={c.url} className="hover:underline text-[color:var(--color-muted)]">
                    {c.sha.slice(0, 7)}
                  </a>
                </td>
                <td className="p-3">{c.message}</td>
                <td className="p-3 text-[color:var(--color-muted)]">{c.author}</td>
                <td className="p-3 text-[color:var(--color-muted)] text-xs">
                  {new Date(c.date).toLocaleString()}
                </td>
                <td className="p-3">
                  <a
                    href={revertUrl(c.sha)}
                    className="text-xs text-red-400 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    revert →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
