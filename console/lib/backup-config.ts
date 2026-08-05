import "server-only";

// GitHub backup config for the platform. Local-first: state lives at
// local/.config.json (relative to the repo root, gitignored). Read by
// both the console (to resolve write targets) and by local/up.sh (to
// know what repo ArgoCD should reconcile from).
//
// Not a k8s ConfigMap because the config governs how the CLUSTER itself
// is wired (which repo ArgoCD talks to), so we need to read it BEFORE
// the cluster exists. A file on disk is the simplest source-of-truth
// that survives that bootstrap.
//
// Design:
// - Defaults to OFF. Users opt in via /master/github settings.
// - When OFF: LOCAL-ONLY mode. No ArgoCD-from-remote, no console
//   write-back to GitHub. Cluster is ephemeral; teardown loses businesses.
// - When ON: user provides their fork URL. up.sh points ArgoCD at it;
//   console writes to it via the GitHub Contents API (auth via session
//   OAuth or GITHUB_TOKEN env fallback).

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Resolves to <repo-root>/local/.config.json regardless of where the
// console process was started from. process.cwd() when running under
// `next dev` in console/ is the console dir; go up one to reach the repo root.
function configPath(): string {
  return path.resolve(process.cwd(), "..", "local", ".config.json");
}

export type BackupConfig = {
  githubBackup: {
    enabled: boolean;
    repoUrl?: string; // full URL like https://github.com/pypesdev/equity-platform.git
    branch?: string; // defaults to "main" if unset
  };
};

// Read + parse; returns a normalized "disabled" config if the file is
// missing. Malformed JSON throws — we want to surface a broken config
// rather than silently falling back (the fallback could accidentally
// re-enable auto-injects).
export async function readBackupConfig(): Promise<BackupConfig> {
  let raw: string;
  try {
    raw = await readFile(configPath(), "utf8");
  } catch (e) {
    if (isNotFound(e)) return normalize({});
    throw e;
  }
  const parsed = JSON.parse(raw) as Partial<BackupConfig>;
  return normalize(parsed);
}

// Full replace (not merge). Callers should read → mutate → write.
// Validates the repoUrl shape before writing so a bad save doesn't
// permanently point ArgoCD at garbage.
export async function writeBackupConfig(cfg: BackupConfig): Promise<void> {
  const normalized = normalize(cfg);
  if (normalized.githubBackup.enabled) {
    if (!normalized.githubBackup.repoUrl) {
      throw new Error("repoUrl required when githubBackup.enabled is true");
    }
    if (!isGithubUrl(normalized.githubBackup.repoUrl)) {
      throw new Error(
        `repoUrl must be a GitHub HTTPS URL like https://github.com/<owner>/<repo>.git — got: ${normalized.githubBackup.repoUrl}`,
      );
    }
  }
  const target = configPath();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(normalized, null, 2) + "\n", "utf8");
}

// Extract owner/name from a stored repoUrl. Returns null when config is
// off or when the URL is malformed (defensive — normalize+write should
// already have caught this).
export function repoSlugFrom(cfg: BackupConfig): string | null {
  if (!cfg.githubBackup.enabled || !cfg.githubBackup.repoUrl) return null;
  const m = cfg.githubBackup.repoUrl.match(
    /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
  );
  return m ? `${m[1]}/${m[2]}` : null;
}

function normalize(cfg: Partial<BackupConfig>): BackupConfig {
  const enabled = !!cfg.githubBackup?.enabled;
  const repoUrl = cfg.githubBackup?.repoUrl?.trim() || undefined;
  const branch = cfg.githubBackup?.branch?.trim() || "main";
  return { githubBackup: { enabled, repoUrl, branch } };
}

function isGithubUrl(url: string): boolean {
  return /^https:\/\/github\.com\/[^/]+\/[^/]+?(\.git)?$/.test(url);
}

function isNotFound(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "ENOENT"
  );
}
