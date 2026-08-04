import { test, expect } from "@playwright/test";

// E2E: click "Sign in with GitHub" on the home page → verify we redirect
// out to github.com with client_id + state + redirect_uri. We do NOT
// follow the redirect to github.com (no live App in CI). The callback
// path is exercised in callback-csrf.spec.ts.
test("home page shows sign-in CTA and /api/auth/login redirects to github.com", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "sub-agency model",
  );
  // Verify the CTA anchor points at /api/auth/login
  const cta = page.getByRole("link", { name: /Sign in with GitHub/i }).first();
  await expect(cta).toHaveAttribute("href", "/api/auth/login");

  // Hit /api/auth/login directly and confirm 3xx to github.com
  const res = await request.get("/api/auth/login", { maxRedirects: 0 });
  expect([301, 302, 303, 307, 308]).toContain(res.status());
  const loc = res.headers()["location"] ?? "";
  const url = new URL(loc);
  expect(url.hostname).toBe("github.com");
  expect(url.pathname).toBe("/login/oauth/authorize");
  expect(url.searchParams.get("client_id")).toBeTruthy();
  expect(url.searchParams.get("state")).toMatch(/^[a-f0-9]{64}$/);
  expect(url.searchParams.get("redirect_uri")).toBe(
    "http://localhost:3040/api/auth/callback",
  );

  // State cookie was set
  const cookies = res.headers()["set-cookie"] ?? "";
  expect(cookies).toContain("equity-landing-oauth-state=");
});
