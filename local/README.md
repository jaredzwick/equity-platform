# Local dev cluster

Runs the full equity-platform stack on kind (Kubernetes IN Docker) — zero
cloud cost, boots in ~2 min, tears down cleanly.

## Prereqs

```bash
brew install kind kubectl helm
```

## Bring up

```bash
./up.sh
```

That command:
1. Creates a kind cluster named `equity-local` (or reuses if present).
2. Applies namespaces.
3. Installs ArgoCD at the pinned version.
4. Applies the root app-of-apps → ArgoCD reconciles every `apps/*.yaml` in the parent repo.

After ~2-3 min, `kubectl -n argocd get applications` should show all children Synced/Healthy.

## The GitOps loop, locally

ArgoCD needs a git URL to reconcile from. The root app-of-apps in
`bootstrap/03-root-app.yaml` currently points at `github.com/CHANGE_ME/equity-platform.git`.

**Before running up.sh the first time:**

1. Push this repo to a private GitHub repo (e.g., `github.com/<you>/equity-platform`).
2. Update the two `CHANGE_ME` lines in `bootstrap/03-root-app.yaml` and each `apps/*.yaml`.
3. If the repo is private, register a GitHub deploy key with ArgoCD:
   ```
   argocd repo add https://github.com/<you>/equity-platform.git --ssh-private-key-path ~/.ssh/id_ed25519
   ```

**Fully-offline alternative** (no GitHub push required): run a local gitea
instance in the same cluster and point the root app at `http://gitea.gitea.svc:3000/...`.
Not documented here yet — a TODO for when the private-repo flow is a friction point.

## Access

```bash
# ArgoCD UI
kubectl port-forward -n argocd svc/argocd-server 8080:80
open http://localhost:8080
# username: admin
# password:
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d && echo

# NATS (for local publisher/consumer testing from your host)
kubectl port-forward -n nats svc/nats 4222:4222
# Or just use the extraPortMapping in kind-cluster.yaml (already maps host 4222).

# Ingress
# Host ports 8080 → cluster 80, 8443 → cluster 443 (set in kind-cluster.yaml).
```

## Tear down

```bash
./down.sh
```

Deletes the kind cluster and all state. Idempotent.

## Cost

$0. Everything runs in Docker on your Mac.
