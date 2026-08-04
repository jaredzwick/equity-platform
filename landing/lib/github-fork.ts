import "server-only";
import { upstreamRepo } from "@/lib/env";

export type ForkResult =
  | { ok: true; owner: string; name: string; created: boolean; fullName: string; id: number }
  | { ok: false; error: "org_policy" | "rate_limited" | "not_found" | "unknown"; status: number; message: string };

// POST /repos/{owner}/{repo}/forks — idempotent. If the fork already exists
// GitHub returns 202 and the existing fork. Async — GitHub may still be
// materializing the fork; caller polls readiness via GET /repos.
//
// Retries once on 5xx. Never throws for GitHub-side errors — returns a
// tagged failure so callers can render a specific message.
export async function ensureFork(token: string): Promise<ForkResult> {
  const upstream = upstreamRepo();
  const path = `https://api.github.com/repos/${upstream.owner}/${upstream.name}/forks`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });

    if (res.status === 202 || res.status === 200) {
      const data = (await res.json()) as {
        id: number;
        name: string;
        full_name: string;
        owner: { login: string };
      };
      return {
        ok: true,
        owner: data.owner.login,
        name: data.name,
        fullName: data.full_name,
        id: data.id,
        created: res.status === 202,
      };
    }

    // Retriable
    if (res.status >= 500 && attempt === 0) {
      await sleep(500);
      continue;
    }

    const body = await safeReadJson(res);

    if (res.status === 403) {
      return {
        ok: false,
        error: "org_policy",
        status: res.status,
        message: body.message ?? "Forbidden — check org fork policy or App permissions.",
      };
    }
    if (res.status === 429) {
      return { ok: false, error: "rate_limited", status: res.status, message: "Rate limited by GitHub." };
    }
    if (res.status === 404) {
      return { ok: false, error: "not_found", status: res.status, message: body.message ?? "Upstream repo not found." };
    }
    return {
      ok: false,
      error: "unknown",
      status: res.status,
      message: body.message ?? `GitHub returned ${res.status}`,
    };
  }

  return { ok: false, error: "unknown", status: 0, message: "Exhausted retries" };
}

// GET /repos/{owner}/{name} — returns true once GitHub has finished
// materializing the fork. Called by the client-side poll on /onboarding.
export async function isForkReady(
  token: string,
  owner: string,
  name: string,
): Promise<boolean> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${name}`,
    {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );
  return res.ok;
}

async function safeReadJson(res: Response): Promise<{ message?: string }> {
  try {
    return (await res.json()) as { message?: string };
  } catch {
    return {};
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
