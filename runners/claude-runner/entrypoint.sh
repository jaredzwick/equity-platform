#!/bin/sh
# entrypoint.sh — thin shim over runner.mjs.
#
# Validates required env fast (so a missing $PROMPT fails at container start,
# not after a 30-second claude subprocess boot) and then hands off. Kept as
# /bin/sh (not bash) so this stays portable to alpine-based downstream
# rebases.

set -u

fail() {
  printf '[claude-runner] ✗ %s\n' "$1" >&2
  exit 2
}

# Explicit conditionals rather than ${VAR:?} — the latter aborts the shell
# with exit 1 before we can print our own message + exit 2. Names are
# quoted with single-quote/dollar concatenation so shellcheck doesn't
# flag them as accidental unexpanded-variable references (SC2016).
[ -n "${PROMPT:-}" ]                  || fail "the runner needs an instruction to execute — set PROMPT."
[ -n "${TENANT:-}" ]                  || fail "TENANT is required — tenant slug for the outgoing NATS event."
[ -n "${CRON_NAME:-}" ]               || fail "CRON_NAME is required — cron name for envelope metadata."
[ -n "${NATS_URL:-}" ]                || fail "NATS_URL is required — where to publish the completion event."
[ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ] || fail "CLAUDE_CODE_OAUTH_TOKEN is required — mount via the claude-runner-auth Secret."

# ANTHROPIC_API_KEY MUST be empty so the CLI takes the OAuth path (Max
# subscription) instead of billing per-token against a paid API key. Mirrors
# the guarding in console/app/api/chat/route.ts.
export ANTHROPIC_API_KEY=""

exec node /runner/runner.mjs
