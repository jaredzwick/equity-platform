#!/usr/bin/env bash
# down.sh — destroy the local kind cluster. All in-cluster state is lost.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="equity-local"

CONSOLE_PID_FILE="$SCRIPT_DIR/.console.pid"
if [ -f "$CONSOLE_PID_FILE" ]; then
  pid=$(cat "$CONSOLE_PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    echo "✓ Console UI (PID $pid) stopped."
  fi
  rm -f "$CONSOLE_PID_FILE"
fi

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  kind delete cluster --name "$CLUSTER_NAME"
  echo "✓ Cluster '$CLUSTER_NAME' deleted."
else
  echo "No cluster named '$CLUSTER_NAME' — nothing to do."
fi
