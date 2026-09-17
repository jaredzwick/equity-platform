# TODOs

Deferred work with rationale. Kept in git so items don't rot in a backlog
tool nobody opens. Add new items at the top; leave completed ones for a
release note pass to clean up.

## From cron-nl-editor (2026-09-16)

### Chat inject when persistence lands

**What:** Have the claude-runner post its `summary` back into the tenant
chat as an assistant message the operator sees next time they open the
console.

**Why:** Today the runner publishes `events.<tenant>.cron.completed` to
NATS; nobody reads pod logs. Chat inject is the "wait, my weekly GSC
audit ran — here are the suggestions" UX we skipped in v1.

**Blocked by:** chat has no persistence — messages are in-memory per
browser session (see `console/app/[tenant]/chat/ChatUI.tsx`). Persist
chat threads to Postgres first, then wire a small consumer that reads
`events.<tenant>.cron.completed` and appends a system-assistant message.

### `/cron` page badge for AI-runner crons

**What:** The `equity.io/runner: claude` label is already applied to
runner-mode CronJobs; the `/cron` list page should show a "🤖 AI" badge
next to those rows and expose a "view last output" panel (fetches
recent `events.<tenant>.cron.completed` matching the cron name).

**Why:** Operators need to differentiate "shell cron I wrote" from "AI
cron I asked chat for" at a glance, and see the output without
`kubectl logs`.

**Depends on:** nothing structural — the label lands with the initial PR;
the UI can consume it whenever.

### Publish claude-runner to ghcr.io

**What:** GitHub Actions workflow that builds `equity/claude-runner`, tags
by commit SHA + `latest`, pushes to `ghcr.io/<owner>/claude-runner`.

**Why:** Enables multi-machine deployment (a second operator on a second
laptop doesn't have to run `./local/up.sh` with a docker daemon). Today
the image is built lazily by up.sh, which matches our
"console-is-local-only" reality; this becomes real when we want a hosted
variant or a demo cluster.

**Depends on:** deciding hosted-vs-local strategy. Don't do speculatively.

### Reconcile subject grammar for cron events

**What:** Either extend `console/lib/events/subject.ts` to support an
unversioned subject shape (e.g. `SubjectParts` gains
`kind: "runtime" | "domain"`), or migrate the runner to
`events.<tenant>.system.cron.completed.v1` and update the CRON_PRIMER.

**Why:** `events.<tenant>.cron.completed` bypasses `buildSubject` because
the current grammar requires 6 segments + `v<n>`. Consumers can still
subscribe (that side takes arbitrary filterSubject strings), but the
publish side is inconsistent. Documented in
`runners/claude-runner/runner.mjs` and
`~/.gstack/projects/jaredzwick-equity-platform/jared-main-plan-20260916-164721-cron-nl-editor.md`.

**Depends on:** appetite for touching the events library. Not urgent —
one publisher currently uses the carve-out.

### `activeDeadlineSeconds` for runner CronJobs

**What:** Add `activeDeadlineSeconds` to the CronJob spec (default ~600)
so a hung `claude --print` doesn't leave a pod running indefinitely.

**Why:** Failure-mode analysis in the plan flagged this. Not shipped in
v1 because the timeout tuning depends on how long real prompts take;
would rather see empirical data first than guess.

**Depends on:** running enough AI crons in prod to know the p95 duration.
