import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { authorizeUrl, exchangeCodeForToken } from "@/lib/github-oauth-web";

describe("authorizeUrl", () => {
  it("builds a github.com authorize URL with client_id, redirect_uri, state", () => {
    const url = new URL(authorizeUrl("abc123"));
    expect(url.hostname).toBe("github.com");
    expect(url.pathname).toBe("/login/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("Iv1.testclientid");
    expect(url.searchParams.get("state")).toBe("abc123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://landing.example.test/api/auth/callback",
    );
    // GitHub Apps do NOT accept `scope` on the authorize URL.
    expect(url.searchParams.get("scope")).toBeNull();
  });
});

describe("exchangeCodeForToken", () => {
  const origFetch = globalThis.fetch;
  beforeEach(() => {
    // reset fetch on every test
    globalThis.fetch = origFetch;
  });
  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("returns { ok: true, accessToken } on 200 with access_token", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "ghu_fake123",
          token_type: "bearer",
          scope: "",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const r = await exchangeCodeForToken("code_abc");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.accessToken).toBe("ghu_fake123");
      expect(r.tokenType).toBe("bearer");
    }
  });

  it("returns { ok: false, error } when GitHub returns an error payload", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "bad_verification_code",
          error_description: "The code passed is incorrect or expired.",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const r = await exchangeCodeForToken("bad_code");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("bad_verification_code");
      expect(r.description).toContain("incorrect or expired");
    }
  });

  it("returns { ok: false, error: http_N } on non-2xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response("upstream boom", { status: 502 }),
    );
    const r = await exchangeCodeForToken("code_abc");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("http_502");
  });

  it("throws on network failure", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("ENETDOWN"));
    await expect(exchangeCodeForToken("code_abc")).rejects.toThrow("ENETDOWN");
  });

  it("posts the code + client credentials in the request body", async () => {
    let capturedBody = "";
    globalThis.fetch = vi.fn().mockImplementationOnce(async (_url: string, init: RequestInit) => {
      capturedBody = String(init.body);
      return new Response(
        JSON.stringify({ access_token: "t" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    await exchangeCodeForToken("code_xyz");
    const body = JSON.parse(capturedBody);
    expect(body.code).toBe("code_xyz");
    expect(body.client_id).toBe("Iv1.testclientid");
    expect(body.client_secret).toBe("test-client-secret-value");
    expect(body.redirect_uri).toBe("https://landing.example.test/api/auth/callback");
  });
});
