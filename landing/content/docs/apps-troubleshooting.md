---
title: "App won't sync — what to check"
description: "How to read the ArgoCD sync and health pills on /:tenant/apps, and how to fix the common failures: stale chart versions, malformed values, missing namespace, image pull errors, CRD ordering."
keywords: ["ArgoCD sync failed", "app degraded", "Helm install error", "OutOfSync", "CRDs ordering", "image pull error"]
category: "Apps"
summary: "The pills went red. Here's the debugging order and the common causes."
icon: "warning"
order: 4
lastmod: "2026-08-04"
---

The console shows two status pills per app on `/:tenant/apps`. When either
goes red, this is the order to check.

## Reading the pills

| Pill | Green | Amber | Red | What it means |
|------|-------|-------|-----|---------------|
| **Sync** | `Synced` | `Progressing` | `OutOfSync`, `Unknown`, `Missing` | Did ArgoCD manage to apply what's in git? |
| **Health** | `Healthy` | `Progressing` | `Degraded`, `Missing` | Are the resources actually working? |

Common combinations:

- **Sync=OutOfSync + Health=Healthy** — something in the cluster changed by
  hand and doesn't match git anymore. ArgoCD will self-heal on next sync
  (usually within a minute). If it persists, someone probably has automation
  fighting with ArgoCD.
- **Sync=Synced + Health=Degraded** — ArgoCD wrote what git said, but the
  workload is broken. This is a Kubernetes / Helm chart problem, not an
  ArgoCD problem. Check pod logs.
- **Sync=Unknown** — ArgoCD can't reach the source repo (chart repo down,
  auth broken). Uncommon but visible immediately.
- **Sync=Progressing + Health=Progressing (for >5 minutes)** — sync is stuck.
  Usually a pod that can't start (image pull, PVC binding, node capacity).

## Common failure #1: chart version yanked

**Symptom:** You should not see this from a template install. The picker
disables cards whose upstream version has been removed ("Version yanked"
badge) and the templated form blocks submit with a red banner naming the
latest available version.

**If you see it anyway** — either you used the custom chart page with a
version that was pulled between when you filled the form and when you
submitted, or the upstream repo was unreachable during the pre-flight check
(the picker shows "Version unverified" in that case).

**Fix:** Find the current version on the chart repo (Artifact Hub is the
easiest place to check), edit `charts/<name>/values.yaml` if the schema
changed, and either:

- Rewrite `apps/<name>.yaml` to point at the new version, OR
- Delete both files and re-run the install through the custom chart page with
  a valid version.

If a template's pinned version was yanked upstream, open a PR to bump the
version in `console/lib/app-templates.ts` — the picker will pick up the new
pin on the next release.

## Common failure #2: malformed values YAML

**Symptom:** Sync fails; error mentions "yaml: line N" or "unknown field."

**Cause:** Your `values.yaml` doesn't parse, or references keys the chart
doesn't understand. Common with charts that renamed a top-level key between
versions.

**Fix:** Pull the chart's own default `values.yaml` (linked from Artifact Hub)
and diff yours against it. Bad indentation is the most common culprit — YAML
is spaces-only and picky.

## Common failure #3: missing CRDs

**Symptom:** Sync fails; error mentions "no matches for kind" or "resource
mapping not found."

**Cause:** The chart uses a CRD (Custom Resource Definition) that isn't
installed yet. Some charts (`cert-manager`, `kube-prometheus-stack`) install
their own CRDs; others assume the CRDs are already there.

**Fix:** Install the CRD-providing chart first, or set the chart's flag to
install CRDs (usually `crds.enabled: true` or `installCRDs: true` in values).

## Common failure #4: image pull error

**Symptom:** Sync=Synced, Health=Degraded. Pod logs (via `kubectl` or the
K8s dashboard) show `ImagePullBackOff` or `ErrImagePull`.

**Cause:** The chart's default container image is behind a registry that
needs auth (private registry, hit Docker Hub rate limits, wrong tag).

**Fix:** Point the chart at a mirror or add pull-secret config to values.

## Common failure #5: PVC pending

**Symptom:** Sync=Synced, Health=Progressing forever. Pod events show
"pod has unbound PersistentVolumeClaims."

**Cause:** No storage class matches, or no capacity available, or requested
storage size exceeds what the cluster can provide.

**Fix:** Either set a smaller `persistence.size` in values, or configure a
default storage class in the cluster.

## When to check ArgoCD directly

The console's status pills tell you *what* happened. When you need to see
*why*, open the ArgoCD UI — it has the full sync log, the exact resource that
failed, and the Kubernetes event stream.

The ArgoCD UI runs as its own service in the cluster; the URL depends on how
your platform was bootstrapped.

## When to rip it out and start over

If the app is genuinely broken (bad chart, wrong version, unrecoverable
state), the cleanest fix is:

1. Delete `apps/<name>.yaml` and `charts/<name>/values.yaml` from the repo.
2. Commit and push.
3. ArgoCD's `resources-finalizer.argocd.argoproj.io` finalizer cleans up
   everything in the cluster on next reconcile (~1 min).
4. Re-run the install fresh.

That finalizer is set on every ArgoCD Application the console creates, so this
is safe — no orphaned resources.
