---
title: "Install any Helm chart (custom chart page)"
description: "Beyond the templates: how to install any public Helm chart via the custom chart page. Where to find charts, how to pin versions, how to write values.yaml, when to use ExternalSecrets."
keywords: ["custom Helm chart", "Artifact Hub", "Helm values", "pinned chart version", "ExternalSecret"]
category: "Apps"
summary: "Beyond the templates: install anything from Artifact Hub or any public repo."
icon: "wrench"
order: 3
lastmod: "2026-08-04"
---

The [templates](/docs/apps-choose-template) cover ten apps. Everything else
goes through the **custom chart page** — same provisioning code, you just fill
in what a template would have pre-filled.

Reach it from `/:tenant/apps/new` → "Advanced: custom chart →".

## The four fields

**Chart repo URL.** The Helm repo that hosts the chart. Must be `https://`.
Examples: `https://charts.bitnami.com/bitnami`,
`https://prometheus-community.github.io/helm-charts`,
`https://charts.jetstack.io`.

**Chart name.** The name of the chart in that repo. Examples: `redis`,
`kube-prometheus-stack`, `cert-manager`.

**Chart version.** Pinned semver. Never `latest`. Never `^1.2` or `~1.2.3`.
Always a concrete `1.2.3`. ArgoCD needs a deterministic version to reconcile
against; ranges break reproducibility.

**Values YAML.** The chart's overrides. Empty means "use the chart's own
defaults" (which is fine for a lot of charts).

## Finding a chart

The best index is **[Artifact Hub](https://artifacthub.io/)**. Search for
what you need; each package page shows:

- The exact `chartRepo` URL to paste (under "Install" → "helm repo add")
- The `chartName` (the part after the slash: `bitnami/redis` → `redis`)
- Available versions (pick the newest stable one)
- The chart's default values, so you know what you can override

## Writing a values.yaml

Read the chart's own `values.yaml` (linked from the Artifact Hub page) to see
every knob. Then override only what you care about. A good values file is
short — the shorter, the better.

Bad (copies the whole default file, then edits four lines):

```yaml
# 800 lines of copy-pasted defaults, four of them different from upstream
```

Good (says only what's different from defaults):

```yaml
auth:
  password: change-me-in-secret
persistence:
  size: 20Gi
resources:
  requests:
    memory: 512Mi
```

The short version is easier to review, easier to diff, and easier to migrate
when the chart's schema changes.

## Passwords and secrets

Do not commit real secrets to git.

Every template's values file has `change-me-in-secret` as a placeholder. When
you actually deploy the app, you have two options:

**Option A: replace with a static secret before submitting.** Fine for local
development. Never do this in production.

**Option B: reference an ExternalSecret.** The platform ships with
external-secrets-operator. In your values file:

```yaml
auth:
  existingSecret: postgres-app-password
```

Then create an ExternalSecret that pulls `postgres-app-password` from your
vault (AWS Secrets Manager, 1Password, Vault, etc.) — see the
[external-secrets docs](https://external-secrets.io/) for the exact CRD shape.

## Namespaces

The custom chart page defaults to your tenant's namespace. If you want the app
in a different namespace, that namespace must already exist. To create a new
tenant namespace, use the [add-a-business flow](/docs/add-a-business) — apps
share a namespace with the tenant that owns them.

## What the console does after you submit

Same as templates: writes two files to git
(`apps/<name>.yaml` + `charts/<name>/values.yaml`), commits them separately,
and lets ArgoCD reconcile. You land back on `/:tenant/apps` with a success
flash and the app appears in the list within about a minute.

If the sync fails (chart version doesn't exist, values file has a bad schema,
Kubernetes rejects the manifest), the status pill goes red. The
[troubleshooting guide](/docs/apps-troubleshooting) explains how to read the
error.

## When to convert a custom install back to a template

If you find yourself installing the same custom chart across multiple tenants,
open a PR against `console/lib/app-templates.ts` and add it to the template
registry. The registry integrity test enforces the schema; the picker
auto-discovers new entries.

Rule of thumb: **three tenants running the same custom chart = it should be
a template.**
