---
title: "Add a business — provision a new tenant"
description: "Two ways to add a business to the platform: via the console form (recommended) or by editing YAML directly. Both end in the same place."
keywords: ["multi-tenant", "namespace", "provisioning", "business profile"]
category: "Guides"
summary: "Console → + New Business, or edit bootstrap/00-namespaces.yaml by hand. Both work."
icon: "plus"
order: 3
lastmod: "2026-08-04"
---

# Add a business

Every business you run on the platform is a Kubernetes namespace, plus a declarative profile at `businesses/<slug>.yaml`. There are two ways to create one.

## Preferred — use the console

**Master view → + New Business** → fill in:

- **Display name** — human-readable, e.g. "MyShop."
- **Slug** — URL-safe, e.g. `myshop`.
- **Namespace** — k8s-safe, usually `<slug>-prod`.

Hit **Save**. The console:

1. Commits a namespace block to `bootstrap/00-namespaces.yaml` on your fork.
2. Applies the namespace to your live cluster immediately (so it appears in the sidebar without waiting for the ArgoCD reconcile window).
3. Opens the new tenant's Profile tab.

## By hand

Append to `bootstrap/00-namespaces.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: myshop-prod
  labels:
    equity.io/tenant: myshop
    equity.io/tenant-name: MyShop
```

Then either:

```bash
kubectl apply -f bootstrap/00-namespaces.yaml
```

or re-run `./local/up.sh` (idempotent).

The console auto-discovers the new tenant on next request. It'll show up in the sidebar with an empty drill-in view.

## The business profile

Each tenant has a declarative YAML profile at `businesses/<slug>.yaml`. Fields cover:

- **Identity** — LLC name, primary domain, contact emails.
- **Brand** — logo URL, primary/secondary colors, tagline.
- **Offer** — price, Stripe product IDs, primary CTA copy.
- **Copy** — hero headline, about-us text, voice guide.
- **Legal** — jurisdiction, EIN, privacy/terms URLs.
- **Integrations** — GHL, n8n, Meta pixel, GA, PostHog, Slack.

Edit via the console (`/<slug>/profile`) or by hand. The schema lives in `console/lib/business-profile.ts` — add a field there and the form regenerates automatically.

## What you can put in a tenant namespace

Anything you'd put in any other Kubernetes namespace. The platform installs shared infrastructure (NATS, Prometheus, External Secrets) at the cluster level; each tenant namespace is otherwise unopinionated. Deploy your own Deployments, Services, Ingresses, CronJobs, whatever.

The console shows you all of it under the tenant's tabs — filtered by namespace label — without you needing to configure anything per-tenant.

## Removing a business

Currently: delete the namespace block from `bootstrap/00-namespaces.yaml`, commit, `kubectl delete namespace <ns>` for the immediate cleanup. An in-console "archive business" flow is on the roadmap.
