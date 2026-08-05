"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { disableBackup, enableBackup } from "./actions";

type Props = {
  enabled: boolean;
  repoUrl?: string;
  branch?: string;
};

// UI for opting in / out of GitHub backup. Local file-backed
// (local/.config.json) — no k8s ConfigMap because up.sh reads this
// BEFORE the cluster exists.
export default function BackupCard({ enabled, repoUrl, branch }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState(repoUrl ?? "");
  const [branchInput, setBranchInput] = useState(branch ?? "main");

  async function onEnableSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await enableBackup(fd);
    if (!res.ok) {
      setError(res.error ?? "failed to save");
      return;
    }
    setEditing(false);
    startTransition(() => router.refresh());
  }

  async function onDisable() {
    setError(null);
    const res = await disableBackup();
    if (!res.ok) {
      setError(res.error ?? "failed to disable");
      return;
    }
    startTransition(() => router.refresh());
  }

  const showForm = editing || !enabled;

  return (
    <div className="border border-[color:var(--color-border)] rounded-lg">
      <div className="px-4 py-2.5 border-b border-[color:var(--color-border)] flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-[color:var(--color-muted)]">
          GitHub backup
        </div>
        <StatusPill enabled={enabled} />
      </div>

      <div className="p-4 text-sm space-y-3">
        {!enabled && !editing && (
          <>
            <p className="text-neutral-300">
              GitHub backup is <span className="text-neutral-100 font-medium">off</span>.
              Businesses live only in this local kind cluster and are lost on{" "}
              <code>local/down.sh</code>. Enable to have ArgoCD reconcile from
              your fork and have every provisioning action land as a git commit.
            </p>
            <button
              onClick={() => setEditing(true)}
              className="text-xs px-3 py-1.5 rounded border border-emerald-700/60 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-950/70"
            >
              Enable GitHub backup
            </button>
          </>
        )}

        {enabled && !editing && (
          <>
            <div className="grid grid-cols-[9rem_1fr] gap-3 items-baseline">
              <div className="text-[color:var(--color-muted)] text-xs">Backup target</div>
              <a
                href={repoUrl?.replace(/\.git$/, "")}
                target="_blank"
                rel="noreferrer"
                className="underline text-emerald-400 text-xs"
              >
                <code>{repoUrl}</code>
              </a>
            </div>
            <div className="grid grid-cols-[9rem_1fr] gap-3 items-baseline">
              <div className="text-[color:var(--color-muted)] text-xs">Branch</div>
              <code className="text-xs">{branch ?? "main"}</code>
            </div>
            <div className="text-xs text-neutral-500">
              Applies to future <code>up.sh</code> runs. To repoint the
              currently-running ArgoCD Application, run{" "}
              <code>./local/down.sh && ./local/up.sh</code>.
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditing(true)}
                className="text-xs px-3 py-1.5 rounded border border-[color:var(--color-border)] hover:bg-white/5"
              >
                Change
              </button>
              <button
                onClick={onDisable}
                disabled={isPending}
                className="text-xs px-3 py-1.5 rounded border border-amber-700/60 text-amber-200 hover:bg-amber-950/40 disabled:opacity-50"
              >
                Disable
              </button>
            </div>
          </>
        )}

        {showForm && (
          <form onSubmit={onEnableSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-xs text-[color:var(--color-muted)]">
                Repo URL — full HTTPS URL to your fork
              </label>
              <input
                name="repoUrl"
                type="url"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://github.com/pypesdev/equity-platform.git"
                className="w-full p-2 rounded border border-[color:var(--color-border)] bg-black/40 text-sm focus:outline-none focus:border-emerald-600 font-mono"
              />
              <p className="text-[11px] text-neutral-500">
                Must be a GitHub HTTPS URL. Fork the upstream template first if
                you haven&apos;t: <code>github.com/&lt;you&gt;/equity-platform</code>.
              </p>
            </div>
            <div className="space-y-1">
              <label className="block text-xs text-[color:var(--color-muted)]">
                Branch
              </label>
              <input
                name="branch"
                type="text"
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                className="w-full p-2 rounded border border-[color:var(--color-border)] bg-black/40 text-sm focus:outline-none focus:border-emerald-600 font-mono"
              />
            </div>
            {error && (
              <div className="text-xs text-red-400 border border-red-900/50 bg-red-950/40 rounded p-2">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={isPending || !urlInput.trim()}
                className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError(null);
                    setUrlInput(repoUrl ?? "");
                    setBranchInput(branch ?? "main");
                  }}
                  className="text-xs px-3 py-1.5 rounded border border-[color:var(--color-border)] hover:bg-white/5"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusPill({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={
        "inline-block px-2 py-0.5 rounded text-xs " +
        (enabled
          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60"
          : "bg-neutral-800/80 text-neutral-300 border border-neutral-700")
      }
    >
      {enabled ? "ON" : "OFF"}
    </span>
  );
}
