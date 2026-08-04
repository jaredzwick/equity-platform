import { defineConfig, devices } from "@playwright/test";

// E2E runs against a locally-started `next dev` on port 3040. Env is
// loaded from playwright's env; the dev server uses whatever's in
// .env.local. For CI, the workflow injects placeholder secrets and uses
// nock/MSW-style intercepts inside the tests to fake github.com.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3040",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3040",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      GITHUB_APP_CLIENT_ID: "Iv1.e2eclientid",
      GITHUB_APP_CLIENT_SECRET: "e2e-client-secret",
      GITHUB_APP_SLUG: "equity-console",
      SESSION_PASSWORD: "e2e-test-session-password-32-chars-min",
      UPSTREAM_REPO: "jaredzwick/equity-platform",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3040",
    },
  },
});
