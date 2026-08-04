# landing/

Vercel-hosted landing site + GitHub sign-in + fork bootstrap for the
equity-platform. Ships marketing + docs + an OAuth onramp that gives each
developer their own fork of the platform to boot locally.

- **Live cluster observability stays in `console/`** — this app never
  talks to Kubernetes.
- **Sign-in uses the GitHub App web flow.** The local `console/` still
  uses device flow — they can share the same GitHub App with two
  callback methods.

## Local dev

```bash
cp .env.example .env.local     # fill in the values below
npm install
npm run dev                    # http://localhost:3040
```

Required env vars (see `.env.example`):

| var | notes |
|---|---|
| `GITHUB_APP_CLIENT_ID` | Same App as console/. Under App settings. |
| `GITHUB_APP_CLIENT_SECRET` | **NEW** — web flow needs it. Generate under App → Client secrets. |
| `GITHUB_APP_SLUG` | Defaults to `equity-console`. Only used to build the App-install link. |
| `SESSION_PASSWORD` | 32+ chars. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `UPSTREAM_REPO` | `owner/name` — the repo we fork on first sign-in. |
| `NEXT_PUBLIC_SITE_URL` | Public site URL used to build the OAuth redirect_uri. |

## GitHub App setup

We reuse the existing `equity-console` App. Two one-time steps:

1. Visit `https://github.com/settings/apps/equity-console/edit` (or wherever
   your App lives) and add a **Callback URL**:
   ```
   https://<your-vercel-domain>/api/auth/callback
   ```
   You can list multiple callback URLs — leave the existing device-flow
   entry (if any) alone.
2. Under **Client secrets** → **Generate a new client secret**. Copy the
   value into `GITHUB_APP_CLIENT_SECRET` in Vercel env.

Permissions required (already set for the console): **Contents R/W**,
**Metadata R**. No new scopes needed.

## Vercel deploy

1. Create a new Vercel project pointing at this repo.
2. **Root Directory:** `landing/`
3. Framework preset: **Next.js** (auto-detected).
4. Add all env vars from `.env.example` — mark `GITHUB_APP_CLIENT_SECRET`
   and `SESSION_PASSWORD` as **Secret**.
5. First deploy will give you a `*.vercel.app` domain. Copy it into
   `NEXT_PUBLIC_SITE_URL` and into the GitHub App **Callback URL**.
6. Re-deploy so the callback URL takes effect.

**Preview deployments:** OAuth won't work on preview URLs because the
callback URL is fixed at the App level. Either point the callback at your
production domain and test there, or register a second App for previews.

## The flow

```
User clicks "Sign in with GitHub" on /
  → GET /api/auth/login
      · sets short-lived `oauth-state` cookie (CSRF)
      · 302 → github.com/login/oauth/authorize?client_id=...&state=...
  → user approves on github.com
  → GET /api/auth/callback?code=X&state=Y
      · verify state == cookie (403 on mismatch)
      · exchange code → user access token
      · GET /user → cache login + avatar
      · POST /repos/{upstream}/forks (idempotent — 200 or 202)
      · store { token, login, targetRepo } in session
      · 302 /onboarding
  → /onboarding
      · polls /api/onboarding/fork-ready until 200
      · shows "Install App" CTA (polls /api/auth/install-status)
      · shows clone + up.sh commands
```

## Testing

```bash
npm test        # vitest unit
npm run test:e2e  # playwright — spins up next dev on :3040
```

E2E covers the CSRF guard, missing-code/state, OAuth error forwarding,
and the unauthed-onboarding redirect. It does NOT hit github.com — code
paths that touch the real API are unit-tested with fetch mocks.
