---
title: "How it works — the console → GitHub → ArgoCD → cluster flow"
description: "Every change is a git commit. Every rollback is a git revert. Here's the whole round-trip from console form submit to cluster state."
keywords: ["GitOps", "ArgoCD", "declarative infrastructure", "equity-platform architecture"]
category: "Concepts"
summary: "The console writes YAML to GitHub. ArgoCD polls GitHub. Your cluster reconciles. No manual state."
icon: "flow"
order: 1
lastmod: "2026-08-04"
---

# How it works

The whole system is a loop. The console never writes to your cluster directly — it writes to git. ArgoCD reads git and reconciles. If you don't like what happened, you `git revert` and the loop re-runs backward.

## The round-trip

```
     Form submit
         │
         ▼
   Server Action  ─▶  GitHub API  ─▶  commit lands in the repo
         │                                    │
         │                                    ▼
         │                          ArgoCD polls (~1 min)
         │                                    │
         ▼                                    ▼
    Redirect to             ArgoCD reconciles new state
    /<tenant>/apps                            │
                                              ▼
                                       App live in cluster
```

## Why git is the source of truth

Three properties fall out for free:

1. **Auditability** — every change is a commit with an author, timestamp, and diff. No mystery "who deleted the ingress at 3 AM."
2. **Reversibility** — every commit is a candidate for `git revert`. The console's **History** tab links straight to GitHub's one-click revert UI.
3. **Reproducibility** — a fresh clone + `./local/up.sh` reconstructs the whole platform from the same commits.

The alternative — the console writing directly to the k8s API — trades all three of those properties for a marginal speedup.

## What the console reads live

For **display**, the console reads directly from live sources:

| Data | Source |
|---|---|
| Apps, CronJobs, namespaces | k8s API (filtered by tenant namespace) |
| NATS streams, consumers, lag | NATS `/jsz` monitoring endpoint |
| Email deliverability | Per-tenant Postgres `email_events` (opt-in) |
| Recent commits + revert links | GitHub API |

For **changes**, the console writes only to GitHub. ArgoCD does the rest.

## The two hops

Adding a new ArgoCD Application currently takes **two commits**: one to add the manifest under `apps/`, one to reference it from the parent Application. This is documented as a design trade-off — the alternative (Git Data API, one atomic commit) is on the roadmap but not blocking.

## The console is the whole UX

- `/master` — aggregate across every business.
- `/<slug>` — drill into one business.
- Six tabs per tenant: Overview, Apps, Cron, Email, Events, History.

See [The console](/docs/console) for a per-tab walkthrough.

## What the landing site does (and doesn't do)

The landing site at [www.lamboapp.com](https://www.lamboapp.com) runs on Vercel. It does OAuth sign-in and fork provisioning. It **does not** talk to any Kubernetes cluster — Vercel is serverless, clusters aren't. Everything cluster-adjacent runs on your machine.
