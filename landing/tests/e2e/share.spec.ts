import { test, expect, type Page } from "@playwright/test";

// E2E coverage for the Share button + overlay surfaced on /deal/[slug].
// Target slug: any published deal returned by /lamboapp/public/deals.
// For dev-mode tests we fall back to a mock slug the dev server will 404 on
// unless FIXTURE_DEAL_SLUG env var is set — this spec is written against a
// live-ish fixture, so we gate the suite on that env var being present.

const FIXTURE_SLUG = process.env.FIXTURE_DEAL_SLUG;

test.describe("Share overlay", () => {
  test.skip(!FIXTURE_SLUG, "FIXTURE_DEAL_SLUG not set — skipping share e2e");

  async function openOverlay(page: Page) {
    const shareBtn = page.getByRole("button", { name: /Share this deal/i }).first();
    await expect(shareBtn).toBeVisible();
    await shareBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  }

  test("Share button opens overlay with 5 destinations", async ({ page }) => {
    await page.goto(`/deal/${FIXTURE_SLUG}`);
    await openOverlay(page);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    for (const name of ["Share on X (Twitter)", "Share on LinkedIn", "Share on WhatsApp", "Share on Email", "Copy link to clipboard"]) {
      await expect(dialog.getByRole("button", { name })).toBeVisible();
    }
  });

  test("ESC closes overlay and restores focus", async ({ page }) => {
    await page.goto(`/deal/${FIXTURE_SLUG}`);
    const shareBtn = page.getByRole("button", { name: /Share this deal/i }).first();
    await shareBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(shareBtn).toBeFocused();
  });

  test("backdrop click closes overlay", async ({ page }) => {
    await page.goto(`/deal/${FIXTURE_SLUG}`);
    await openOverlay(page);
    // Click outside the dialog, inside the backdrop.
    await page.mouse.click(10, 10);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("close-button dismisses overlay", async ({ page }) => {
    await page.goto(`/deal/${FIXTURE_SLUG}`);
    await openOverlay(page);
    await page.getByRole("button", { name: "Close share dialog" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Copy link success → overlay closes + toast appears", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/deal/${FIXTURE_SLUG}`);
    await openOverlay(page);
    await page.getByRole("button", { name: "Copy link to clipboard" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(/Link copied/i);
  });

  test("Copy link failure keeps overlay open with URL input visible (iOS webview sim)", async ({ page }) => {
    await page.goto(`/deal/${FIXTURE_SLUG}`);
    // Stub clipboard before opening the overlay so our rejected promise lands.
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: () => Promise.reject(new Error("blocked")) },
      });
    });
    await openOverlay(page);
    await page.getByRole("button", { name: "Copy link to clipboard" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const urlInput = page.getByLabel("Deal URL");
    await expect(urlInput).toBeVisible();
    const val = await urlInput.inputValue();
    expect(val).toContain(`/deal/${FIXTURE_SLUG}`);
    expect(val).toContain("utm_medium=copy");
  });

  test("destination URL carries UTM params", async ({ page, context }) => {
    await page.goto(`/deal/${FIXTURE_SLUG}`);
    await openOverlay(page);
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("button", { name: "Share on X (Twitter)" }).click(),
    ]);
    const url = new URL(popup.url());
    expect(url.hostname).toMatch(/(twitter\.com|x\.com)/);
    const text = url.searchParams.get("text") || "";
    expect(text).toContain("utm_source=share");
    expect(text).toContain("utm_medium=twitter");
    await popup.close();
  });
});

test.describe("Share button — mobile native share path", () => {
  test.skip(!FIXTURE_SLUG, "FIXTURE_DEAL_SLUG not set — skipping share e2e");
  test.use({ viewport: { width: 375, height: 812 } });

  test("invokes navigator.share when available", async ({ page }) => {
    await page.addInitScript(() => {
      // Capture the payload for assertion.
      (window as unknown as { __shareCall?: unknown }).__shareCall = null;
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: (payload: unknown) => {
          (window as unknown as { __shareCall?: unknown }).__shareCall = payload;
          return Promise.resolve();
        },
      });
    });
    await page.goto(`/deal/${FIXTURE_SLUG}`);
    const shareBtn = page.getByRole("button", { name: /Share this deal/i }).first();
    await shareBtn.click();
    const payload = await page.evaluate(
      () => (window as unknown as { __shareCall?: { url?: string } }).__shareCall,
    );
    expect(payload).toBeTruthy();
    expect(payload?.url).toContain(`/deal/${FIXTURE_SLUG}`);
    // Overlay should NOT have opened — native path handled it.
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("falls back to overlay when navigator.share undefined", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: undefined,
      });
    });
    await page.goto(`/deal/${FIXTURE_SLUG}`);
    const shareBtn = page.getByRole("button", { name: /Share this deal/i }).first();
    await shareBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("Partner-email CTA", () => {
  test.skip(!FIXTURE_SLUG, "FIXTURE_DEAL_SLUG not set — skipping share e2e");

  test("mailto href has prefilled subject + body + UTM URL", async ({ page }) => {
    await page.goto(`/deal/${FIXTURE_SLUG}`);
    const link = page.getByRole("link", { name: /Send to a partner/i });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^mailto:\?subject=/);
    expect(href).toContain("body=");
    expect(decodeURIComponent(href!)).toContain(`/deal/${FIXTURE_SLUG}`);
    expect(decodeURIComponent(href!)).toContain("utm_medium=email");
  });
});
