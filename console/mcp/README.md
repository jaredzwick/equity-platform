# equity-mcp

MCP stdio server that exposes tenant primitives as tools Claude Code (or any MCP client) can call. Alpha — 4 tools, one file.

## What it does

Wraps the same functions the console UI wraps (`console/lib/*`), but talks to K8s + GitHub directly via env vars — no Next.js session required. Founder/operator use from the terminal.

## Tools

| Tool | Purpose |
|---|---|
| `list_businesses` | Union of cluster + repo discovery. Shows drift (in cluster only / in repo only / both). |
| `get_business` | Full profile YAML + namespace + drift status for one slug. |
| `create_business` | Parse URL/name → commit namespace to `bootstrap/00-namespaces.yaml` → apply namespace to cluster. Idempotent. |
| `update_profile` | Deep-merge a patch into `businesses/<slug>.yaml`. Creates the file if absent. |
| `create_cron` | Schedule a CronJob. Runner mode: pass `prompt` and it runs `equity/claude-runner:latest`, publishing `events.<tenant>.cron.completed` on finish. Shell mode: pass `image` + `command` for arbitrary containers. Pre-flights the `claude-runner-auth` Secret in runner mode. |

### `create_cron` example (runner mode)

The chat that spawns `claude --print` picks this tool up automatically via
`.mcp.json`. Operator types "schedule a weekly GSC audit"; the model
proposes YAML, waits for confirmation, then calls:

```jsonc
{
  "tool": "create_cron",
  "arguments": {
    "tenant": "pypes",
    "name": "weekly-gsc-audit",
    "schedule": "0 0 * * 0",
    "prompt": "audit last week of GSC data and post SEO suggestions"
  }
}
```

The tool commits `crons/weekly-gsc-audit.yaml` to git AND applies the
CronJob to the cluster. On each tick, the container publishes an envelope
to `events.pypes.cron.completed` with the exit code + truncated summary.

See `runners/claude-runner/README.md` for the runner image + the
`claude-runner-auth` Secret bootstrap.

Business-specific tools (per-tenant custom actions layered on the shared `update_profile` primitive) are **deliberately deferred** until the business-profile schema extensions land. YAGNI.

## Env

| Var | Purpose | Required for |
|---|---|---|
| `GITHUB_TOKEN` | Fine-grained PAT with `contents: write` on the platform repo | `create_business`, `update_profile` (write ops) |
| `GITHUB_REPO` | `owner/name` form (e.g. `jaredzwick/equity-platform`) | any git op |
| `GITHUB_BRANCH` | Defaults to `main` | optional |
| `KUBECONFIG` | Defaults to `~/.kube/config` | any cluster op |

If GITHUB_* is missing, the MCP degrades gracefully — reads still work from the cluster, writes report a clear error. If KUBECONFIG is missing, reads still work from the repo.

## Run standalone

```bash
cd console
npm install                    # installs @modelcontextprotocol/sdk + tsx
GITHUB_TOKEN=... GITHUB_REPO=jaredzwick/equity-platform npm run mcp
```

Prints `[equity-mcp] ready` on stderr; stdin/stdout carry the MCP protocol.

## Register with Claude Code

`.mcp.json` at the repo root is gitignored (per-operator config; it can hold personal MCPs like Notion/Gamma). A template lives at `.mcp.json.example` — copy it once:

```bash
cp .mcp.json.example .mcp.json    # from repo root
```

Then set the env vars in your shell (or in `console/.env.local` — the console picks them up automatically):

```bash
export GITHUB_TOKEN=github_pat_...
export GITHUB_REPO=<your-fork-slug>       # e.g. yourhandle/equity-platform
export CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...   # from `claude login`
```

Then Claude Code auto-starts the server on the first tool call (both from your terminal and from the console's `/chat` page).

## Design notes

- **Self-contained.** Reuses only pure helpers (`parseBusinessInput`). K8s + GitHub calls are inline — no dependency on `iron-session`, `next`, or the console's request context. Same trust model as `kubectl` + a PAT.
- **Read-safe by default.** `list_businesses` and `get_business` never write. Writes (`create_business`, `update_profile`) are explicit and produce a git commit you can revert.
- **Drift-aware.** `list_businesses` shows whether each tenant lives in cluster only, repo only, or both — the platform's recurring "in repo, not in cluster" issue surfaces in the tool response instead of silently.
- **Deep-merge semantics.** `update_profile` patches merge nested objects but replace arrays. If you need append semantics, `get_business` → mutate → `update_profile`.

## Not yet

- No app provisioning (ArgoCD Application CRDs). Add when needed — same pattern.
- No profile validation against the schema in `console/lib/business-profile-schema.ts`. Patches land as-is. Validate before writing when the schema stabilizes.
- No pagination on `list_businesses`. Add when tenant count clears ~50.
- No tests. The alpha test IS running these tools against your own env.
