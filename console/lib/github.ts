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

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const token = envRequire("GITHUB_TOKEN");
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
  const { owner, name, branch } = repo();
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
  const { owner, name, branch } = repo();
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
  const { owner, name, branch } = repo();
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
export function revertUrl(sha: string): string {
  const { owner, name } = repo();
  return `https://github.com/${owner}/${name}/commit/${sha}`;
}

export function repoUrl(): string {
  const { owner, name } = repo();
  return `https://github.com/${owner}/${name}`;
}

export function isConfigured(): boolean {
  return !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}
