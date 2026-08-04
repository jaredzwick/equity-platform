---
title: "Self-hosting — run the whole platform yourself"
description: "Full self-host guide: local kind cluster for dev, production Kubernetes for real workloads. No hosted control plane required."
keywords: ["self-hosting", "kind cluster", "Kubernetes production", "ArgoCD", "GitOps"]
category: "Guides"
summary: "kind for local, any conformant k8s for prod. The console talks directly to your cluster."
icon: "server"
order: 1
lastmod: "2026-08-04"
---

# Self-hosting

The platform is designed to be self-hosted. There is no required hosted control plane. The landing site at [www.lamboapp.com](https://www.lamboapp.com) is a convenience for signup + fork provisioning; you can skip it entirely and clone the upstream repo directly if you'd rather.

## Local development (kind)

The default configuration boots on kind, macOS or Linux. Cost: $0.

```bash
brew install kind kubectl helm
git clone https://github.com/jaredzwick/equity-platform ~/equity-platform
cd ~/equity-platform
./local/up.sh
```

That's it. `./local/up.sh` is idempotent — run it as many times as you like.

## Production (any conformant Kubernetes)

The manifests under `bootstrap/`, `apps/`, and `charts/` are cluster-portable. To adopt them on a production cluster:

1. **Point ArgoCD at your fork.** Configure `argocd-cm` with your repo URL and a deploy key or GitHub App credential.
2. **Apply the root app-of-apps** — `kubectl apply -f bootstrap/root-app.yaml`. ArgoCD picks up everything from there.
3. **Swap the External Secrets backend** if you're not using local secrets. ESO supports DO Secrets, 1Password, AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault — the ClusterSecretStore is a one-file swap under `bootstrap/`.
4. **Point DNS** at your ingress. `envoy-gateway` is the default; swap for your ingress of choice if needed.

A DO Kubernetes overlay is on the roadmap. Until then, treat the kind config as the reference — the delta for a managed k8s provider is mostly ingress + secrets.

## Environment variables

Full template lives at `console/.env.example` in the repo. The important ones:

| Variable | Required for | Notes |
|---|---|---|
| `KUBECONFIG` | Any k8s reads | Points to your cluster. Defaults to `~/.kube/config`. |
| `GITHUB_TOKEN` | Write-back (new app, new business) | Fine-grained PAT with **Contents: Read and Write** scoped to your fork. |
| `GITHUB_REPO` | Write-back | Format `owner/repo`, e.g. `yourname/equity-platform`. |
| `NATS_MONITOR_URL` | Events tab | Defaults to `http://localhost:8222` — port-forward from the cluster. |

The console never sends anything to a hosted control plane. All state is either in your git repo, your cluster, or your local disk.

## Why we don't offer a fully hosted platform

The console holds live connections to your Kubernetes API. Vercel-style serverless can't do that — no persistent process, no persistent connection. A fully hosted control plane would need dedicated infra (a bastion, a websocket relay, a per-customer proxy), and the cost story stops being "$0 to try."

If you want a hosted control plane, get in touch (`commercial@pypes.dev`). Otherwise: self-host, and pay only for the cluster you're running your businesses on anyway.
