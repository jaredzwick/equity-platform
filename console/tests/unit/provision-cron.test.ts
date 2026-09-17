import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the transitive imports before importing the SUT so vi.mock's hoist
// order matches the module-load order. Same pattern as
// business-context-events.test.ts.
const {
  getFileSha,
  isConfigured,
  putFile,
  batch,
  core,
  resolveTenant,
} = vi.hoisted(() => ({
  getFileSha: vi.fn(),
  isConfigured: vi.fn(),
  putFile: vi.fn(),
  batch: vi.fn(),
  core: vi.fn(),
  resolveTenant: vi.fn(),
}));

vi.mock("@/lib/github", () => ({
  getFileSha,
  isConfigured,
  putFile,
}));

vi.mock("@/lib/k8s", () => ({
  batch,
  core,
}));

vi.mock("@/lib/tenants", () => ({
  resolveTenant,
  MASTER_SLUG: "master",
}));

import { provisionCron } from "@/app/[tenant]/cron/new/provision";
import {
  renderCronYaml,
  buildCronJobBody,
  looksLikeCron,
  validName,
  CLAUDE_RUNNER_IMAGE,
  CLAUDE_RUNNER_SECRET,
} from "@/lib/cron-render";

// Shared fixture: happy-path input for each mode.
function shellInput(overrides: Partial<Record<string, string>> = {}) {
  return {
    mode: "shell" as const,
    tenant: "pypes",
    name: "nightly-cleanup",
    namespace: "pypes-app",
    schedule: "0 0 * * *",
    image: "busybox:1.36",
    command: "echo hello; date",
    concurrencyPolicy: "Allow" as const,
    ...overrides,
  };
}

function runnerInput(overrides: Partial<Record<string, string>> = {}) {
  return {
    mode: "runner" as const,
    tenant: "pypes",
    name: "weekly-gsc-audit",
    namespace: "pypes-app",
    schedule: "0 0 * * 0",
    prompt: "audit last week of GSC data and post SEO suggestions",
    concurrencyPolicy: "Forbid" as const,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default happy defaults; individual tests override as needed.
  isConfigured.mockResolvedValue(true);
  resolveTenant.mockImplementation(async (slug: string) => ({
    slug,
    name: slug,
    namespaces: [`${slug}-app`],
  }));
  getFileSha.mockResolvedValue(null); // no existing cron
  putFile.mockResolvedValue({ commitSha: "abc", contentSha: "def" });
  batch.mockReturnValue({
    createNamespacedCronJob: vi.fn().mockResolvedValue({}),
  });
  core.mockReturnValue({
    readNamespacedSecret: vi.fn().mockResolvedValue({}),
  });
});

afterEach(() => vi.clearAllMocks());

// ─── pure helpers ──────────────────────────────────────────────────────────

describe("looksLikeCron", () => {
  it("accepts a 5-field expression", () => {
    expect(looksLikeCron("0 0 * * *")).toBe(true);
    expect(looksLikeCron("*/5 * * * *")).toBe(true);
  });
  it("accepts a 6-field expression (with seconds)", () => {
    expect(looksLikeCron("0 0 0 * * *")).toBe(true);
  });
  it("accepts documented @keywords", () => {
    for (const k of ["@hourly", "@daily", "@weekly", "@monthly", "@yearly", "@annually", "@reboot"]) {
      expect(looksLikeCron(k)).toBe(true);
    }
  });
  it("rejects nonsense", () => {
    expect(looksLikeCron("")).toBe(false);
    expect(looksLikeCron("every week")).toBe(false);
    expect(looksLikeCron("@bogus")).toBe(false);
    expect(looksLikeCron("* * *")).toBe(false); // too few
  });
});

describe("validName", () => {
  it("accepts kebab-case", () => {
    expect(validName("my-cron")).toBe(true);
    expect(validName("a")).toBe(true);
    expect(validName("a1")).toBe(true);
  });
  it("rejects uppercase, leading/trailing dashes, and too-long names", () => {
    expect(validName("MyCron")).toBe(false);
    expect(validName("-leading")).toBe(false);
    expect(validName("trailing-")).toBe(false);
    expect(validName("a".repeat(53))).toBe(false);
  });
});

// ─── validation branches (both modes) ──────────────────────────────────────

describe("provisionCron — validation errors", () => {
  it("rejects master slug", async () => {
    const r = await provisionCron(shellInput({ tenant: "master" }));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("master view can't own crons") });
  });

  it("rejects bad name", async () => {
    const r = await provisionCron(shellInput({ name: "Bad_Name" }));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("kebab-case") });
  });

  it("rejects empty namespace", async () => {
    const r = await provisionCron(shellInput({ namespace: "" }));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Namespace required") });
  });

  it("rejects bad schedule", async () => {
    const r = await provisionCron(shellInput({ schedule: "every week" }));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Schedule must be") });
  });

  it("rejects shell mode without image", async () => {
    const r = await provisionCron(shellInput({ image: "" }));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Image required") });
  });

  it("rejects shell mode without command", async () => {
    const r = await provisionCron(shellInput({ command: "" }));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Command required") });
  });

  it("rejects runner mode without prompt", async () => {
    const r = await provisionCron(runnerInput({ prompt: "   " }));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Prompt required") });
  });

  it("rejects invalid concurrency policy", async () => {
    const r = await provisionCron(shellInput({ concurrencyPolicy: "Whatever" as never }));
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Invalid concurrency policy") });
  });
});

// ─── environment gates ─────────────────────────────────────────────────────

describe("provisionCron — environment gates", () => {
  it("rejects when tenant does not resolve", async () => {
    resolveTenant.mockResolvedValueOnce(null);
    const r = await provisionCron(shellInput());
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Unknown tenant") });
    expect(putFile).not.toHaveBeenCalled();
  });

  it("rejects when GitHub is not configured", async () => {
    isConfigured.mockResolvedValueOnce(false);
    const r = await provisionCron(shellInput());
    expect(r).toEqual({ ok: false, error: expect.stringContaining("GITHUB_TOKEN") });
    expect(putFile).not.toHaveBeenCalled();
  });

  it("rejects when runner-mode secret is missing (pre-flight)", async () => {
    core.mockReturnValueOnce({
      readNamespacedSecret: vi.fn().mockRejectedValue(new Error("secrets 'claude-runner-auth' not found")),
    });
    const r = await provisionCron(runnerInput());
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain(CLAUDE_RUNNER_SECRET);
      expect(r.error).toContain("make runner");
    }
    expect(putFile).not.toHaveBeenCalled();
  });

  it("does NOT check the runner secret in shell mode", async () => {
    const readNamespacedSecret = vi.fn();
    core.mockReturnValueOnce({ readNamespacedSecret });
    const r = await provisionCron(shellInput());
    expect(r.ok).toBe(true);
    expect(readNamespacedSecret).not.toHaveBeenCalled();
  });
});

// ─── happy paths ───────────────────────────────────────────────────────────

describe("provisionCron — happy path (shell mode) [REGRESSION]", () => {
  it("commits YAML and applies CronJob", async () => {
    const createNamespacedCronJob = vi.fn().mockResolvedValue({});
    batch.mockReturnValueOnce({ createNamespacedCronJob });

    const r = await provisionCron(shellInput());

    expect(r).toEqual({ ok: true, path: "crons/nightly-cleanup.yaml" });
    expect(putFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "crons/nightly-cleanup.yaml",
        message: "feat(pypes): add cron nightly-cleanup via console",
        content: expect.stringContaining("kind: CronJob"),
      }),
    );
    expect(createNamespacedCronJob).toHaveBeenCalledWith(
      expect.objectContaining({
        namespace: "pypes-app",
        body: expect.objectContaining({
          apiVersion: "batch/v1",
          kind: "CronJob",
        }),
      }),
    );
  });

  it("rejects when the cron file already exists", async () => {
    getFileSha.mockResolvedValueOnce("existing-sha");
    const r = await provisionCron(shellInput());
    expect(r).toEqual({ ok: false, error: expect.stringContaining("already exists") });
    expect(putFile).not.toHaveBeenCalled();
  });

  it("returns error when GitHub write fails", async () => {
    putFile.mockRejectedValueOnce(new Error("403 forbidden"));
    const r = await provisionCron(shellInput());
    expect(r).toEqual({ ok: false, error: expect.stringContaining("GitHub write failed") });
  });

  it("returns error when GitHub read fails (non-404)", async () => {
    getFileSha.mockRejectedValueOnce(new Error("500 internal"));
    const r = await provisionCron(shellInput());
    expect(r).toEqual({ ok: false, error: expect.stringContaining("GitHub read failed") });
  });

  it("returns warning when cluster-apply fails after successful commit", async () => {
    const createNamespacedCronJob = vi.fn().mockRejectedValue(new Error("connection refused"));
    batch.mockReturnValueOnce({ createNamespacedCronJob });

    const r = await provisionCron(shellInput());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warning).toContain("Committed but cluster-apply failed");
      expect(r.warning).toContain("connection refused");
    }
    expect(putFile).toHaveBeenCalled();
  });

  it("swallows 'already exists' from cluster-apply as idempotent", async () => {
    const createNamespacedCronJob = vi.fn().mockRejectedValue(new Error("cronjob X already exists"));
    batch.mockReturnValueOnce({ createNamespacedCronJob });

    const r = await provisionCron(shellInput());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warning).toBeUndefined();
  });
});

describe("provisionCron — happy path (runner mode)", () => {
  it("commits YAML with runner defaults + secret ref", async () => {
    const r = await provisionCron(runnerInput());
    expect(r).toEqual({ ok: true, path: "crons/weekly-gsc-audit.yaml" });
    const call = putFile.mock.calls[0][0];
    expect(call.content).toContain(CLAUDE_RUNNER_IMAGE);
    expect(call.content).toContain("secretKeyRef");
    expect(call.content).toContain(CLAUDE_RUNNER_SECRET);
    expect(call.content).toContain("equity.io/runner: claude");
    expect(call.content).toContain("audit last week of GSC data");
    expect(call.content).toContain("nats://nats.nats.svc.cluster.local:4222");
  });
});

// ─── YAML shape (isolation-testable, pure) ─────────────────────────────────

describe("renderCronYaml — shell mode [REGRESSION]", () => {
  it("emits the same structure as pre-refactor", () => {
    const yaml = renderCronYaml(shellInput());
    expect(yaml).toContain("apiVersion: batch/v1");
    expect(yaml).toContain("kind: CronJob");
    expect(yaml).toContain('  name: nightly-cleanup');
    expect(yaml).toContain("  namespace: pypes-app");
    expect(yaml).toContain("equity.io/tenant: pypes");
    expect(yaml).toContain("equity.io/managed-by: console");
    expect(yaml).toContain('  schedule: "0 0 * * *"');
    expect(yaml).toContain("concurrencyPolicy: Allow");
    expect(yaml).toContain("successfulJobsHistoryLimit: 3");
    expect(yaml).toContain("failedJobsHistoryLimit: 1");
    expect(yaml).toContain('command: ["/bin/sh", "-c"]');
    expect(yaml).toContain("- 'echo hello; date'");
    expect(yaml).not.toContain("equity.io/runner"); // shell-mode label is absent
  });

  it("escapes single quotes in the command", () => {
    const yaml = renderCronYaml(shellInput({ command: "echo 'hi'" }));
    // Bash single-quote escape: '\''
    expect(yaml).toContain("echo '\\''hi'\\''");
  });
});

describe("renderCronYaml — runner mode", () => {
  it("emits runner defaults + env + secret ref + runner label", () => {
    const yaml = renderCronYaml(runnerInput());
    expect(yaml).toContain(`image: ${CLAUDE_RUNNER_IMAGE}`);
    expect(yaml).toContain('command: ["/entrypoint.sh"]');
    expect(yaml).toContain("equity.io/runner: claude");
    expect(yaml).toContain("- name: PROMPT");
    expect(yaml).toContain("- name: TENANT");
    expect(yaml).toContain("- name: CRON_NAME");
    expect(yaml).toContain("- name: NATS_URL");
    expect(yaml).toContain("- name: CLAUDE_CODE_OAUTH_TOKEN");
    expect(yaml).toContain(`name: ${CLAUDE_RUNNER_SECRET}`);
  });

  it("preserves multi-line prompts using YAML block scalar", () => {
    const yaml = renderCronYaml(runnerInput({ prompt: "line one\nline two\nline three" }));
    expect(yaml).toContain("value: |-");
    expect(yaml).toContain("                    line one");
    expect(yaml).toContain("                    line two");
    expect(yaml).toContain("                    line three");
  });
});

describe("buildCronJobBody", () => {
  it("shell mode: matches command/args shape", () => {
    const body = buildCronJobBody(shellInput());
    expect(body.spec.jobTemplate.spec.template.spec.containers[0]).toMatchObject({
      name: "worker",
      image: "busybox:1.36",
      command: ["/bin/sh", "-c"],
      args: ["echo hello; date"],
    });
    expect(body.metadata.labels).toEqual({
      "equity.io/tenant": "pypes",
      "equity.io/managed-by": "console",
    });
  });

  it("runner mode: matches entrypoint + env shape", () => {
    const body = buildCronJobBody(runnerInput());
    const c = body.spec.jobTemplate.spec.template.spec.containers[0];
    expect(c.image).toBe(CLAUDE_RUNNER_IMAGE);
    expect(c.command).toEqual(["/entrypoint.sh"]);
    const envNames = (c.env ?? []).map((e: { name: string }) => e.name);
    expect(envNames).toEqual([
      "PROMPT",
      "TENANT",
      "CRON_NAME",
      "NATS_URL",
      "CLAUDE_CODE_OAUTH_TOKEN",
    ]);
    expect(body.metadata.labels["equity.io/runner"]).toBe("claude");
  });
});
