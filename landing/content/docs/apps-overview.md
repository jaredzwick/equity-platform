---
title: "Apps — what they are, how they land"
description: "An app on this platform is a Helm chart wrapped as an ArgoCD Application. The console commits two YAML files to git; ArgoCD reconciles into your cluster within about a minute."
keywords: ["ArgoCD Application", "Helm chart", "GitOps", "self-hosted apps", "one-click install"]
category: "Apps"
summary: "The whole provisioning chain in one page: git → ArgoCD → Kubernetes."
icon: "grid"
order: 1
lastmod: "2026-08-04"
---

## The one-sentence version

An **app** is a Helm chart, wrapped as an ArgoCD `Application`, that lives in
your platform git repo. The console's job is to write two YAML files. ArgoCD's
job is to make Kubernetes match those files.

## The chain, end to end

```
You click "Install PostgreSQL"
        ↓
Console writes 2 files to git:
        ├── apps/postgresql.yaml           (the ArgoCD Application manifest)
        └── charts/postgresql/values.yaml  (your Helm overrides)
        ↓
ArgoCD is watching the repo.
It sees the new Application within ~60 seconds.
        ↓
ArgoCD reads the Application spec:
        chart:  postgresql
        repo:   https://charts.bitnami.com/bitnami
        version: 16.0.6
        values: <your charts/postgresql/values.yaml>
        ↓
ArgoCD runs `helm template` and applies the result to Kubernetes.
        ↓
Your app is running.
        ↓
Console shows Sync=Synced, Health=Healthy in the /apps tab.
```

## What each file does

**`apps/<name>.yaml`** — this is what ArgoCD reconciles from. It says "there
should be a thing named X in the cluster, built by pulling chart Y from repo Z
at version V, overridden by the values file at path W." You almost never edit
this by hand; the console generates it.

**`charts/<name>/values.yaml`** — the knobs. Every Helm chart publishes a big
`values.yaml` with defaults; this file is your overrides. When you use a
template, this file starts pre-filled with sensible defaults for the platform
(smaller resource requests, persistent storage sized reasonably, placeholder
passwords you should replace). When you use the custom chart page, this file
starts empty.

## Why two commits

The values file is written first, then the Application manifest. That order
matters: when ArgoCD picks up the new Application, the values file it points at
already exists. If we wrote them in the other order (or as one commit), there
would be a tiny window where ArgoCD would fail to sync because it couldn't find
the values file.

## When something goes wrong

The console shows two status pills per app on `/:tenant/apps`:

- **Sync** — did ArgoCD manage to apply what's in git? `Synced` means yes.
  `OutOfSync` means the cluster drifted from git. `Progressing` means an apply
  is in flight. `Unknown` usually means ArgoCD can't reach the source repo.
- **Health** — is the app actually working? `Healthy` means the pods are
  ready. `Degraded` means something crashed. `Progressing` means it's still
  coming up.

If either goes red for more than a few minutes, the [troubleshooting
guide](/docs/apps-troubleshooting) is the next stop.

## What you can install

The [templates page](/docs/apps-choose-template) is a curated list of ten
common apps (databases, caches, storage, observability, blogs, workflow tools).
If you need something outside that list, any public Helm chart works: see the
[custom chart guide](/docs/apps-custom-chart).

Both routes go through the exact same provisioning code. Templates are just
pre-filled forms.
