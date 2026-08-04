import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ensureFork, isForkReady } from "@/lib/github-fork";

const origFetch = globalThis.fetch;

function forkResponse(status: number, extra: object = {}): Response {
  return new Response(
    JSON.stringify({
      id: 999,
      name: "equity-platform",
      full_name: "alice/equity-platform",
      owner: { login: "alice" },
      ...extra,
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

beforeEach(() => {
  globalThis.fetch = origFetch;
});
afterEach(() => {
  globalThis.fetch = origFetch;
});

describe("ensureFork", () => {
  it("returns { ok: true, created: true } on 202 (new fork)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(forkResponse(202));
    const r = await ensureFork("token");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.created).toBe(true);
      expect(r.owner).toBe("alice");
      expect(r.name).toBe("equity-platform");
      expect(r.fullName).toBe("alice/equity-platform");
    }
  });

  it("returns { ok: true, created: false } on 200 (existing fork — idempotent)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(forkResponse(200));
    const r = await ensureFork("token");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.created).toBe(false);
  });

  it("returns { ok: false, error: 'org_policy' } on 403", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Fork disabled by org policy" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = await ensureFork("token");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("org_policy");
      expect(r.message).toContain("org policy");
    }
  });

  it("returns { ok: false, error: 'rate_limited' } on 429", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response("{}", { status: 429, headers: { "content-type": "application/json" } }),
    );
    const r = await ensureFork("token");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("rate_limited");
  });

  it("retries once on 5xx then succeeds", async () => {
    const fn = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 502 }))
      .mockResolvedValueOnce(forkResponse(202));
    globalThis.fetch = fn;
    const r = await ensureFork("token");
    expect(r.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns { ok: false, error: 'not_found' } on 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    const r = await ensureFork("token");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("not_found");
  });

  it("posts to /repos/{upstream}/forks with the user token", async () => {
    let capturedUrl = "";
    let capturedAuth = "";
    globalThis.fetch = vi.fn().mockImplementationOnce(async (url: string, init: RequestInit) => {
      capturedUrl = url;
      const headers = init.headers as Record<string, string>;
      capturedAuth = headers["Authorization"];
      return forkResponse(202);
    });
    await ensureFork("ghu_test");
    expect(capturedUrl).toBe(
      "https://api.github.com/repos/jaredzwick/equity-platform/forks",
    );
    expect(capturedAuth).toBe("Bearer ghu_test");
  });
});

describe("isForkReady", () => {
  it("returns true on 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect(await isForkReady("t", "alice", "equity-platform")).toBe(true);
  });
  it("returns false on 404 (fork still materializing)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response("{}", { status: 404 }));
    expect(await isForkReady("t", "alice", "equity-platform")).toBe(false);
  });
});
