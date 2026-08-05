// GitHub Contents + Git-Data API wrapper for the GitOps writeback flow.
//
// Auth: fine-grained PAT with `contents: write` on the platform repo. Store
// in env var GITHUB_TOKEN. Locally: console/.env.local. In-cluster: mount as
// a k8s Secret via ExternalSecret.
//
// Repo target: GITHUB_REPO (owner/name form, e.g. "jaredzwick/equity-platform")
// and GITHUB_BRANCH (default "main").
//
// Design: we create files via the Contents API one at a time. That produces
// one commit per file. For our use case (provision a new app = 2 files:
// apps/<name>.yaml + charts/<name>/values.yaml), we live with 2 commits per
// provisioning. If atomicity matters later, upgrade to the Git Data API
// (create blob → create tree → create commit → update ref).

import { getSession } from "@/lib/session";
import { readBackupConfig, repoSlugFrom } from "@/lib/backup-config";

const GH_API = "https://api.github.com";

// The upstream template repo this console is a fork/clone of. Used only
// as the fork source when a user has an auto-fork session flow — never
// as a default write target. Overridable via UPSTREAM_REPO env for
// downstream forks of the OSS project.
const UPSTREAM_REPO = process.env.UPSTREAM_REPO ?? "jaredzwick/equity-platform";

export class BackupDisabledError extends Error {
  constructor() {
    super(
      "GitHub backup is disabled. Enable it in Agency settings → GitHub, " +
        "or set GITHUB_REPO in the console env for a headless override.",
    );
    this.name = "BackupDisabledError";
  }
}

// Resolve the actual repo to write to for this request. Precedence:
//   1. local/.config.json (githubBackup.repoUrl) — the UI-managed opt-in
//   2. Session's cached targetRepo (set on sign-in via auto-fork)
//   3. Session has token+login but no targetRepo → auto-fork upstream, cache
//   4. GITHUB_REPO env — headless/dev override
//   5. THROW — no more silent default. Backup is opt-in.
//
// Async because it may read a file OR make a network call to POST /forks.
export async function resolveTargetRepo(): Promise<{ owner: string; name: string; branch: string }> {
  // 1) Explicit UI-managed backup config wins.
  try {
    const cfg = await readBackupConfig();
    const slug = repoSlugFrom(cfg);
    if (cfg.githubBackup.enabled && slug) {
      const [owner, name] = slug.split("/");
      return {
        owner,
        name,
        branch: cfg.githubBackup.branch ?? process.env.GITHUB_BRANCH ?? "main",
      };
    }
  } catch (e) {
    console.error("[resolveTargetRepo] backup-config read failed:", e);
    // Fall through — the other paths still work.
  }

  // 2 + 3) Session-based flow.
  try {
    const session = await getSession();
    if (session.targetRepo) {
      const [owner, name] = session.targetRepo.split("/");
      return { owner, name, branch: process.env.GITHUB_BRANCH ?? "main" };
    }
    if (session.githubToken && session.login) {
      const [upOwner, upName] = UPSTREAM_REPO.split("/");
      try {
        const res = await fetch(`${GH_API}/repos/${upOwner}/${upName}/forks`, {
          method: "POST",
          headers: {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Authorization": `Bearer ${session.githubToken}`,
            "Content-Type": "application/json",
          },
          body: "{}",
        });
        if (!res.ok && res.status !== 202) {
          const body = await res.text();
          throw new Error(`POST /forks → ${res.status}: ${body.slice(0, 200)}`);
        }
      } catch (e) {
        console.error("[auto-fork] failed:", e);
      }
      const targetRepo = `${session.login}/${upName}`;
      session.targetRepo = targetRepo;
      await session.save();
      return { owner: session.login, name: upName, branch: process.env.GITHUB_BRANCH ?? "main" };
    }
  } catch (e) {
    console.error("[resolveTargetRepo] session read failed:", e);
  }

  // 4) Env fallback for headless / CI setups.
  const envRepo = process.env.GITHUB_REPO;
  if (envRepo) {
    const [owner, name] = envRepo.split("/");
    if (!owner || !name) {
      throw new Error(`GITHUB_REPO must be owner/name (got: ${envRepo})`);
    }
    return { owner, name, branch: process.env.GITHUB_BRANCH ?? "main" };
  }

  // 5) No default anymore — opt-in required.
  throw new BackupDisabledError();
}

// Auth precedence:
//  1. User session token (from the GitHub App OAuth device flow) — normal path
//  2. GITHUB_TOKEN env var — dev fallback / CI / headless setups
export async function authToken(): Promise<string> {
  try {
    const session = await getSession();
    if (session.githubToken) return session.githubToken;
  } catch {
    // getSession may fail outside a request context (e.g., unit tests). Fall
    // through to env token.
  }
  const envToken = process.env.GITHUB_TOKEN;
  if (envToken) return envToken;
  throw new Error("Not authenticated — sign in with GitHub or set GITHUB_TOKEN in .env.local");
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await authToken();
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub ${init?.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// PUT contents/{path} creates or updates a file. Returns the commit SHA
// created by GitHub. Requires the CURRENT sha to update an existing file;
// omit for new files.
export async function putFile(args: {
  path: string;
  // Text (utf-8) OR binary (Buffer/Uint8Array — e.g. PNG bytes for logo commits).
  content: string | Buffer | Uint8Array;
  message: string;
  sha?: string;
}): Promise<{ commitSha: string; contentSha: string }> {
  const { owner, name, branch } = await resolveTargetRepo();
  const buf = typeof args.content === "string"
    ? Buffer.from(args.content, "utf8")
    : Buffer.from(args.content);
  const b64 = buf.toString("base64");
  const body = JSON.stringify({
    message: args.message,
    content: b64,
    branch,
    ...(args.sha ? { sha: args.sha } : {}),
  });
  const res = await gh<{ commit: { sha: string }; content: { sha: string } }>(
    `/repos/${owner}/${name}/contents/${encodeURI(args.path)}`,
    { method: "PUT", body },
  );
  return { commitSha: res.commit.sha, contentSha: res.content.sha };
}

// Get a file's current sha (needed for update) — returns null if not found.
export async function getFileSha(path: string): Promise<string | null> {
  const f = await getFile(path);
  return f?.sha ?? null;
}

// Fetch a file's sha + decoded content in one call. Uses the Contents API on
// the session-resolved repo so it works for private repos + user forks (unlike
// raw.githubusercontent.com, which doesn't accept fine-grained PATs / OAuth
// tokens reliably).
export async function getFile(path: string): Promise<{ sha: string; content: string } | null> {
  const { owner, name, branch } = await resolveTargetRepo();
  try {
    const res = await gh<{ sha: string; content: string; encoding: string }>(
      `/repos/${owner}/${name}/contents/${encodeURI(path)}?ref=${branch}`,
    );
    const content = res.encoding === "base64"
      ? Buffer.from(res.content, "base64").toString("utf8")
      : res.content;
    return { sha: res.sha, content };
  } catch (e) {
    if (e instanceof Error && e.message.includes("404")) return null;
    throw e;
  }
}

// List recent commits on the branch.
export type Commit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
};

export async function listCommits(limit = 30): Promise<Commit[]> {
  const { owner, name, branch } = await resolveTargetRepo();
  const raw = await gh<Array<{
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
    html_url: string;
  }>>(`/repos/${owner}/${name}/commits?sha=${branch}&per_page=${limit}`);
  return raw.map((c) => ({
    sha: c.sha,
    message: c.commit.message.split("\n")[0],
    author: c.commit.author.name,
    date: c.commit.author.date,
    url: c.html_url,
  }));
}

// Revert a commit by opening a link on GitHub (server-side revert is a
// multi-step Git Data API dance; for MVP we hand off to GitHub UI).
// Async: consults the session-resolved target repo (user's fork).
export async function revertUrl(sha: string): Promise<string> {
  const { owner, name } = await resolveTargetRepo();
  return `https://github.com/${owner}/${name}/commit/${sha}`;
}

export async function repoUrl(): Promise<string> {
  const { owner, name } = await resolveTargetRepo();
  return `https://github.com/${owner}/${name}`;
}

// Raw file URL on the session-resolved fork. Works for public forks without
// auth (private forks would need a token — use getFile there instead).
export async function rawUrl(path: string): Promise<string> {
  const { owner, name, branch } = await resolveTargetRepo();
  return `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${path}`;
}

// True if GitHub backup is enabled AND a write target resolves. Callers
// use this before invoking put/get to give a clean "backup disabled"
// UX instead of a stack trace.
export async function isConfigured(): Promise<boolean> {
  try {
    await resolveTargetRepo();
    return true;
  } catch {
    return false;
  }
}

// Async: true if we have a real token from anywhere (session or env).
export async function isAuthenticated(): Promise<boolean> {
  try {
    await authToken();
    return true;
  } catch {
    return false;
  }
}
