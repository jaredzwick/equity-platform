---
title: "Quickstart — boot the platform in 3 minutes"
description: "Sign in with GitHub, clone your fork, run one script. You'll have a live Kubernetes cluster and a working console in about 3 minutes."
keywords: ["equity-platform quickstart", "kind cluster", "ArgoCD", "local Kubernetes"]
category: "Start here"
summary: "Sign in → clone → ./local/up.sh → npm run dev. That's the whole thing."
icon: "terminal"
order: 2
lastmod: "2026-08-04"
---

# Quickstart

Zero to a running console in about 3 minutes. Everything runs locally on kind. No cloud spend.

## Prerequisites

- **Docker Desktop** (or Colima) running
- **Node.js 20+**
- **kind + kubectl + helm** — on macOS: `brew install kind kubectl helm`

## Step 1 — Sign in and fork

Click **Sign in with GitHub** on the landing page. We `POST /repos/jaredzwick/equity-platform/forks` to create (or return) your fork under your account. There is no waiting list, no signup form.

## Step 2 — Clone your fork

```bash
git clone https://github.com/YOUR-USERNAME/equity-platform ~/equity-platform
cd ~/equity-platform
```

## Step 3 — Boot the cluster

```bash
./local/up.sh
```

This does four things, idempotently:

1. Creates a kind cluster (~90s).
2. Installs ArgoCD (~2min).
3. Applies platform namespaces (no tenants yet — you create them via the console).
4. Applies the root app-of-apps if you've configured a git remote.

## Step 4 — Start the console

```bash
cd console
npm install
npm run dev
```

Open [http://localhost:3030](http://localhost:3030). You'll land on `/master`. The sidebar is empty because you haven't added any businesses yet — that's next.

## Step 5 — Add your first business

In the console: **Master → + New Business**. Fill in a display name, slug, and namespace, hit Save. The console:

1. Commits a namespace block to `bootstrap/00-namespaces.yaml` on your fork.
2. Applies the namespace to your live cluster immediately.
3. Opens the new tenant's Profile tab.

More detail: [Add a business](/docs/add-a-business).

## Tear down

```bash
./local/down.sh
```

Destroys the kind cluster. Filesystem stays clean. Idempotent.

## What broke?

- **Docker not running** → `./local/up.sh` will fail at kind cluster creation. Start Docker Desktop.
- **Port 3030 already in use** → `PORT=3031 npm run dev`.
- **GitHub write-back returns 404** → the equity-console App isn't installed on your fork yet. See [GitHub App setup](/docs/github-app).

Everything else: [Troubleshooting](/docs/troubleshooting).
