// Centralized allow-lists passed to `claude --allowedTools` at every
// place the console spawns a Claude Code subprocess. Extracted here so
// a lint test can assert the sets are what we intend and so drift across
// spawn sites can't silently break either the chat or the runner.
//
// Why explicit allow-lists at all: `claude --print` (the non-interactive
// mode we use everywhere) has no UI to render permission prompts, so
// every tool call gets denied by default. Without --allowedTools, the
// model refuses even safe tools like WebFetch — which makes real SEO
// audits, competitor research, and any URL-fetching cron unusable.
// Reproduced with:
//   echo "fetch example.com" | claude --print --model haiku ...
//   → "Could you provide the actual URL you'd like me to fetch?"
// Adding WebFetch/WebSearch to the list unblocks it.

// Equity MCP tools. Kept as an ordered list (not a Set) so the flag
// value we build stays stable — makes it easier to diff runs when
// debugging. Names come from the equity server (console/mcp/server.ts).
export const EQUITY_MCP_TOOLS = [
  "mcp__equity__list_businesses",
  "mcp__equity__get_business",
  "mcp__equity__create_business",
  "mcp__equity__update_profile",
  "mcp__equity__create_cron",
] as const;

// Native Claude tools safe for read-only research (no side effects on
// disk or cluster). Anything that mutates (Bash, Edit, Write) is
// deliberately excluded — the chat + dry-run should never run arbitrary
// code on the console host, and the runner container is ephemeral but
// still shouldn't shell out.
export const READ_ONLY_NATIVE_TOOLS = ["WebFetch", "WebSearch"] as const;

// Chat: tenant /chat page. Full equity MCP + read-only web tools so
// the model can do both cluster ops AND research.
export const CHAT_ALLOWED_TOOLS: readonly string[] = [
  ...EQUITY_MCP_TOOLS,
  ...READ_ONLY_NATIVE_TOOLS,
];

// Dry-run: ▶ Play button. No MCP (side-effect-free by construction)
// but WebFetch/WebSearch enabled — otherwise dry-runs of SEO/audit
// prompts are useless.
export const DRY_RUN_ALLOWED_TOOLS: readonly string[] = [
  ...READ_ONLY_NATIVE_TOOLS,
];

// Runner: the in-cluster claude-runner container (runners/claude-runner/
// runner.mjs). Also no MCP by design (no .mcp.json in the image), but
// needs WebFetch/WebSearch for the same reasons as dry-run.
export const RUNNER_ALLOWED_TOOLS: readonly string[] = [
  ...READ_ONLY_NATIVE_TOOLS,
];

// Join into the comma-separated form the CLI accepts. `claude
// --allowedTools` also accepts space-separated, but comma is safer
// inside shell-arg contexts (no accidental splitting).
export function joinAllowedTools(tools: readonly string[]): string {
  return tools.join(",");
}
