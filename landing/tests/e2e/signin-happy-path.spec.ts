import { test, expect } from "@playwright/test";

// GitHub OAuth was pulled from the landing UI on 2026-08-06 because the
// live flow was broken in prod on lamboapp.com. The primary opt-in is now
// the name+phone form at /signup. This spec pins that expectation so the
// GH CTA doesn't quietly return without an owner.
test("home page primary CTA routes to /signup, not the GH OAuth entry", async ({
  page,
}) => {
  await page.goto("/");

  const cta = page.getByRole("link", { name: /Get on the list/i }).first();
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/signup");

  // No visible "Sign in with GitHub" affordance on the home page.
  const ghCta = page.getByRole("link", { name: /Sign in with GitHub/i });
  await expect(ghCta).toHaveCount(0);
});
