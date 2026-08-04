import "server-only";

import { pypesApiUrl, lamboappBackendBearer } from "@/lib/env";
import { getSession } from "@/lib/session";

// Shared proxy for the pypes /lamboapp/buyers/* endpoints. Reads the
// iron-session for the buyer's github id, applies the shared bearer +
// X-Buyer-Github-Id header, forwards to the Go API, and returns the
// response as-is. All authed endpoints under /api/buyer/* use this.
//
// Design: keep the bearer + iron-session lookup in ONE place so a
// future rotation (bearer swap, session shape change, or moving to
// signed JWT header) lands in a single file.
//
// Not used for POST /lamboapp/buyers/upsert-by-github — the callback
// route calls that directly because the session doesn't have githubId
// yet at that point.

export type BackendCallOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string; // starting with /lamboapp/... (leading slash required)
  body?: unknown;
  query?: Record<string, string | number | undefined>;
};

export type BackendResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

// callAsBuyer forwards the current iron-session's buyer identity to the
// backend. Returns 401 when the session is missing a githubId (no
// sign-in yet) so proxy routes can render a clean 401 without hitting
// the backend.
export async function callAsBuyer<T>(opts: BackendCallOptions): Promise<BackendResult<T>> {
  const session = await getSession();
  if (!session.githubId) {
    return { ok: false, status: 401, error: "not_authenticated" };
  }

  const qs = opts.query
    ? "?" + new URLSearchParams(
        Object.entries(opts.query)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : "";

  const res = await fetch(`${pypesApiUrl()}${opts.path}${qs}`, {
    method: opts.method,
    headers: {
      "Authorization": `Bearer ${lamboappBackendBearer()}`,
      "X-Buyer-Github-Id": String(session.githubId),
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      "Accept": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    let msg = `backend_${res.status}`;
    try {
      const j = (await res.json()) as { title?: string; detail?: string };
      msg = j.detail ?? j.title ?? msg;
    } catch {
      // non-JSON body, keep the fallback msg
    }
    return { ok: false, status: res.status, error: msg };
  }

  const data = (await res.json()) as T;
  return { ok: true, status: res.status, data };
}

// Called once at OAuth-callback time to create/attach the buyer row.
// Different signature from callAsBuyer because the session doesn't
// have githubId yet — we pass the identity in the body instead of a
// header. Uses the same bearer.
export async function upsertBuyerByGithub(input: {
  githubId: number;
  githubLogin: string;
  email: string;
  avatarUrl?: string;
  firstName?: string;
  lastName?: string;
}): Promise<BackendResult<{
  buyer_id: string;
  email: string;
  tier: string;
  has_buy_box: boolean;
  was_created: boolean;
}>> {
  const res = await fetch(`${pypesApiUrl()}/lamboapp/buyers/upsert-by-github`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lamboappBackendBearer()}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      github_id: input.githubId,
      github_login: input.githubLogin,
      email: input.email,
      avatar_url: input.avatarUrl ?? "",
      first_name: input.firstName ?? "",
      last_name: input.lastName ?? "",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    let msg = `backend_${res.status}`;
    try {
      const j = (await res.json()) as { title?: string; detail?: string };
      msg = j.detail ?? j.title ?? msg;
    } catch {
      // non-JSON, keep fallback
    }
    return { ok: false, status: res.status, error: msg };
  }
  const data = (await res.json()) as {
    buyer_id: string;
    email: string;
    tier: string;
    has_buy_box: boolean;
    was_created: boolean;
  };
  return { ok: true, status: res.status, data };
}
