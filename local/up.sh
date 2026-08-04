#!/usr/bin/env bash
# up.sh — bring up local kind cluster + ArgoCD + platform apps.
# Idempotent: safe to re-run.
#
# Flow:
#   1. Ensure prereqs are installed (kind, kubectl, helm, envsubst).
#   2. Create (or reuse) the kind cluster.
#   3. Install ArgoCD at the pinned version.
#   4. Resolve the git repo URL for ArgoCD to reconcile FROM.
#   5. Envsubst the ${GIT_REPO_URL} placeholder in manifests, apply.
#
# GIT_REPO_URL resolution order:
#   1. --repo-url <url> flag on the command line
#   2. GIT_REPO_URL env var
#   3. `git remote get-url origin` from this repo
#   4. If none: fall back to LOCAL-ONLY mode (cluster + ArgoCD up, but no
#      app-of-apps reconciliation — you can still apply children by hand for
#      demo purposes).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLUSTER_NAME="equity-local"

# Enable versioned git hooks (idempotent). .githooks/pre-push mirrors
# Vercel's console build so broken pushes fail locally before CI.
if [ -d "$REPO_DIR/.githooks" ]; then
  current=$(git -C "$REPO_DIR" config --get core.hooksPath 2>/dev/null || echo "")
  if [ "$current" != ".githooks" ]; then
    git -C "$REPO_DIR" config core.hooksPath .githooks
    echo "Enabled .githooks (pre-push console build gate)"
  fi
fi

# Parse args
REPO_URL_FLAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --repo-url) REPO_URL_FLAG="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "MISSING: $1"
    [ -n "${2:-}" ] && echo "  Install with: brew install $2"
    exit 1
  fi
}
need kind kind
need kubectl kubernetes-cli
need helm helm
need envsubst gettext
need node node
need npm node

echo "==> Ensuring kind cluster '$CLUSTER_NAME' exists"
if ! kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  kind create cluster --config "$SCRIPT_DIR/kind-cluster.yaml"
else
  echo "    cluster already exists, reusing"
fi

kubectl config use-context "kind-$CLUSTER_NAME" >/dev/null

echo "==> Applying namespaces"
kubectl apply -f "$REPO_DIR/bootstrap/00-namespaces.yaml"

echo "==> Installing ArgoCD (pinned version)"
kubectl apply -n argocd -f "$REPO_DIR/bootstrap/01-argocd-install.yaml"
ARGOCD_VERSION=$(kubectl -n argocd get configmap argocd-version-pin -o jsonpath='{.data.version}')
ARGOCD_URL=$(kubectl -n argocd get configmap argocd-version-pin -o jsonpath='{.data.upstream}')
echo "    ArgoCD version: $ARGOCD_VERSION"
# --server-side / --force-conflicts is required because ArgoCD's CRDs
# (notably applicationsets.argoproj.io) exceed the 262KB last-applied-
# configuration annotation limit that client-side apply relies on.
kubectl apply -n argocd --server-side --force-conflicts -f "$ARGOCD_URL"

echo "==> Waiting for ArgoCD server to be ready (may take 2-3 min)"
kubectl wait --for=condition=available --timeout=300s -n argocd deployment/argocd-server

# Resolve git repo URL.
GIT_REPO_URL=""
if [ -n "$REPO_URL_FLAG" ]; then
  GIT_REPO_URL="$REPO_URL_FLAG"
elif [ -n "${GIT_REPO_URL:-}" ]; then
  : # already set from env
elif GIT_REPO_URL=$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null); then
  # Normalize SSH → HTTPS for ArgoCD public-repo path.
  GIT_REPO_URL=$(echo "$GIT_REPO_URL" | sed -E 's|^git@github\.com:|https://github.com/|; s|\.git$||').git
fi

if [ -z "$GIT_REPO_URL" ]; then
  echo ""
  echo "==> LOCAL-ONLY mode (no git remote configured)"
  echo "    Cluster + ArgoCD are up. Root app-of-apps NOT applied."
  echo "    To enable GitOps reconciliation:"
  echo "      1. git remote add origin https://github.com/<you>/equity-platform.git"
  echo "      2. git push -u origin main"
  echo "      3. ./local/up.sh  (re-run — will pick up the remote)"
  echo ""
else
  echo "==> Applying root app-of-apps (repo: $GIT_REPO_URL)"
  export GIT_REPO_URL
  # Single-quoted '${GIT_REPO_URL}' is intentional — envsubst reads its args
  # as a list of variable NAMES to substitute, not values. Double quotes
  # would let the shell expand the variable first, leaving envsubst with no
  # var to substitute. Same pattern pypes uses for its cron manifests.
  # shellcheck disable=SC2016
  envsubst '${GIT_REPO_URL}' < "$REPO_DIR/bootstrap/03-root-app.yaml" | kubectl apply -f -
fi

# Start the console UI (Next.js dev server on :3030) in the background so
# the whole local stack is one command. Idempotent via PID file — re-runs
# reuse an already-running server. Logs stream to $CONSOLE_LOG_FILE.
# `down.sh` is responsible for stopping the process on teardown.
CONSOLE_DIR="$REPO_DIR/console"
CONSOLE_PID_FILE="$SCRIPT_DIR/.console.pid"
CONSOLE_LOG_FILE="$SCRIPT_DIR/.console.log"

echo "==> Ensuring console dependencies are installed"
if [ ! -d "$CONSOLE_DIR/node_modules" ]; then
  (cd "$CONSOLE_DIR" && npm install)
else
  echo "    node_modules present, skipping npm install"
fi

echo "==> Starting console UI (Next.js on :3030)"
if [ -f "$CONSOLE_PID_FILE" ] && kill -0 "$(cat "$CONSOLE_PID_FILE")" 2>/dev/null; then
  echo "    already running (PID $(cat "$CONSOLE_PID_FILE"))"
else
  (cd "$CONSOLE_DIR" && nohup npm run dev >"$CONSOLE_LOG_FILE" 2>&1 &
    echo $! >"$CONSOLE_PID_FILE")
  echo "    started (PID $(cat "$CONSOLE_PID_FILE")), logs: $CONSOLE_LOG_FILE"
fi

echo ""
echo "✓ Platform is up."
echo ""
echo "Console UI:"
echo "  open http://localhost:3030"
echo "  tail -f $CONSOLE_LOG_FILE"
echo ""
echo "ArgoCD UI:"
echo "  kubectl port-forward -n argocd svc/argocd-server 8080:80"
echo "  open http://localhost:8080"
echo ""
echo "Admin password:"
echo "  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d && echo"
echo ""
echo "Sync status:"
echo "  kubectl -n argocd get applications"
