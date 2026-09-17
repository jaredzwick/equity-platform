import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MCP_CONFIG_EMPTY,
  validateMcpConfig,
  type McpConfig,
} from "@/lib/mcp-configs";

// ─── validator unit tests ──────────────────────────────────────────────────
//
// The validator was born after we shipped --mcp-config "{}" once and hit
// `mcpServers: Does not adhere to MCP server configuration schema` at
// runtime. These tests lock in the schema shape so a future refactor
// can't silently regress it.

describe("validateMcpConfig", () => {
  it("rejects the empty-object shape that shipped once ({})", () => {
    const r = validateMcpConfig("{}");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("mcpServers");
  });

  it("rejects non-JSON input", () => {
    const r = validateMcpConfig("this is not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("JSON");
  });

  it("rejects a JSON array at the root", () => {
    const r = validateMcpConfig("[]");
    expect(r.ok).toBe(false);
  });

  it("accepts the empty-servers shape ({mcpServers:{}})", () => {
    const r = validateMcpConfig('{"mcpServers":{}}');
    expect(r.ok).toBe(true);
  });

  it("accepts a valid stdio server entry", () => {
    const r = validateMcpConfig(JSON.stringify({
      mcpServers: {
        equity: { type: "stdio", command: "npx", args: ["-y", "tsx", "console/mcp/server.ts"] },
      },
    }));
    expect(r.ok).toBe(true);
  });

  it("accepts a valid http server entry", () => {
    const r = validateMcpConfig(JSON.stringify({
      mcpServers: { notion: { type: "http", url: "https://mcp.notion.com/mcp" } },
    }));
    expect(r.ok).toBe(true);
  });

  it("rejects a server entry with neither command nor url", () => {
    const r = validateMcpConfig(JSON.stringify({
      mcpServers: { broken: { type: "stdio" } },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("command");
  });

  it("rejects a server whose args is a string instead of an array", () => {
    const r = validateMcpConfig(JSON.stringify({
      mcpServers: { broken: { command: "npx", args: "not-an-array" } },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("args");
  });

  it("rejects a server whose env is not an object", () => {
    const r = validateMcpConfig(JSON.stringify({
      mcpServers: { broken: { command: "npx", env: [] } },
    }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("env");
  });
});

// ─── the exported constants ────────────────────────────────────────────────
//
// These are the strings we actually pass to `claude --mcp-config` at
// runtime. Every one MUST validate against the schema — that's the whole
// reason the module exists.

describe("MCP configs used in production paths", () => {
  it("MCP_CONFIG_EMPTY (used by /api/cron/dry-run) validates", () => {
    const r = validateMcpConfig(MCP_CONFIG_EMPTY);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Must have zero servers so the dry-run has no tools available.
      expect(Object.keys(r.parsed.mcpServers)).toEqual([]);
    }
  });
});

// ─── .mcp.json.example (source of truth for OSS setup) ────────────────────
//
// Guards against the shape drifting once we tell OSS users to `cp
// .mcp.json.example .mcp.json`. If the template is broken, every fresh
// clone's chat breaks too.

describe(".mcp.json.example", () => {
  const templatePath = path.resolve(__dirname, "..", "..", "..", ".mcp.json.example");

  it("exists at the repo root", () => {
    expect(existsSync(templatePath)).toBe(true);
  });

  it("validates against the MCP config schema", () => {
    const raw = readFileSync(templatePath, "utf8");
    // Strip `"//"` and `"//<name>"` comment keys before parsing —
    // they're a JSONC-style comment convention some CLI tools tolerate
    // but the validator doesn't need them.
    const parsed = JSON.parse(raw) as Record<string, unknown> & { mcpServers?: unknown };
    for (const k of Object.keys(parsed)) {
      if (k.startsWith("//")) delete parsed[k];
    }
    const r = validateMcpConfig(JSON.stringify(parsed));
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Must register the equity server (the entire OSS NL-cron flow
      // depends on it). Personal MCPs (Notion, Gamma, etc.) belong in
      // the operator's own .mcp.json, not the template.
      expect(r.parsed.mcpServers).toHaveProperty("equity");
      const equity = r.parsed.mcpServers.equity;
      expect(equity.command).toBe("npx");
      expect(equity.args).toEqual(expect.arrayContaining(["tsx", "console/mcp/server.ts"]));
    }
  });
});

// ─── belt-and-suspenders: every raw --mcp-config string in the codebase
//     matches a constant from mcp-configs.ts ─────────────────────────────
//
// Catches the failure mode we hit: a route hardcoded --mcp-config "{}"
// inline instead of importing the vetted constant. Enforces the "no
// inline MCP config strings" convention.

describe("codebase: no ad-hoc --mcp-config values outside mcp-configs.ts", () => {
  const roots = [
    path.resolve(__dirname, "..", "..", "app"),
    path.resolve(__dirname, "..", "..", "lib"),
  ];

  it("every --mcp-config <literal> in app/ or lib/ uses an imported constant", async () => {
    const { readdirSync, statSync } = await import("node:fs");
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        const s = statSync(p);
        if (s.isDirectory()) walk(p, out);
        else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
      }
      return out;
    };
    const files = roots.flatMap((r) => (existsSync(r) ? walk(r) : []));
    const offenders: string[] = [];
    for (const f of files) {
      // Skip the constants module itself — its docstring cites the exact
      // bug string (`--mcp-config "{}"`) as an anti-example, which is
      // fine there.
      if (f.endsWith(path.join("lib", "mcp-configs.ts"))) continue;
      const src = readFileSync(f, "utf8");
      // Match --mcp-config followed by a quoted literal (single or double).
      // Skips comments and strings that reference the constant name.
      const re = /--mcp-config['"\s,]+['"`]\s*\{[^}]*\}\s*['"`]/g;
      const matches = src.match(re) ?? [];
      for (const m of matches) offenders.push(`${path.relative(process.cwd(), f)}: ${m}`);
    }
    if (offenders.length > 0) {
      throw new Error(
        `Inline --mcp-config JSON literals found — use a constant from @/lib/mcp-configs instead:\n  ${offenders.join("\n  ")}`,
      );
    }
    // Not strictly required, but a sanity check on the walk.
    expect(files.length).toBeGreaterThan(0);
  });
});

// ─── type sanity ──────────────────────────────────────────────────────────
//
// This test doesn't run any expectations — it just ensures the McpConfig
// type is exported and shaped as expected. If the shape drifts, tsc
// catches it here.

describe("type: McpConfig", () => {
  it("has mcpServers as a required record", () => {
    const cfg: McpConfig = { mcpServers: {} };
    expect(cfg).toBeDefined();
  });
});
