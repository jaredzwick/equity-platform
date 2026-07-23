#!/usr/bin/env bash
# down.sh — destroy the local kind cluster. All in-cluster state is lost.
set -euo pipefail
CLUSTER_NAME="equity-local"
if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  kind delete cluster --name "$CLUSTER_NAME"
  echo "✓ Cluster '$CLUSTER_NAME' deleted."
else
  echo "No cluster named '$CLUSTER_NAME' — nothing to do."
fi
