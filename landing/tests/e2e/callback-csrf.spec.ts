import { test, expect } from "@playwright/test";

// The callback route must reject state mismatches (CSRF) with a redirect
// to /?error=csrf. This test skips actually hitting github.com — it just
// pokes /api/auth/callback with a bad state and confirms the guard fires.
test("callback rejects state mismatch (CSRF)", async ({ request, context }) => {
  // Prime the state cookie so we know the callback's compare has something
  // to compare against.
  await context.addCookies([
    {
      name: "equity-landing-oauth-state",
      value: "REAL_STATE",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  const res = await request.get(
    "/api/auth/callback?code=abc&state=WRONG_STATE",
    { maxRedirects: 0 },
  );
  expect([301, 302, 303, 307, 308]).toContain(res.status());
  const loc = res.headers()["location"] ?? "";
  const url = new URL(loc);
  expect(url.pathname).toBe("/");
  expect(url.searchParams.get("error")).toBe("csrf");
});

test("callback rejects missing code+state", async ({ request }) => {
  const res = await request.get("/api/auth/callback", { maxRedirects: 0 });
  expect([301, 302, 303, 307, 308]).toContain(res.status());
  const loc = res.headers()["location"] ?? "";
  expect(new URL(loc).searchParams.get("error")).toBe("missing_code_or_state");
});

test("callback forwards GitHub-returned OAuth errors", async ({ request }) => {
  const res = await request.get(
    "/api/auth/callback?error=access_denied",
    { maxRedirects: 0 },
  );
  const loc = res.headers()["location"] ?? "";
  expect(new URL(loc).searchParams.get("error")).toBe("oauth_access_denied");
});
