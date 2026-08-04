---
title: "Troubleshooting — common issues"
description: "Fork stuck, CSRF errors, 404 from the console, port conflicts. What each error means and the fastest way past it."
keywords: ["troubleshooting", "errors", "fork stuck", "CSRF", "404"]
category: "Reference"
summary: "The five failures we see most often and what to do about each."
icon: "wrench"
order: 1
lastmod: "2026-08-04"
---

# Troubleshooting

## Fork is stuck "preparing"

GitHub's fork creation is asynchronous. Usually it completes in under 30 seconds; sometimes it takes up to 5 minutes.

**What to do:**
- Wait 30 seconds and refresh `/onboarding`.
- If the fork appears on your GitHub account but not in the onboarding UI, sign out and sign back in to refresh the session cookie.
- If it's still stuck after 5 minutes, check GitHub's status page ([www.githubstatus.com](https://www.githubstatus.com)) — fork creation degrades during incidents.

## CSRF error after sign-in

Your browser blocked the state cookie during the OAuth round-trip. Usually this is a strict privacy extension (uBlock, Ghostery in aggressive mode) or a browser in strict tracking-prevention mode.

**What to do:**
- Try in a normal (non-private) browser window.
- Temporarily disable the privacy extension for `www.lamboapp.com`.
- Chrome / Safari default settings work; Firefox with "Strict" tracking protection sometimes blocks the cookie.

## Local console shows "GitHub write failed: 404"

The equity-console GitHub App isn't installed on your fork. Every write action (new app, new business, profile save) will 404 without it.

**What to do:**
- Go to `/onboarding` on the landing site and click **Install App on my fork**.
- Or install directly from `github.com/apps/equity-console`.
- After installing, restart the local console (`npm run dev`) — the App's install status is cached.

## `./local/up.sh` fails at kind cluster creation

Docker isn't running.

**What to do:**
- Start Docker Desktop (or Colima).
- Verify with `docker ps` — should not error.
- Re-run `./local/up.sh`. It's idempotent.

## Port 3030 already in use

Something else is holding the port.

**What to do:**
- Kill the other process: `lsof -i :3030` → `kill <pid>`.
- Or start the console on a different port: `PORT=3031 npm run dev`.

## NATS Events tab is empty

The NATS monitoring endpoint isn't reachable from your local console.

**What to do:**
- Port-forward: `kubectl port-forward -n nats svc/nats-headless 8222:8222 &`.
- Or set `NATS_MONITOR_URL` in `console/.env.local` to a reachable endpoint.

## ArgoCD isn't reconciling my new commit

ArgoCD polls the repo on a schedule (default ~1 minute for public repos, longer for private). Sometimes the poll misses a commit and you have to nudge it.

**What to do:**
- Wait up to 3 minutes for the natural poll cycle.
- If still not reconciling, `kubectl -n argocd get applications` and look at the target revision. If it's stale, force a sync from the ArgoCD UI or `argocd app sync <name>`.

## Something else

Open a GitHub issue at [github.com/jaredzwick/equity-platform/issues](https://github.com/jaredzwick/equity-platform/issues) with what you were trying to do and the full error output. See [Contributing](/docs/contributing) for what makes a good bug report.
