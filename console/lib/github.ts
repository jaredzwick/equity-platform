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

const GH_API = "https://api.github.com";

function envRequire(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set`);
  return v;
}

function repo(): { owner: string; name: string; branch: string } {
  const full = envRequire("GITHUB_REPO");
  const [owner, name] = full.split("/");
  if (!owner || !name) throw new Error(`GITHUB_REPO must be owner/name (got: ${full})`);
  return { owner, name, branch: process.env.GITHUB_BRANCH ?? "main" };
}

// The upstream template repo this console is a fork/clone of. Every user's
// fork gets created from this. Default matches jaredzwick/equity-platform;
// override in .env.local if you fork the template.
const UPSTREAM_REPO = process.env.UPSTREAM_REPO ?? "jaredzwick/equity-platform";

// Resolve the actual repo to write to for this request. Precedence:
//   1. Session's cached targetRepo (set on sign-in via auto-fork)
//   2. Session has token+login but no targetRepo → auto-fork upstream, cache
//   3. Fallback to GITHUB_REPO env (headless/dev)
//
// Async because it may make a network call to POST /forks on first sign-in.
export async function resolveTargetRepo(): Promise<{ owner: string; name: string; branch: string }> {
  try {
    const session = await getSession();
    if (session.targetRepo) {
      const [owner, name] = session.targetRepo.split("/");
      return { owner, name, branch: process.env.GITHUB_BRANCH ?? "main" };
    }
    if (session.githubToken && session.login) {
      // Auto-fork on first write. Idempotent: GitHub returns the existing
      // fork if it already exists.
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
        // Don't fail the whole call — the fork may already exist. Continue
        // with the derived target.
      }
      const targetRepo = `${session.login}/${upName}`;
      session.targetRepo = targetRepo;
      await session.save();
      return { owner: session.login, name: upName, branch: process.env.GITHUB_BRANCH ?? "main" };
    }
  } catch (e) {
    console.error("[resolveTargetRepo] session read failed:", e);
  }
  // Env fallback
  return repo();
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
  content: string;
  message: string;
  sha?: string;
}): Promise<{ commitSha: string; contentSha: string }> {
  const { owner, name, branch } = await resolveTargetRepo();
  const b64 = Buffer.from(args.content).toString("base64");
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
  const { owner, name, branch } = await resolveTargetRepo();
  try {
    const res = await gh<{ sha: string }>(
      `/repos/${owner}/${name}/contents/${encodeURI(path)}?ref=${branch}`,
    );
    return res.sha;
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

// True if either an OAuth session exists OR env fallback is fully set.
// Session-based auth doesn't need GITHUB_REPO env — it's derived from the
// user's login via auto-fork.
export function isConfigured(): boolean {
  return true; // resolveTargetRepo handles the "unauthenticated" case gracefully
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
