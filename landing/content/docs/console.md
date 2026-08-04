---
title: "The console — a per-tab walkthrough"
description: "The Next.js console is the whole UX for the platform. Master view aggregates every business; each business has six tabs. What each tab shows and where the data comes from."
keywords: ["equity-platform console", "Next.js dashboard", "Kubernetes UI", "multi-tenant"]
category: "Concepts"
summary: "One sidebar, six tabs per business. Where each panel gets its data."
icon: "grid"
order: 4
lastmod: "2026-08-04"
---

# The console

The console is a Next.js 15 app under `console/` in the repo. It runs locally on port 3030 and talks to your kind cluster via the Kubernetes API. It's the whole UX for the platform — you shouldn't need `kubectl` for day-to-day operation.

## Layout

- **Sidebar** — auto-populates from k8s namespace labels. Every namespace tagged `equity.io/tenant=<slug>` shows up as a business.
- **Master view** (`/master`) — aggregates apps, crons, streams, and email deliverability across every tenant.
- **Per-business drill-in** (`/<slug>`) — six tabs, one business.

## The six tabs

| Tab | What it shows | Data source |
|---|---|---|
| **Overview** | Apps + CronJobs at a glance, stale-cron warnings | k8s API (filtered by tenant namespace) |
| **Apps** | ArgoCD Applications table, one-click **+ New Application** | k8s API (`argoproj.io/Applications`) |
| **Cron** | Every CronJob, staleness heuristic (red if no success in 24h) | k8s BatchV1 API |
| **Email** | Deliverability, bounce rate, complaint rate | Per-tenant Postgres `email_events` (opt-in) |
| **Events** | NATS JetStream streams + consumers + lag | NATS `/jsz` monitoring endpoint |
| **History** | Recent commits to the platform repo + revert links | GitHub API |

## The + New Application flow

**Apps → + New Application** → fill the form → submit. The Server Action writes two commits to your fork:

1. One adds the ArgoCD Application manifest under `apps/`.
2. One references it from the parent app-of-apps.

ArgoCD polls your fork on ~1-minute intervals and reconciles the new app into your cluster.

**Rollback** any of this from the **History** tab — the "revert" link opens a GitHub one-click revert PR. Merge it, and ArgoCD reconciles you back.

## The + New Business flow

**Master → + New Business** does the same thing but at a coarser grain: it appends a namespace block to `bootstrap/00-namespaces.yaml` and applies the namespace directly to your live cluster (so it shows up in the sidebar immediately, before the ArgoCD reconcile window).

## Read-only fallback

If you don't configure `GITHUB_TOKEN` in `console/.env.local`, the console still works — you just can't provision new apps or businesses from the UI. Every write button gracefully degrades to a "configure GitHub write-back first" message.

## NATS monitoring needs a port-forward locally

```bash
kubectl port-forward -n nats svc/nats-headless 8222:8222 &
```

Or set `NATS_MONITOR_URL` in `console/.env.local`. Full env template in `console/.env.example`.
