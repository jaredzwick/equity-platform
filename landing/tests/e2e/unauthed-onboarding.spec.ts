import { test, expect } from "@playwright/test";

test("unauthed access to /onboarding redirects to /", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/\?error=not_authenticated/);
});

test("docs page renders without auth", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByRole("heading", { name: /Quickstart/i })).toBeVisible();
});
