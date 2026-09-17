import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { readNamespacedCronJob, listNamespacedJob, listNamespacedPod, readNamespacedPodLog } = vi.hoisted(() => ({
  readNamespacedCronJob: vi.fn(),
  listNamespacedJob: vi.fn(),
  listNamespacedPod: vi.fn(),
  readNamespacedPodLog: vi.fn(),
}));

vi.mock("@kubernetes/client-node", () => ({
  KubeConfig: class {
    loadFromDefault() {}
    loadFromCluster() {}
    makeApiClient() {
      return {
        readNamespacedCronJob,
        listNamespacedJob,
        listNamespacedPod,
        readNamespacedPodLog,
      };
    }
  },
  CoreV1Api: class {},
  BatchV1Api: class {},
  CustomObjectsApi: class {},
}));

import { getCronJob, listCronJobRuns, readPodLog } from "@/lib/k8s";

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => vi.clearAllMocks());

// ─── getCronJob ────────────────────────────────────────────────────────────

describe("getCronJob", () => {
  it("returns null when the CronJob doesn't exist", async () => {
    readNamespacedCronJob.mockRejectedValueOnce(new Error("404 not found"));
    const r = await getCronJob("pypes-prod", "missing");
    expect(r).toBeNull();
  });

  it("extracts isRunner + prompt from a runner-mode CronJob", async () => {
    readNamespacedCronJob.mockResolvedValueOnce({
      metadata: { name: "weekly-audit", namespace: "pypes-prod", labels: { "equity.io/runner": "claude" } },
      spec: {
        schedule: "0 0 * * 0",
        concurrencyPolicy: "Forbid",
        jobTemplate: {
          spec: {
            template: {
              spec: {
                containers: [
                  {
                    name: "worker",
                    image: "equity/claude-runner:latest",
                    env: [
                      { name: "PROMPT", value: "audit gsc data" },
                      { name: "TENANT", value: "pypes" },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    });
    const r = await getCronJob("pypes-prod", "weekly-audit");
    expect(r).toMatchObject({
      name: "weekly-audit",
      namespace: "pypes-prod",
      schedule: "0 0 * * 0",
      concurrencyPolicy: "Forbid",
      image: "equity/claude-runner:latest",
      isRunner: true,
      prompt: "audit gsc data",
    });
  });

  it("returns isRunner=false + null prompt for shell-mode CronJob", async () => {
    readNamespacedCronJob.mockResolvedValueOnce({
      metadata: { name: "nightly-backup", namespace: "pypes-prod", labels: {} },
      spec: {
        schedule: "0 3 * * *",
        jobTemplate: {
          spec: {
            template: {
              spec: {
                containers: [{ name: "worker", image: "busybox:1.36", command: ["/bin/sh", "-c"], args: ["backup.sh"] }],
              },
            },
          },
        },
      },
    });
    const r = await getCronJob("pypes-prod", "nightly-backup");
    expect(r?.isRunner).toBe(false);
    expect(r?.prompt).toBeNull();
  });

  it("defaults concurrencyPolicy to Allow when the field is missing", async () => {
    readNamespacedCronJob.mockResolvedValueOnce({
      metadata: { name: "x", namespace: "y", labels: {} },
      spec: { schedule: "* * * * *", jobTemplate: { spec: { template: { spec: { containers: [] } } } } },
    });
    const r = await getCronJob("y", "x");
    expect(r?.concurrencyPolicy).toBe("Allow");
  });
});

// ─── listCronJobRuns ───────────────────────────────────────────────────────

function jobFixture(overrides: {
  name: string;
  start?: string;
  complete?: string | null;
  succeeded?: number;
  failed?: number;
  active?: number;
}) {
  return {
    metadata: {
      name: overrides.name,
      labels: { "batch.kubernetes.io/cronjob-name": "weekly-audit" },
    },
    status: {
      startTime: overrides.start ? new Date(overrides.start) : undefined,
      completionTime: overrides.complete ? new Date(overrides.complete) : undefined,
      succeeded: overrides.succeeded,
      failed: overrides.failed,
      active: overrides.active,
    },
  };
}

describe("listCronJobRuns", () => {
  it("returns [] when no Jobs match the labelSelector", async () => {
    listNamespacedJob.mockResolvedValueOnce({ items: [] });
    const runs = await listCronJobRuns("pypes-prod", "weekly-audit", 10);
    expect(runs).toEqual([]);
    // listNamespacedPod should NOT be called when there are no jobs
    expect(listNamespacedPod).not.toHaveBeenCalled();
  });

  it("sorts newest first + trims to limit", async () => {
    listNamespacedJob.mockResolvedValueOnce({
      items: [
        jobFixture({ name: "j-old", start: "2026-09-10T00:00:00Z", complete: "2026-09-10T00:00:30Z", succeeded: 1 }),
        jobFixture({ name: "j-new", start: "2026-09-16T00:00:00Z", complete: "2026-09-16T00:00:30Z", succeeded: 1 }),
        jobFixture({ name: "j-mid", start: "2026-09-13T00:00:00Z", complete: "2026-09-13T00:00:30Z", succeeded: 1 }),
      ],
    });
    listNamespacedPod.mockResolvedValueOnce({ items: [] });

    const runs = await listCronJobRuns("pypes-prod", "weekly-audit", 2);
    expect(runs.map((r) => r.jobName)).toEqual(["j-new", "j-mid"]); // 2 newest
  });

  it("correlates Pods to Jobs via batch.kubernetes.io/job-name label", async () => {
    listNamespacedJob.mockResolvedValueOnce({
      items: [jobFixture({ name: "j-1", start: "2026-09-16T00:00:00Z", complete: "2026-09-16T00:00:30Z", succeeded: 1 })],
    });
    listNamespacedPod.mockResolvedValueOnce({
      items: [
        {
          metadata: {
            name: "pod-j-1-abc",
            labels: {
              "batch.kubernetes.io/cronjob-name": "weekly-audit",
              "batch.kubernetes.io/job-name": "j-1",
            },
          },
        },
      ],
    });

    const runs = await listCronJobRuns("pypes-prod", "weekly-audit", 10);
    expect(runs[0].podName).toBe("pod-j-1-abc");
  });

  it("falls back to legacy `job-name` label when the newer key is absent", async () => {
    listNamespacedJob.mockResolvedValueOnce({
      items: [jobFixture({ name: "j-1", start: "2026-09-16T00:00:00Z", succeeded: 1 })],
    });
    listNamespacedPod.mockResolvedValueOnce({
      items: [{ metadata: { name: "pod-legacy", labels: { "job-name": "j-1" } } }],
    });

    const runs = await listCronJobRuns("pypes-prod", "weekly-audit", 10);
    expect(runs[0].podName).toBe("pod-legacy");
  });

  it("computes status correctly for succeeded / failed / running / unknown", async () => {
    listNamespacedJob.mockResolvedValueOnce({
      items: [
        jobFixture({ name: "j-ok",       start: "2026-09-16T00:00:00Z", complete: "2026-09-16T00:00:30Z", succeeded: 1 }),
        jobFixture({ name: "j-fail",     start: "2026-09-15T00:00:00Z", failed: 1 }),
        jobFixture({ name: "j-active",   start: "2026-09-14T00:00:00Z", active: 1 }),
        jobFixture({ name: "j-nothing",  start: "2026-09-13T00:00:00Z" }),
      ],
    });
    listNamespacedPod.mockResolvedValueOnce({ items: [] });

    const runs = await listCronJobRuns("pypes-prod", "weekly-audit", 10);
    const byName = Object.fromEntries(runs.map((r) => [r.jobName, r.status]));
    expect(byName["j-ok"]).toBe("succeeded");
    expect(byName["j-fail"]).toBe("failed");
    expect(byName["j-active"]).toBe("running");
    expect(byName["j-nothing"]).toBe("unknown");
  });

  it("computes durationMs when both start + complete exist, null otherwise", async () => {
    listNamespacedJob.mockResolvedValueOnce({
      items: [
        jobFixture({ name: "j-done", start: "2026-09-16T00:00:00Z", complete: "2026-09-16T00:00:15Z", succeeded: 1 }),
        jobFixture({ name: "j-running", start: "2026-09-16T00:00:00Z", active: 1 }),
      ],
    });
    listNamespacedPod.mockResolvedValueOnce({ items: [] });

    const runs = await listCronJobRuns("pypes-prod", "weekly-audit", 10);
    const done = runs.find((r) => r.jobName === "j-done")!;
    const running = runs.find((r) => r.jobName === "j-running")!;
    expect(done.durationMs).toBe(15_000);
    expect(running.durationMs).toBeNull();
  });
});

// ─── readPodLog ────────────────────────────────────────────────────────────

describe("readPodLog", () => {
  it("returns the string body when the client returns a plain string", async () => {
    readNamespacedPodLog.mockResolvedValueOnce("hello world\n");
    const s = await readPodLog("pypes-prod", "pod-abc");
    expect(s).toBe("hello world\n");
    expect(readNamespacedPodLog).toHaveBeenCalledWith({
      name: "pod-abc",
      namespace: "pypes-prod",
      tailLines: 500,
    });
  });

  it("extracts .body when the client returns an object", async () => {
    readNamespacedPodLog.mockResolvedValueOnce({ body: "log content" });
    const s = await readPodLog("pypes-prod", "pod-abc");
    expect(s).toBe("log content");
  });

  it("respects a custom tailLines value", async () => {
    readNamespacedPodLog.mockResolvedValueOnce("x");
    await readPodLog("pypes-prod", "pod-abc", 100);
    expect(readNamespacedPodLog).toHaveBeenCalledWith(
      expect.objectContaining({ tailLines: 100 }),
    );
  });
});
