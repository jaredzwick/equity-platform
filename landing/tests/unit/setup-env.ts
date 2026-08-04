// Provides deterministic env for unit tests. Import at the top of any
// test file that touches lib/env or lib/session.
process.env.GITHUB_APP_CLIENT_ID = "Iv1.testclientid";
process.env.GITHUB_APP_CLIENT_SECRET = "test-client-secret-value";
process.env.GITHUB_APP_SLUG = "equity-console";
process.env.SESSION_PASSWORD = "unit-test-session-password-32-chars-long";
process.env.UPSTREAM_REPO = "jaredzwick/equity-platform";
process.env.NEXT_PUBLIC_SITE_URL = "https://landing.example.test";
