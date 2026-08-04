---
title: "What is equity-platform?"
description: "A one-command Kubernetes platform for running multiple businesses on shared local infrastructure — with an AI deal-sourcing layer on top."
keywords: ["equity-platform", "LamboApp", "acquisition entrepreneur", "Kubernetes", "GitOps", "SMB acquisition"]
category: "Start here"
summary: "The whole system in one paragraph, plus what belongs where."
icon: "rocket"
order: 1
lastmod: "2026-08-04"
---

# What is equity-platform?

**equity-platform** is a one-command Kubernetes stack for running multiple businesses on shared infrastructure. Everything is declared in this repo. Every change is a git commit. Every rollback is a `git revert`.

**LamboApp** is the deal-sourcing layer built on top: an AI screener that reads ~100 listings a day across 30+ business-for-sale brokers, flags the scams, scores the winners, and hands you a one-paragraph thesis. It runs as a tenant on the platform — the same way any other business would.

## The two pieces

| Piece | Where it runs | What it does |
|---|---|---|
| **The platform** | Your local kind cluster ($0) or your own prod k8s | Boots ArgoCD + NATS + Prometheus + External Secrets, aggregates every tenant into one console |
| **The landing site** | Vercel ([www.lamboapp.com](https://www.lamboapp.com)) | Marketing + GitHub OAuth + fork provisioning. **Does not** run the cluster |

The landing site is the on-ramp. It signs you in with GitHub, forks the repo to your account, and hands you off. Everything that talks to a live Kubernetes cluster stays on your machine, because Vercel is serverless and clusters aren't.

## Who this is for

- **Acquisition entrepreneurs** who want a real deal-flow pipeline without wiring 30 broker scrapers by hand.
- **Solo operators** running 2–10 businesses who want one dashboard instead of 10 dashboards.
- **Engineers** who prefer declarative infra + GitOps over "click three consoles and hope."

If you're none of those, that's fine — the source is open, the license is BSL 1.1 (auto-converts to Apache 2.0 in 2030), and you can fork it and use it internally forever.

## What to read next

- [Quickstart](/docs/quickstart) — boot it locally in about 3 minutes.
- [How it works](/docs/how-it-works) — the console → GitHub → ArgoCD → cluster flow.
- [Licensing](/docs/licensing) — what BSL 1.1 does and doesn't let you do.
