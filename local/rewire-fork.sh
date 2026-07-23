#!/usr/bin/env bash
# rewire-fork.sh — after you fork this repo to your own account, run this
# once to point every ArgoCD Application's git-values source at YOUR fork
# instead of the upstream jaredzwick/equity-platform.
#
# Usage:
#   ./local/rewire-fork.sh                   # infers from `git remote get-url origin`
#   ./local/rewire-fork.sh --url <https://…> # explicit override
#
# Idempotent — re-runs are safe.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

URL_FLAG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --url) URL_FLAG="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [ -n "$URL_FLAG" ]; then
  NEW_URL="$URL_FLAG"
else
  NEW_URL=$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null || true)
  if [ -z "$NEW_URL" ]; then
    echo "ERROR: no --url and no 'origin' git remote. Nothing to rewire."
    exit 1
  fi
  # Normalize SSH → HTTPS (ArgoCD is easier without SSH auth on kind).
  NEW_URL=$(echo "$NEW_URL" | sed -E 's|^git@github\.com:|https://github.com/|; s|\.git$||').git
fi

# The upstream URL that ships in every apps/*.yaml.
UPSTREAM="https://github.com/jaredzwick/equity-platform.git"

if [ "$NEW_URL" = "$UPSTREAM" ]; then
  echo "Already pointing at upstream ($UPSTREAM). Nothing to do."
  exit 0
fi

echo "Rewiring apps/*.yaml:"
echo "  from: $UPSTREAM"
echo "  to:   $NEW_URL"
echo ""

CHANGED=0
for f in "$REPO_DIR"/apps/*.yaml; do
  if grep -q "$UPSTREAM" "$f"; then
    sed -i.bak "s|$UPSTREAM|$NEW_URL|g" "$f"
    rm -f "$f.bak"
    echo "  ✓ $f"
    CHANGED=$((CHANGED + 1))
  fi
done

echo ""
if [ "$CHANGED" -eq 0 ]; then
  echo "No files needed changes. Already rewired?"
else
  echo "Rewired $CHANGED file(s). Commit + push to complete:"
  echo "  git add apps/ && git commit -m 'chore: rewire ArgoCD sources to fork' && git push"
fi
