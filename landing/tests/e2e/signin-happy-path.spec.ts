import { test, expect } from "@playwright/test";

// GitHub OAuth was pulled from the landing UI on 2026-08-06 because the
// live flow was broken in prod on lamboapp.com. The /signup lead-capture
// surface was then consolidated into /join on 2026-10-15 so cold traffic
// hits a single funnel. This spec pins that: the hero's primary CTA
// routes to /join, and no stray GH OAuth affordance has returned.
test("home page primary CTA routes to /join, not the GH OAuth entry", async ({
  page,
}) => {
  await page.goto("/");

  const cta = page.getByRole("link", { name: /free playbook/i }).first();
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/join");

  const ghCta = page.getByRole("link", { name: /Sign in with GitHub/i });
  await expect(ghCta).toHaveCount(0);
});
