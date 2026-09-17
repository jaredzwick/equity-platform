# claude-runner

Generic AI-cron worker container. Every AI-scheduled CronJob in equity-platform
runs `equity/claude-runner:latest`.

## What it does

On each schedule tick, the container:

1. Reads `PROMPT`, `TENANT`, `CRON_NAME`, `NATS_URL`, `CLAUDE_CODE_OAUTH_TOKEN`
   from env (`entrypoint.sh` validates these fast and refuses to start if any
   are missing).
2. Spawns `claude --print` with the prompt on stdin and streams stdout to the
   container's stdout (captured by k8s).
3. Publishes a single JetStream event to
   `events.<tenant>.cron.completed` with an envelope containing the exit code,
   duration, and a truncated summary.
4. Exits with claude's exit code.

## Design notes

- **No `.mcp.json` in the image.** An AI cron with access to
  `create_business` / `create_cron` inside a container is a bad idea. The
  runner reasons with the LLM and reports back; it does not mutate cluster
  state. Per-cron MCP toolbelts can be layered later via env-driven config.
- **Subject grammar carve-out.** `events.<tenant>.cron.completed` deliberately
  omits the `.v<n>` version suffix used by
  `console/lib/events/subject.ts`. Cron completions are runtime signals, not
  versioned domain events. Consumers still work — `console/lib/events/consumer.ts`
  accepts arbitrary `filterSubject` strings.
- **Exit code fidelity.** NATS-publish failures never mask claude's exit code.
  If the event bus is down, the container still logs to stdout (visible via
  `kubectl logs`).

## Build + auth in one command

```bash
./local/up.sh
```

`up.sh` builds `equity/claude-runner:latest`, loads it into the local kind
cluster, and seeds the `claude-runner-auth` Secret in every existing tenant
namespace. New tenants get the Secret auto-seeded on business creation (see
`console/lib/runner-secret.ts` and the `create_business` MCP tool).

The summary line at the end of `up.sh` reports one of four states:

| State | What it means |
|---|---|
| `ready` | Image loaded, token seeded — AI crons will run. |
| `partial — image loaded, no token` | Image is on-cluster but `CLAUDE_CODE_OAUTH_TOKEN` isn't set. `create_cron` pre-flight will surface a fix. |
| `partial — token set but docker not reachable` | Token is present but the image isn't built. Start Docker Desktop and rerun `up.sh`. |
| `unavailable` | Neither prerequisite present. Shell-mode crons still work; AI crons don't. |

To opt out completely (skip the AI runner build entirely):

```bash
AI_RUNNER=0 ./local/up.sh
```

## Manual escape hatches

Only needed if you're iterating on the runner itself, or you added the token
after `up.sh` already finished:

```bash
make runner                          # rebuild + reload the image
make runner-secret NS=<tenant-ns>    # seed the Secret in one specific namespace
```

Both are idempotent.

## Rotating the token

Update `CLAUDE_CODE_OAUTH_TOKEN` in `console/.env.local` and rerun
`./local/up.sh`. Every tenant namespace's Secret is replaced; the next
scheduled run picks up the new value.

## Testing locally

```bash
# Sanity: env-validation fires before claude is invoked.
docker run --rm equity/claude-runner:latest
# → [claude-runner] ✗ $PROMPT is required — the runner needs an instruction to execute.
# → exit 2

# Full run against a local NATS at :4222:
docker run --rm \
  -e PROMPT="say hello, one word" \
  -e TENANT="test" \
  -e CRON_NAME="hello-test" \
  -e NATS_URL="nats://host.docker.internal:4222" \
  -e CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" \
  equity/claude-runner:latest
```

## Environment variables

| Var | Required | Description |
|-----|----------|-------------|
| `PROMPT` | yes | Natural-language instruction claude executes on each tick. |
| `TENANT` | yes | Tenant slug for the outgoing NATS subject + envelope. |
| `CRON_NAME` | yes | Cron name; used in envelope metadata + logs. |
| `NATS_URL` | yes | JetStream URL. In-cluster default: `nats://nats.nats.svc.cluster.local:4222`. |
| `CLAUDE_CODE_OAUTH_TOKEN` | yes | Claude Code Max OAuth token. Sourced from the `claude-runner-auth` Secret. |
| `MODEL` | no | Claude model ID. Default `claude-sonnet-4-6`. |

`ANTHROPIC_API_KEY` is explicitly emptied by the entrypoint so the CLI takes
the OAuth path — never the paid-API path.

## Emitted event shape

```json
{
  "id": "uuid-v4",
  "tenant": "<tenant>",
  "actor": { "kind": "system", "source": "cron/<cron-name>" },
  "source": "claude-runner:<cron-name>",
  "correlationId": "<same as id>",
  "ts": "2026-09-16T18:00:00.000Z",
  "schemaVersion": 1,
  "data": {
    "cronName": "<cron-name>",
    "model": "claude-sonnet-4-6",
    "exitCode": 0,
    "startedAt": "…",
    "finishedAt": "…",
    "durationMs": 12345,
    "prompt": "<truncated at 2KB>",
    "summary": "<truncated at 8KB>"
  }
}
```

Subject: `events.<tenant>.cron.completed` (unversioned — see Design notes).
