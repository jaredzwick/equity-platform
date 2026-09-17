// All MCP config strings we pass to `claude --mcp-config` at runtime.
// Extracted here so a single unit test can validate every one against
// the MCP config schema — the reason this module exists is that we
// shipped `--mcp-config "{}"` once and hit
//   Error: Invalid MCP configuration:
//   mcpServers: Does not adhere to MCP server configuration schema
// at runtime. The schema requires an `mcpServers` object (empty is OK,
// but the key must be present). Never write a raw config string
// inline in a route — add it here so the lint catches drift.

// Empty allow-list — MCP loads but no tools are exposed. Used by
// /api/cron/dry-run so a dry-run can't accidentally mutate anything
// (the point of the dry-run is to iterate on the prompt's OUTPUT,
// not to invoke tools).
export const MCP_CONFIG_EMPTY = '{"mcpServers":{}}';

// The MCP config schema per the claude CLI. Minimal — enough to catch
// the "empty object" / "missing mcpServers" class of bug that shipped
// once already. Validated in tests against every export from this file.
export type McpServerEntry = {
  type?: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
};

export type McpConfig = {
  mcpServers: Record<string, McpServerEntry>;
};

// Runtime validator — returns { ok: true } or { ok: false, error }.
// Kept synchronous + zero-dep so it works in both Node and the test
// runner without a schema library.
export function validateMcpConfig(raw: string): { ok: true; parsed: McpConfig } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, error: `not valid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "root must be an object" };
  }
  const obj = parsed as Record<string, unknown>;
  // Some claude CLI versions require the `mcpServers` key even when it's
  // empty. Reject configs that omit it — that's the exact bug we're
  // guarding against ("mcpServers: Does not adhere to MCP server
  // configuration schema").
  if (!("mcpServers" in obj)) {
    return { ok: false, error: 'missing "mcpServers" key (root must have mcpServers even when empty)' };
  }
  const servers = obj.mcpServers;
  if (typeof servers !== "object" || servers === null || Array.isArray(servers)) {
    return { ok: false, error: '"mcpServers" must be an object' };
  }
  for (const [name, entry] of Object.entries(servers as Record<string, unknown>)) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return { ok: false, error: `mcpServers.${name} must be an object` };
    }
    const e = entry as Record<string, unknown>;
    // Server must have EITHER (command + optional args) for stdio OR
    // (url) for http/sse. Anything else is a schema violation.
    const isStdio = typeof e.command === "string";
    const isRemote = typeof e.url === "string";
    if (!isStdio && !isRemote) {
      return { ok: false, error: `mcpServers.${name} must have "command" (stdio) or "url" (http/sse)` };
    }
    if (isStdio && "args" in e && !Array.isArray(e.args)) {
      return { ok: false, error: `mcpServers.${name}.args must be an array of strings` };
    }
    if ("env" in e && (typeof e.env !== "object" || e.env === null || Array.isArray(e.env))) {
      return { ok: false, error: `mcpServers.${name}.env must be an object` };
    }
  }
  return { ok: true, parsed: parsed as McpConfig };
}
