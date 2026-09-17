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
# Output policy:
#   Noisy commands (kind, kubectl apply, npm install, ArgoCD manifests) are
#   silenced by default and streamed to $LOG_FILE. Only per-step status
#   (✓ / ✗) reaches the terminal. On failure, the last 30 log lines are
#   dumped so the operator can debug without tailing a separate file.
#   Set VERBOSE=1 to stream everything to stdout in addition to the log.
#
# GIT_REPO_URL resolution order:
#   1. --repo-url <url> flag on the command line
#   2. GIT_REPO_URL env var
#   3. local/.config.json (githubBackup.repoUrl) — the UI-managed opt-in
#      set from the console at /master/github
#   4. If none: LOCAL-ONLY mode (cluster + ArgoCD up, no app-of-apps
#      reconciliation). Businesses live only in-cluster and are lost on
#      teardown — enable GitHub backup from the console to persist.
#
# The `git remote get-url origin` fallback was removed intentionally:
# users who cloned the upstream template directly would silently point
# ArgoCD at the upstream repo, which they don't own and can't write to.
# See commit history for the mismatch bug that motivated the change.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLUSTER_NAME="equity-local"
LOG_FILE="$SCRIPT_DIR/.up.log"
VERBOSE="${VERBOSE:-0}"

: >"$LOG_FILE"

# ── Safety brake — only ever act on the local kind cluster ──────────────
#
# This script (and everything it spawns, including the Next.js dev server
# and the MCP subprocesses that the console starts on chat) MUST target
# the local kind cluster only. A stray `export KUBECONFIG=…` in the
# operator's shell (e.g. from typing `kmitek` earlier) would otherwise
# route these commands at a remote cluster.
#
# Two layers:
#   1. Pin KUBECONFIG to ~/.kube/config so downstream processes ignore any
#      other kubeconfig path the operator's shell has exported.
#   2. Wrap `kubectl` with an explicit --context so every call — including
#      those in subshells (bash -c …) that inherit our exported function —
#      hits kind-equity-local by name. If that context doesn't exist yet
#      (first-ever run, before `kind create cluster`), kubectl fails loud
#      instead of silently hitting whatever the current-context happens
#      to be.
unset KUBECONFIG
export KUBECONFIG="$HOME/.kube/config"
# Hardcode the context name into the wrapper rather than expanding
# $CLUSTER_NAME at call time — subshells (bash -c … from quietsh) inherit
# exported functions but NOT unexported shell variables, so the naive
# expansion resolves to "kind-" inside those subshells and kubectl fails
# with `error: context "kind-" does not exist`. If CLUSTER_NAME ever
# needs to be dynamic, `export CLUSTER_NAME` above and reintroduce the
# expansion here.
kubectl() { command kubectl --context="kind-equity-local" "$@"; }
export -f kubectl

# quiet <label> <cmd> [args...] — run a command silent unless it fails.
# On success: prints "  <label>… ✓". On failure: prints "✗", dumps the
# tail of the log, and exits with the same code. Set VERBOSE=1 to also
# stream to stdout (via tee) for debugging.
quiet() {
  local label="$1"; shift
  printf "  %-52s" "${label}…"
  local rc=0
  if [ "$VERBOSE" = "1" ]; then
    "$@" 2>&1 | tee -a "$LOG_FILE"
    rc=${PIPESTATUS[0]}
  else
    "$@" >>"$LOG_FILE" 2>&1 || rc=$?
  fi
  if [ "$rc" -eq 0 ]; then
    printf " \033[32m✓\033[0m\n"
  else
    printf " \033[31m✗ (exit %d)\033[0m\n" "$rc"
    echo ""
    echo "FAILED: $label"
    echo "Last 30 lines of $LOG_FILE:"
    echo "----------------------------------------"
    tail -30 "$LOG_FILE"
    echo "----------------------------------------"
    exit "$rc"
  fi
}

# quiet_warn <label> <cmd…> — same as quiet, but non-fatal. Prints ⚠ and
# keeps going. Used for steps where a failure should be surfaced but doesn't
# invalidate the rest of the bring-up (e.g. NATS not reconciled yet).
quiet_warn() {
  local label="$1"; shift
  printf "  %-52s" "${label}…"
  local rc=0
  if [ "$VERBOSE" = "1" ]; then
    "$@" 2>&1 | tee -a "$LOG_FILE"
    rc=${PIPESTATUS[0]}
  else
    "$@" >>"$LOG_FILE" 2>&1 || rc=$?
  fi
  if [ "$rc" -eq 0 ]; then
    printf " \033[32m✓\033[0m\n"
  else
    printf " \033[33m⚠ (exit %d, continuing — see %s)\033[0m\n" "$rc" "$LOG_FILE"
  fi
  return 0
}

# quietsh <label> "<shell expression>" — same as quiet but runs a pipeline
# in bash -c. Needed for `envsubst | kubectl apply` and similar.
quietsh() {
  local label="$1"; shift
  quiet "$label" bash -c "$*"
}

# Enable versioned git hooks (idempotent). .githooks/pre-push mirrors
# Vercel's console build so broken pushes fail locally before CI.
if [ -d "$REPO_DIR/.githooks" ]; then
  current=$(git -C "$REPO_DIR" config --get core.hooksPath 2>/dev/null || echo "")
  if [ "$current" != ".githooks" ]; then
    git -C "$REPO_DIR" config core.hooksPath .githooks
    echo "  Enabled .githooks (pre-push console build gate)"
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

# --- Cluster ---
if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  echo "  kind cluster '$CLUSTER_NAME' present (reusing)"
else
  quiet "Creating kind cluster '$CLUSTER_NAME'" \
    kind create cluster --config "$SCRIPT_DIR/kind-cluster.yaml"
fi
kubectl config use-context "kind-$CLUSTER_NAME" >/dev/null

# --- ArgoCD ---
quiet "Applying namespaces" \
  kubectl apply -f "$REPO_DIR/bootstrap/00-namespaces.yaml"
quiet "Installing ArgoCD (pinned)" \
  kubectl apply -n argocd -f "$REPO_DIR/bootstrap/01-argocd-install.yaml"

ARGOCD_VERSION=$(kubectl -n argocd get configmap argocd-version-pin -o jsonpath='{.data.version}')
ARGOCD_URL=$(kubectl -n argocd get configmap argocd-version-pin -o jsonpath='{.data.upstream}')

# --server-side / --force-conflicts is required because ArgoCD's CRDs
# (notably applicationsets.argoproj.io) exceed the 262KB last-applied-
# configuration annotation limit that client-side apply relies on.
quiet "Installing ArgoCD $ARGOCD_VERSION manifests" \
  kubectl apply -n argocd --server-side --force-conflicts -f "$ARGOCD_URL"

quiet "Waiting for ArgoCD server (up to 3m)" \
  kubectl wait --for=condition=available --timeout=300s -n argocd deployment/argocd-server

# --- Business restore from local snapshot ---
# `./local/down.sh` captures every tenant-labeled Namespace to a snapshot
# file on disk (local/.state/businesses.yaml). This restore step re-applies
# them so `down.sh && up.sh` no longer silently loses businesses the operator
# created via the UI. Runs independent of GitHub — works even when the fork
# backup is off or the console's commit failed.
BUSINESSES_SNAPSHOT="$SCRIPT_DIR/.state/businesses.yaml"
if [ -f "$BUSINESSES_SNAPSHOT" ]; then
  snap_count=$(grep -c '^  name:' "$BUSINESSES_SNAPSHOT" 2>/dev/null || echo 0)
  if [ "$snap_count" -gt 0 ]; then
    quiet "Restoring $snap_count business(es) from snapshot" \
      kubectl apply -f "$BUSINESSES_SNAPSHOT"
  fi
fi

# --- Git repo URL resolution ---
CONFIG_FILE="$SCRIPT_DIR/.config.json"
GIT_REPO_URL=""
GIT_REPO_SOURCE=""

if [ -n "$REPO_URL_FLAG" ]; then
  GIT_REPO_URL="$REPO_URL_FLAG"
  GIT_REPO_SOURCE="--repo-url flag"
elif [ -n "${GIT_REPO_URL:-}" ]; then
  GIT_REPO_SOURCE="GIT_REPO_URL env"
elif [ -f "$CONFIG_FILE" ]; then
  # Minimal JSON extraction — avoids a jq dependency for a one-key read.
  # Matches: "repoUrl": "..." and only when "enabled": true earlier in the file.
  if grep -q '"enabled"[[:space:]]*:[[:space:]]*true' "$CONFIG_FILE"; then
    GIT_REPO_URL=$(sed -n 's/.*"repoUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$CONFIG_FILE" | head -1)
    [ -n "$GIT_REPO_URL" ] && GIT_REPO_SOURCE="$CONFIG_FILE"
  fi
fi

NATS_PF_PID_FILE="$SCRIPT_DIR/.nats-pf.pid"
NATS_PF_LOG="$SCRIPT_DIR/.nats-pf.log"

if [ -z "$GIT_REPO_URL" ]; then
  echo "  Local-only mode (no GitHub backup — enable via console → Agency → GitHub)"
else
  # Surface where the URL came from — useful when debugging "why is
  # ArgoCD pointing at the wrong fork" without hunting through env +
  # flags + config files by hand.
  echo "  GIT repo URL: $GIT_REPO_URL (source: $GIT_REPO_SOURCE)"
  export GIT_REPO_URL

  # --- ArgoCD private-repo credential ---
  # ArgoCD needs an HTTPS credential when the fork is private (which is the
  # normal case for the -private variant of this repo). Without it, the root
  # app-of-apps applies but stays permanently OutOfSync/Missing because
  # ArgoCD can't fetch apps/*.yaml, which cascades into "NATS never appears".
  # Resolution order for the token:
  #   1. GITHUB_TOKEN in the shell env
  #   2. GITHUB_TOKEN=... in console/.env.local (dev fallback so operators
  #      don't have to remember to `export` it every session)
  # If neither is available we skip credential registration and print a hint.
  gh_token="${GITHUB_TOKEN:-}"
  if [ -z "$gh_token" ] && [ -f "$REPO_DIR/console/.env.local" ]; then
    gh_token=$(grep -E '^GITHUB_TOKEN=' "$REPO_DIR/console/.env.local" 2>/dev/null \
      | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
  fi
  if [ -n "$gh_token" ]; then
    # ArgoCD picks up any Secret in argocd/ with the repository label. The
    # `x-access-token` username is GitHub's convention for token-as-password
    # over HTTPS; the actual username field is ignored. server-side apply so
    # re-running up.sh updates the token in place cleanly.
    quietsh "Registering ArgoCD repo credential" \
      "kubectl apply --server-side --force-conflicts -f - <<YAML
apiVersion: v1
kind: Secret
metadata:
  name: repo-equity-fork
  namespace: argocd
  labels:
    argocd.argoproj.io/secret-type: repository
type: Opaque
stringData:
  type: git
  url: ${GIT_REPO_URL}
  username: x-access-token
  password: ${gh_token}
YAML"
  else
    echo "  GITHUB_TOKEN not found — ArgoCD may 401 on the private fork."
    echo "    Fix: export GITHUB_TOKEN=<PAT> or add GITHUB_TOKEN=... to console/.env.local"
  fi

  # Single-quoted '${GIT_REPO_URL}' is intentional — envsubst reads its args
  # as a list of variable NAMES to substitute, not values. Escaped \$ so the
  # outer double-quoted string passes the literal ${GIT_REPO_URL} through to
  # bash -c, where the single quotes then shield it from expansion.
  quietsh "Applying root app-of-apps" \
    "envsubst '\${GIT_REPO_URL}' < '$REPO_DIR/bootstrap/03-root-app.yaml' | kubectl apply -f -"

  # --- Business restore from fork ---
  # The console writes each new business (a tenant-labeled Namespace) to
  # bootstrap/00-namespaces.yaml on the fork via GitHub App. Without this
  # step, `./local/down.sh && ./local/up.sh` wipes the cluster and re-applies
  # ONLY the local bootstrap file, silently dropping any business the operator
  # created through the UI. Fix: if `origin` points at the same fork that the
  # console commits to, `git fetch` and re-apply the fork's version of the
  # bootstrap file (which is a superset of the local one).
  _norm_url() { local u="${1%.git}"; echo "${u%/}"; }
  origin_url=$(cd "$REPO_DIR" && git remote get-url origin 2>/dev/null || echo "")
  if [ -n "$origin_url" ] && [ "$(_norm_url "$origin_url")" = "$(_norm_url "$GIT_REPO_URL")" ]; then
    quietsh "Restoring businesses from fork" \
      "cd '$REPO_DIR' && git fetch origin --quiet 2>/dev/null && git show origin/main:bootstrap/00-namespaces.yaml | kubectl apply -f -"
  else
    echo "  Skipping business restore (origin='$origin_url' ≠ fork='$GIT_REPO_URL')"
    echo "  Add the fork as origin to enable auto-restore across up/down cycles."
  fi

  # --- NATS auto-forward ---
  # ArgoCD reconciles apps/nats.yaml → NATS StatefulSet, but that's async on a
  # fresh cluster (chart pull + image pull + pod boot). The console runs on
  # the host and reads http://localhost:8222/jsz for JetStream monitoring;
  # without a port-forward the /events page + chat context both show
  # "NATS monitoring unreachable" and the operator has to run the forward
  # manually. Non-fatal — a slow reconcile or missing credential shouldn't
  # halt up.sh (cluster is otherwise usable, ArgoCD tab surfaces the error).
  quiet_warn "Waiting for NATS StatefulSet (via ArgoCD)" bash -c \
    "for i in \$(seq 1 90); do kubectl -n nats get statefulset nats >/dev/null 2>&1 && break; sleep 2; done; kubectl -n nats wait --for=jsonpath='{.status.readyReplicas}'=1 statefulset/nats --timeout=300s"

  # Only start the port-forward if the StatefulSet is actually Ready. A dead
  # kubectl port-forward for a non-existent Service just churns and confuses
  # the console with connection resets.
  if kubectl -n nats get statefulset nats -o jsonpath='{.status.readyReplicas}' 2>/dev/null | grep -qx "1"; then
    reuse_pf="no"
    if [ -f "$NATS_PF_PID_FILE" ]; then
      pf_pid=$(cat "$NATS_PF_PID_FILE" 2>/dev/null || echo "")
      if [ -n "$pf_pid" ] && kill -0 "$pf_pid" 2>/dev/null; then
        pf_holder=$(lsof -ti "tcp:8222" 2>/dev/null | head -1 || true)
        if [ "$pf_holder" = "$pf_pid" ]; then
          reuse_pf="yes"
        fi
      fi
    fi
    if [ "$reuse_pf" = "yes" ]; then
      echo "  NATS port-forward already running (PID $(cat "$NATS_PF_PID_FILE"))"
    else
      rm -f "$NATS_PF_PID_FILE"
      nohup kubectl port-forward -n nats svc/nats-headless 8222:8222 4222:4222 \
        >"$NATS_PF_LOG" 2>&1 &
      echo $! >"$NATS_PF_PID_FILE"
      disown
      echo "  NATS port-forward started (PID $(cat "$NATS_PF_PID_FILE")) — :8222 monitor, :4222 client"
    fi
  else
    echo "  Skipping NATS port-forward — StatefulSet not Ready yet."
    echo "    Common cause: ArgoCD can't pull the fork (see 'Registering ArgoCD repo credential' above)."
    echo "    Once ArgoCD syncs, run: kubectl -n nats wait --for=jsonpath='{.status.readyReplicas}'=1 statefulset/nats --timeout=300s && kubectl port-forward -n nats svc/nats-headless 8222:8222 4222:4222 &"
  fi
fi

# --- AI runner image + per-tenant Secret bootstrap ---
# Fold the two `make runner` / `make runner-secret NS=…` steps into the
# reproducibility contract so `./local/up.sh` alone is sufficient for
# AI-scheduled crons to work. Graceful:
#   - docker daemon down    → skip image build, warn (shell crons still work)
#   - CLAUDE_CODE_OAUTH_TOKEN missing → skip secret seeding, warn
#   - AI_RUNNER=0 in env    → skip entire section (explicit opt-out)
# See runners/claude-runner/README.md for what this image does.
RUNNER_IMAGE="equity/claude-runner:latest"
RUNNER_DIR="$REPO_DIR/runners/claude-runner"
RUNNER_IMAGE_READY="no"
RUNNER_TOKEN_PRESENT="no"
RUNNER_STATUS_LINE=""

if [ "${AI_RUNNER:-1}" = "0" ]; then
  RUNNER_STATUS_LINE="skipped (AI_RUNNER=0)"
else
  # Try to source CLAUDE_CODE_OAUTH_TOKEN from console/.env.local without
  # exporting every other variable that file may hold (some contain
  # shell-hostile characters like $ in JWTs). Grep the one line we care
  # about, evaluate defensively.
  if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && [ -f "$REPO_DIR/console/.env.local" ]; then
    token_line=$(grep -E '^CLAUDE_CODE_OAUTH_TOKEN=' "$REPO_DIR/console/.env.local" | tail -1 || true)
    if [ -n "$token_line" ]; then
      # Strip prefix + optional surrounding quotes.
      token_val="${token_line#CLAUDE_CODE_OAUTH_TOKEN=}"
      token_val="${token_val%\"}"; token_val="${token_val#\"}"
      token_val="${token_val%\'}"; token_val="${token_val#\'}"
      if [ -n "$token_val" ]; then
        export CLAUDE_CODE_OAUTH_TOKEN="$token_val"
      fi
    fi
  fi
  [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] && RUNNER_TOKEN_PRESENT="yes"

  # Build + load only if docker is actually up. `docker version` returns
  # non-zero when the daemon is stopped even though the client is installed.
  if command -v docker >/dev/null 2>&1 && docker version >/dev/null 2>&1; then
    quiet_warn "Building $RUNNER_IMAGE"  docker build -t "$RUNNER_IMAGE" "$RUNNER_DIR"
    quiet_warn "Loading $RUNNER_IMAGE into kind" \
      kind load docker-image "$RUNNER_IMAGE" --name "$CLUSTER_NAME"
    # Re-check the image is actually present in the node — quiet_warn tolerates
    # failures so we don't want a silently-broken build to look "ready".
    if docker exec "${CLUSTER_NAME}-control-plane" crictl images 2>/dev/null | grep -q "equity/claude-runner"; then
      RUNNER_IMAGE_READY="yes"
    fi
  else
    echo "  Skipping AI runner image build — docker daemon not reachable."
    echo "    Fix (optional): start Docker Desktop, then rerun. Shell-mode crons work regardless."
  fi

  # Seed the claude-runner-auth Secret in every existing tenant namespace.
  # New tenants get the secret auto-seeded on business creation (see
  # console/lib/runner-secret.ts + console/mcp/server.ts). This loop
  # handles restore-from-snapshot cases where tenants pre-existed.
  if [ "$RUNNER_TOKEN_PRESENT" = "yes" ]; then
    tenant_nss=$(kubectl get ns -l equity.io/tenant --no-headers -o custom-columns=NAME:.metadata.name 2>/dev/null || true)
    if [ -n "$tenant_nss" ]; then
      seeded=0
      for ns in $tenant_nss; do
        if kubectl create secret generic claude-runner-auth \
             --from-literal=oauth-token="$CLAUDE_CODE_OAUTH_TOKEN" \
             -n "$ns" \
             --dry-run=client -o yaml \
           | kubectl apply -f - >>"$LOG_FILE" 2>&1; then
          seeded=$((seeded + 1))
        fi
      done
      [ "$seeded" -gt 0 ] && echo "  Seeded claude-runner-auth in $seeded tenant namespace(s)"
    fi
  fi

  # Compose a single status line for the summary block below.
  if [ "$RUNNER_IMAGE_READY" = "yes" ] && [ "$RUNNER_TOKEN_PRESENT" = "yes" ]; then
    RUNNER_STATUS_LINE="ready (image loaded, token seeded on existing + new tenants)"
  elif [ "$RUNNER_IMAGE_READY" = "yes" ]; then
    RUNNER_STATUS_LINE="partial — image loaded, no CLAUDE_CODE_OAUTH_TOKEN → chat's create_cron will fail pre-flight until set"
  elif [ "$RUNNER_TOKEN_PRESENT" = "yes" ]; then
    RUNNER_STATUS_LINE="partial — token set but docker not reachable → image missing, cron pods will ImagePullBackOff"
  else
    RUNNER_STATUS_LINE="unavailable — set CLAUDE_CODE_OAUTH_TOKEN in console/.env.local AND start Docker, then rerun"
  fi
fi

# --- Console UI (Next.js dev server on :3030) ---
CONSOLE_DIR="$REPO_DIR/console"
CONSOLE_PORT=3030
CONSOLE_PID_FILE="$SCRIPT_DIR/.console.pid"
CONSOLE_LOG_FILE="$SCRIPT_DIR/.console.log"

if [ ! -d "$CONSOLE_DIR/node_modules" ]; then
  quietsh "Installing console dependencies" "cd '$CONSOLE_DIR' && npm install"
fi

# Pre-flight: check who (if anyone) actually holds :$CONSOLE_PORT. The
# .console.pid file records the npm wrapper, but `npm run dev` forks a
# `next-server` child that outlives the wrapper — so a bare PID check can
# lie (wrapper gone, child still serving). Test the port itself, then
# reconcile against the PID file.
port_holder=$(lsof -ti "tcp:$CONSOLE_PORT" 2>/dev/null || true)
recorded_pid=""
[ -f "$CONSOLE_PID_FILE" ] && recorded_pid=$(cat "$CONSOLE_PID_FILE" 2>/dev/null || echo "")

if [ -n "$port_holder" ]; then
  is_ours="no"
  if [ -n "$recorded_pid" ] && kill -0 "$recorded_pid" 2>/dev/null; then
    parent_of_holder=$(ps -o ppid= -p "$port_holder" 2>/dev/null | tr -d ' ' || echo "")
    if [ "$port_holder" = "$recorded_pid" ] || [ "$parent_of_holder" = "$recorded_pid" ]; then
      is_ours="yes"
    fi
  fi
  if [ "$is_ours" = "yes" ]; then
    echo "  Console already running (wrapper $recorded_pid, listener $port_holder)"
  else
    echo ""
    echo "ERROR: :$CONSOLE_PORT is held by PID $port_holder, which we don't own."
    echo "       Most likely an orphaned next-server from a previous run whose"
    echo "       wrapper PID was killed but child survived."
    echo ""
    echo "       Fix:  ./local/down.sh"
    echo "       Or:   lsof -i :$CONSOLE_PORT   then kill the offending PID."
    echo ""
    exit 1
  fi
else
  # Port is free. Blow away .next so a stale half-compiled build (from
  # Ctrl-C in a previous run) doesn't wedge Next.js dev.
  rm -rf "$CONSOLE_DIR/.next"
  # EQUITY_STATE_DIR pins the host-fs persistence root (profiles, snapshots)
  # to local/.state so it lines up with what down.sh reads/writes. Without
  # this the console would fall back to guessing from process.cwd().
  (cd "$CONSOLE_DIR" && EQUITY_STATE_DIR="$SCRIPT_DIR/.state" \
    nohup npm run dev >"$CONSOLE_LOG_FILE" 2>&1 &
    echo $! >"$CONSOLE_PID_FILE")
  echo "  Console started (PID $(cat "$CONSOLE_PID_FILE"))"
fi

# --- Summary ---
cat <<EOF

✓ Platform up.

  Console:    http://localhost:3030
  ArgoCD UI:  kubectl port-forward -n argocd svc/argocd-server 8080:80  →  http://localhost:8080
  Password:   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d ; echo
  NATS mon:   http://localhost:8222/jsz  (port-forward auto-started, kill via ./local/down.sh)
  AI runner:  ${RUNNER_STATUS_LINE}

  Logs: $LOG_FILE   (VERBOSE=1 ./local/up.sh to stream live)

EOF
