#!/usr/bin/env bash
# down.sh — destroy the local kind cluster. All in-cluster state is lost.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLUSTER_NAME="equity-local"
CONSOLE_PORT=3030
CONSOLE_PID_FILE="$SCRIPT_DIR/.console.pid"

# Stop the console. `npm run dev` forks `next-server` as a child process
# that keeps holding :$CONSOLE_PORT if the wrapper is killed alone. That
# orphan then serves 500s from a half-torn .next on the next `up.sh` run.
# Fix: kill the wrapper + children, then sweep by port, then verify.
stop_console() {
  if [ -f "$CONSOLE_PID_FILE" ]; then
    pid=$(cat "$CONSOLE_PID_FILE" 2>/dev/null || echo "")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      pkill -TERM -P "$pid" 2>/dev/null || true
      kill -TERM "$pid" 2>/dev/null || true
      echo "✓ Console wrapper (PID $pid) + children signaled."
    fi
    rm -f "$CONSOLE_PID_FILE"
  fi

  # Belt-and-suspenders: anything still holding :$CONSOLE_PORT gets killed.
  # Scoped by port so unrelated Next dev servers on other ports survive.
  local port_pids
  port_pids=$(lsof -ti "tcp:$CONSOLE_PORT" 2>/dev/null || true)
  if [ -n "$port_pids" ]; then
    # shellcheck disable=SC2086
    kill -TERM $port_pids 2>/dev/null || true
    sleep 1
    port_pids=$(lsof -ti "tcp:$CONSOLE_PORT" 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
      # shellcheck disable=SC2086
      kill -KILL $port_pids 2>/dev/null || true
    fi
    echo "✓ Cleared orphan listener(s) on :$CONSOLE_PORT."
  fi

  # Confirm — up.sh's pre-flight is a hard fail if this port is still taken.
  for _ in 1 2 3 4 5; do
    lsof -ti "tcp:$CONSOLE_PORT" >/dev/null 2>&1 || return 0
    sleep 1
  done
  echo "⚠  :$CONSOLE_PORT still bound after teardown — inspect: lsof -i :$CONSOLE_PORT"
}

stop_console

if [ -d "$REPO_DIR/console/.next" ]; then
  rm -rf "$REPO_DIR/console/.next"
  echo "✓ Console .next cache cleared."
fi

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  kind delete cluster --name "$CLUSTER_NAME"
  echo "✓ Cluster '$CLUSTER_NAME' deleted."
else
  echo "No cluster named '$CLUSTER_NAME' — nothing to do."
fi
