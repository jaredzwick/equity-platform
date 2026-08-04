import { describe, expect, it, beforeEach, afterEach } from "vitest";

// env.ts caches nothing; reads process.env on each call. Reset per test.
const origEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...origEnv };
});
afterEach(() => {
  process.env = { ...origEnv };
});

async function loadEnv() {
  // Re-import fresh each time to bypass module cache.
  return await import("@/lib/env?" + Date.now()) as typeof import("@/lib/env");
}

describe("env", () => {
  it("throws when GITHUB_APP_CLIENT_ID is missing", async () => {
    delete process.env.GITHUB_APP_CLIENT_ID;
    const env = await loadEnv();
    expect(() => env.githubClientId()).toThrow(/GITHUB_APP_CLIENT_ID/);
  });

  it("throws when GITHUB_APP_CLIENT_SECRET is missing", async () => {
    delete process.env.GITHUB_APP_CLIENT_SECRET;
    const env = await loadEnv();
    expect(() => env.githubClientSecret()).toThrow(/GITHUB_APP_CLIENT_SECRET/);
  });

  it("parses UPSTREAM_REPO into owner/name", async () => {
    process.env.UPSTREAM_REPO = "octocat/hello-world";
    const env = await loadEnv();
    expect(env.upstreamRepo()).toEqual({ owner: "octocat", name: "hello-world" });
  });

  it("throws when UPSTREAM_REPO is malformed", async () => {
    process.env.UPSTREAM_REPO = "no-slash";
    const env = await loadEnv();
    expect(() => env.upstreamRepo()).toThrow(/owner\/name/);
  });

  it("builds callbackUrl from NEXT_PUBLIC_SITE_URL", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://foo.example.com/";
    const env = await loadEnv();
    expect(env.callbackUrl()).toBe("https://foo.example.com/api/auth/callback");
  });

  it("falls back to VERCEL_URL when NEXT_PUBLIC_SITE_URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_URL = "preview-abc.vercel.app";
    const env = await loadEnv();
    expect(env.siteUrl()).toBe("https://preview-abc.vercel.app");
  });

  it("allows short SESSION_PASSWORD in dev, throws in prod", async () => {
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.SESSION_PASSWORD = "";
    let env = await loadEnv();
    expect(() => env.sessionPassword()).not.toThrow();

    (process.env as Record<string, string>).NODE_ENV = "production";
    env = await loadEnv();
    expect(() => env.sessionPassword()).toThrow(/32/);
  });
});
