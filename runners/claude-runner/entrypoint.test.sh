#!/usr/bin/env bash
# entrypoint.test.sh — env-validation tests for entrypoint.sh.
#
# Runs the entrypoint with progressively-more-populated env and asserts
# the right variable is complained about. Kept as plain bash so `shellcheck`
# in CI covers it too; no bats-core dependency.
#
# Usage:
#   ./entrypoint.test.sh
# Exits non-zero on the first failure.

set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
ENTRYPOINT="$HERE/entrypoint.sh"

fail_count=0

expect_exit() {
  local wanted="$1"; shift
  local label="$1"; shift
  # Capture stdout+stderr and exit code without triggering set -e.
  set +e
  output=$("$@" 2>&1)
  actual=$?
  set -e
  if [ "$actual" -ne "$wanted" ]; then
    printf '✗ %s — wanted exit %d, got %d\n' "$label" "$wanted" "$actual"
    printf '  output: %s\n' "$output"
    fail_count=$((fail_count + 1))
  else
    printf '✓ %s\n' "$label"
  fi
}

expect_output_contains() {
  local needle="$1"; shift
  local label="$1"; shift
  set +e
  output=$("$@" 2>&1)
  set -e
  case "$output" in
    *"$needle"*)
      printf '✓ %s (output contains %q)\n' "$label" "$needle"
      ;;
    *)
      printf '✗ %s — output missing %q\n' "$label" "$needle"
      printf '  output: %s\n' "$output"
      fail_count=$((fail_count + 1))
      ;;
  esac
}

# Missing PROMPT — should exit 2 and mention PROMPT.
expect_exit 2 "empty env → non-zero exit" \
  env -i sh "$ENTRYPOINT"

expect_output_contains "PROMPT" "empty env → error mentions PROMPT" \
  env -i sh "$ENTRYPOINT"

# PROMPT set, TENANT missing.
expect_output_contains "TENANT" "PROMPT set only → error mentions TENANT" \
  env -i PROMPT="hi" sh "$ENTRYPOINT"

# PROMPT + TENANT set, CRON_NAME missing.
expect_output_contains "CRON_NAME" "PROMPT+TENANT set → error mentions CRON_NAME" \
  env -i PROMPT="hi" TENANT="test" sh "$ENTRYPOINT"

# PROMPT + TENANT + CRON_NAME set, NATS_URL missing.
expect_output_contains "NATS_URL" "PROMPT+TENANT+CRON_NAME set → error mentions NATS_URL" \
  env -i PROMPT="hi" TENANT="test" CRON_NAME="c" sh "$ENTRYPOINT"

# Everything except CLAUDE_CODE_OAUTH_TOKEN.
expect_output_contains "CLAUDE_CODE_OAUTH_TOKEN" "all-but-oauth → error mentions token" \
  env -i PROMPT="hi" TENANT="test" CRON_NAME="c" NATS_URL="nats://localhost:4222" \
    sh "$ENTRYPOINT"

if [ "$fail_count" -eq 0 ]; then
  printf '\nAll checks passed.\n'
else
  printf '\n%d check(s) failed.\n' "$fail_count"
  exit 1
fi
