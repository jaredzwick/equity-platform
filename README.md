# equity-platform

**Zero-cost, one-command Kubernetes platform for solo founders and small teams.**
kind + ArgoCD + External Secrets + NATS JetStream, wired as an app-of-apps.

The same manifests run locally on kind ($0) and in prod on DigitalOcean or
any managed Kubernetes. Migrate a workload one slice at a time.

---

## Why this exists

Every new business shouldn't re-derive: "how do I run ArgoCD?", "how do I
manage secrets?", "how do I stand up an event bus?". This is a small
opinionated scaffold that says: here is a platform. Fork it, point it at
your git repo, run one command.

**Boring by default.** ArgoCD, ingress-nginx, External Secrets Operator, NATS
JetStream. All battle-tested, all pinned.

**Reproducible locally.** kind gives you a real cluster on your Mac in ~90s.
The manifests apply identically in prod.

**GitOps native.** ArgoCD reconciles from git. `kubectl apply` is the
bootstrap, not the deploy path.

---

## Quick start

```bash
brew install kind kubectl helm      # one-time
git clone https://github.com/jaredzwick/equity-platform ~/equity-platform
cd ~/equity-platform
./local/up.sh                        # ~3 min: kind + ArgoCD + platform apps
```

That's it. You now have a running Kubernetes cluster with ArgoCD ready to
reconcile from a git repo.

### Verified output from a real run

```
==> Ensuring kind cluster 'equity-local' exists
 ✓ Ensuring node image (kindest/node:v1.36.1)
 ✓ Starting control-plane
 ✓ Installing CNI
 ✓ Installing StorageClass
Set kubectl context to "kind-equity-local"
==> Applying namespaces
namespace/argocd created
namespace/ingress-nginx created
namespace/external-secrets created
namespace/nats created
namespace/business-prod created
==> Installing ArgoCD (pinned version)
    ArgoCD version: v2.13.1
==> Waiting for ArgoCD server to be ready (may take 2-3 min)
deployment.apps/argocd-server condition met
✓ Platform is up.
```

7/7 ArgoCD pods `Running`, admin password retrievable, UI responds with HTTP 307 in 13ms.

### Access ArgoCD

```bash
kubectl port-forward -n argocd svc/argocd-server 8080:80
open http://localhost:8080
# username: admin
# password:
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d && echo
```

### Enable GitOps reconciliation

`up.sh` runs in **local-only mode** until it can find a git remote to
reconcile from. To enable the full loop:

```bash
git remote add origin https://github.com/<your-username>/equity-platform.git
git push -u origin main
./local/up.sh   # re-run; picks up the remote, applies root app-of-apps
```

After the second `up.sh`, `kubectl -n argocd get applications` shows the
root app plus one child Application per file under `apps/`.

### Tear down

```bash
./local/down.sh
```

Idempotent. Destroys the kind cluster. All in-cluster state is lost — this
is a dev cluster, back up anything precious first.

---

## What's inside

```
equity-platform/
├── local/                    # kind cluster + up.sh / down.sh
│   ├── kind-cluster.yaml     # kind config (port mappings for ingress + nats)
│   ├── up.sh                 # bootstrap: cluster + ArgoCD + root app
│   └── down.sh               # tear down cluster
├── bootstrap/                # ArgoCD install + root app-of-apps
│   ├── 00-namespaces.yaml
│   ├── 01-argocd-install.yaml   # version pin (ConfigMap referenced by up.sh)
│   └── 03-root-app.yaml         # points at apps/, self-heals + prunes
├── apps/                     # ArgoCD Application manifests (children)
│   ├── ingress-nginx.yaml       # 4.11.3
│   ├── external-secrets.yaml    # 0.10.5
│   └── nats.yaml                # 1.2.11 (JetStream enabled)
├── charts/                   # per-app Helm values
│   ├── ingress-nginx/values.yaml
│   ├── external-secrets/values.yaml
│   └── nats/values.yaml         # single-node + file-backed JetStream
├── VERSION                   # semver of the platform contract
└── LICENSE                   # MIT
```

### Add a new platform component

1. Write `apps/<name>.yaml` (an ArgoCD Application manifest).
2. Write `charts/<name>/values.yaml` (the Helm values).
3. Commit + push.
4. ArgoCD reconciles on next sync (a few seconds). No re-run of `up.sh` needed.

### Upgrade an existing chart

1. Bump `spec.source.targetRevision` in `apps/<name>.yaml`.
2. Update `charts/<name>/values.yaml` if the new chart changes value shape.
3. Commit + push. ArgoCD upgrades in-place.

---

## The GitOps loop

```
you edit git    →    git push    →    ArgoCD reconciles    →    cluster changes
     ▲                                        │
     └────────────────────────────────────────┘
                (or: --self-heal reverts drift)
```

The root app-of-apps in `bootstrap/03-root-app.yaml` watches `apps/*.yaml`.
Each child Application watches its own chart + values. `syncPolicy.automated`
+ `selfHeal` means the cluster converges to git, always. Drift = revert.

---

## Design decisions

| Choice | Alternative considered | Why this |
|---|---|---|
| **kind** (local) | k3d, minikube, Docker Desktop | Best ArgoCD docs, mainstream, ~90s boot |
| **ArgoCD** (GitOps) | Flux, no GitOps | ArgoCD UI is a real observability surface; Flux is CLI-first |
| **App-of-apps** | ApplicationSet | Simpler mental model; ApplicationSet is worth it once you have >20 apps |
| **NATS JetStream** (bus) | Redis Streams, Kafka, Postgres LISTEN/NOTIFY | JetStream = persistent + replayable + no ZooKeeper; boring at solo-founder scale |
| **External Secrets Operator** | SOPS, Sealed Secrets, raw Secrets | Backend-agnostic; swap AWS/GCP/1Password/DO without changing app code |
| **envsubst for git URL** | kustomize, ApplicationSet | Zero extra tooling; matches the pattern many k8s shops use for image tags |

---

## Roadmap (short)

- [ ] Grafana + Prometheus + Loki stack (observability)
- [ ] cert-manager + letsencrypt ClusterIssuer
- [ ] Prometheus AlertManager → Slack notifier
- [ ] Backstage-style dashboard for one-glance infra visibility (see [issue #TBD])
- [ ] Prod cluster manifests (DO Kubernetes overlays)
- [ ] Sample services template repo showing an app deploying via this platform

---

## Prior art / thanks

- [Argo CD](https://argo-cd.readthedocs.io/) — the GitOps engine
- [kind](https://kind.sigs.k8s.io/) — Kubernetes in Docker
- [External Secrets Operator](https://external-secrets.io/)
- [NATS](https://nats.io/) — the event bus
- The pattern is standard app-of-apps; nothing novel here. The value is that
  it's fork-and-go, pinned, and verified.

---

## License

MIT. Copyright © 2026 Pypes LLC. See [LICENSE](./LICENSE).
