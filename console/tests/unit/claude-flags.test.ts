import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHAT_ALLOWED_TOOLS,
  DRY_RUN_ALLOWED_TOOLS,
  EQUITY_MCP_TOOLS,
  READ_ONLY_NATIVE_TOOLS,
  RUNNER_ALLOWED_TOOLS,
  joinAllowedTools,
} from "@/lib/claude-flags";

describe("READ_ONLY_NATIVE_TOOLS", () => {
  it("includes WebFetch and WebSearch — the two the runner + dry-run need to do useful work", () => {
    expect(READ_ONLY_NATIVE_TOOLS).toContain("WebFetch");
    expect(READ_ONLY_NATIVE_TOOLS).toContain("WebSearch");
  });

  it("does NOT include mutating native tools (Bash, Edit, Write) — those aren't safe for chat or dry-run", () => {
    for (const forbidden of ["Bash", "Edit", "Write", "NotebookEdit"]) {
      expect(READ_ONLY_NATIVE_TOOLS).not.toContain(forbidden);
    }
  });
});

describe("EQUITY_MCP_TOOLS", () => {
  it("matches the full set of tools registered in console/mcp/server.ts", () => {
    // Cross-reference: parse the MCP server source and pull out every
    // tool `name:` string. If server.ts adds a new tool, this test
    // forces us to add it to the allow-list too (otherwise chat can't
    // call it).
    const serverSrc = readFileSync(
      path.resolve(__dirname, "..", "..", "mcp", "server.ts"),
      "utf8",
    );
    // Look for tool entries in the ListToolsRequestSchema block:
    //   name: "list_businesses",
    const registered = new Set<string>();
    const re = /^\s*name:\s*"([a-z0-9_]+)"\s*,/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(serverSrc)) !== null) {
      // Filter out ones that are container names or other unrelated
      // `name:` fields — MCP tool names live at the top level of each
      // tool descriptor and are always kebab_lowered snake_case.
      if (m[1].length > 3) registered.add(`mcp__equity__${m[1]}`);
    }
    // The regex is broad; narrow to only the tool names we expect to
    // find (list/get/create/update/create_cron flavors).
    const relevant = Array.from(registered).filter((n) =>
      /(list_|get_|create_|update_|create_cron)/.test(n),
    );
    expect(relevant.sort()).toEqual([...EQUITY_MCP_TOOLS].sort());
  });
});

describe("CHAT_ALLOWED_TOOLS (tenant /chat page)", () => {
  it("includes every equity MCP tool", () => {
    for (const t of EQUITY_MCP_TOOLS) {
      expect(CHAT_ALLOWED_TOOLS).toContain(t);
    }
  });

  it("includes WebFetch + WebSearch so the model can research", () => {
    expect(CHAT_ALLOWED_TOOLS).toContain("WebFetch");
    expect(CHAT_ALLOWED_TOOLS).toContain("WebSearch");
  });

  it("does NOT include Bash/Edit/Write — chat shouldn't run arbitrary code on the console host", () => {
    for (const forbidden of ["Bash", "Edit", "Write"]) {
      expect(CHAT_ALLOWED_TOOLS).not.toContain(forbidden);
    }
  });
});

describe("DRY_RUN_ALLOWED_TOOLS (▶ Play button)", () => {
  it("includes WebFetch + WebSearch (the runner's real capability set)", () => {
    expect(DRY_RUN_ALLOWED_TOOLS).toContain("WebFetch");
    expect(DRY_RUN_ALLOWED_TOOLS).toContain("WebSearch");
  });

  it("does NOT include ANY MCP tools — dry-runs are side-effect-free by design", () => {
    for (const t of EQUITY_MCP_TOOLS) {
      expect(DRY_RUN_ALLOWED_TOOLS).not.toContain(t);
    }
  });

  it("matches RUNNER_ALLOWED_TOOLS — dry-run should mirror what actually runs in the pod", () => {
    // If these two ever drift, a dry-run "passes" but the real cron
    // fails (or vice versa) — the whole point of the button is to
    // preview real behavior.
    expect([...DRY_RUN_ALLOWED_TOOLS].sort()).toEqual([...RUNNER_ALLOWED_TOOLS].sort());
  });
});

describe("RUNNER_ALLOWED_TOOLS mirrored in runners/claude-runner/runner.mjs", () => {
  it("the runner's hardcoded ALLOWED_TOOLS list matches the ts export", () => {
    // runners/claude-runner is a separate npm project (own package.json)
    // so it can't import from console/lib. We keep the list hardcoded
    // there and assert parity here — drift breaks the "dry-run
    // preview matches production behavior" promise.
    const runnerMjs = readFileSync(
      path.resolve(__dirname, "..", "..", "..", "runners", "claude-runner", "runner.mjs"),
      "utf8",
    );
    // Extract the ALLOWED_TOOLS = [...].join(",") literal.
    const m = /const ALLOWED_TOOLS = \[([^\]]+)\]\.join\(","\)/.exec(runnerMjs);
    // If this fails: runner.mjs no longer declares
    // `const ALLOWED_TOOLS = [...].join(",")` — either rename the const
    // there or update this regex to match the new shape.
    expect(m).not.toBeNull();
    const runnerList = m![1]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
    expect(runnerList.sort()).toEqual([...RUNNER_ALLOWED_TOOLS].sort());
  });
});

describe("joinAllowedTools", () => {
  it("comma-separates the list without surrounding whitespace", () => {
    expect(joinAllowedTools(["WebFetch", "WebSearch"])).toBe("WebFetch,WebSearch");
  });

  it("handles a single-item list", () => {
    expect(joinAllowedTools(["WebFetch"])).toBe("WebFetch");
  });

  it("handles an empty list (edge case — returns empty string)", () => {
    expect(joinAllowedTools([])).toBe("");
  });
});
