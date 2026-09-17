import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks so vi.mock's hoist order matches module-load order. Same
// pattern as provision-cron.test.ts. Each mock returns a stateful pair of
// functions we can control per test.
const {
  createNamespace,
  listNamespace,
  getFile,
  ensureRunnerSecret,
  ensureTenantStream,
} = vi.hoisted(() => ({
  createNamespace: vi.fn(),
  listNamespace: vi.fn(),
  getFile: vi.fn(),
  ensureRunnerSecret: vi.fn(),
  ensureTenantStream: vi.fn(),
}));

vi.mock("@/lib/k8s", () => ({
  core: () => ({ createNamespace, listNamespace }),
}));

vi.mock("@/lib/github", () => ({
  getFile,
}));

vi.mock("@/lib/runner-secret", () => ({
  ensureRunnerSecret,
}));

vi.mock("@/lib/nats-streams", () => ({
  ensureTenantStream,
}));

import { reconcileTenantsFromRepo } from "@/lib/tenants";

const REPO_YAML = `apiVersion: v1
kind: Namespace
metadata:
  name: acme-prod
  labels:
    equity.io/tenant: acme
    equity.io/tenant-name: Acme
---
apiVersion: v1
kind: Namespace
metadata:
  name: beta-prod
  labels:
    equity.io/tenant: beta
    equity.io/tenant-name: Beta
`;

beforeEach(() => {
  vi.clearAllMocks();
  // Defaults: repo has 2 tenants, cluster has 0 (both need creating).
  getFile.mockResolvedValue({ content: REPO_YAML });
  listNamespace.mockResolvedValue({ items: [] });
  createNamespace.mockResolvedValue({});
  ensureRunnerSecret.mockResolvedValue({ ok: true, skipped: false, action: "created" });
  ensureTenantStream.mockResolvedValue({ ok: true, created: true });
});

afterEach(() => vi.clearAllMocks());

describe("reconcileTenantsFromRepo — NATS stream auto-provision", () => {
  it("calls ensureTenantStream ONCE per newly created tenant (not per-namespace)", async () => {
    const res = await reconcileTenantsFromRepo();

    expect(res.created).toEqual(["acme", "beta"]);
    expect(ensureTenantStream).toHaveBeenCalledTimes(2);
    expect(ensureTenantStream).toHaveBeenCalledWith("acme");
    expect(ensureTenantStream).toHaveBeenCalledWith("beta");
  });

  it("does NOT call ensureTenantStream for already-existing (skipped) tenants", async () => {
    // Both tenants already in cluster → both skipped
    listNamespace.mockResolvedValueOnce({
      items: [
        { metadata: { name: "acme-prod", labels: { "equity.io/tenant": "acme" } } },
        { metadata: { name: "beta-prod", labels: { "equity.io/tenant": "beta" } } },
      ],
    });

    const res = await reconcileTenantsFromRepo();

    expect(res.skipped).toEqual(["acme", "beta"]);
    expect(res.created).toEqual([]);
    expect(ensureTenantStream).not.toHaveBeenCalled();
  });

  it("still records the tenant as created when stream provisioning fails (non-fatal)", async () => {
    ensureTenantStream.mockResolvedValueOnce({ ok: false, error: "NATS connect failed" });

    const res = await reconcileTenantsFromRepo();

    expect(res.created).toContain("acme");
    expect(res.errors).toEqual([]); // stream failure is logged, not raised
  });

  it("still calls ensureTenantStream even if runner-secret seeding fails", async () => {
    ensureRunnerSecret.mockResolvedValueOnce({ ok: false, reason: "no token" });

    await reconcileTenantsFromRepo();

    expect(ensureTenantStream).toHaveBeenCalledWith("acme");
  });

  it("returns empty result (no stream provisioning) when repo yaml is missing", async () => {
    getFile.mockResolvedValueOnce(null);

    const res = await reconcileTenantsFromRepo();

    expect(res).toEqual({ created: [], skipped: [], errors: [] });
    expect(ensureTenantStream).not.toHaveBeenCalled();
    expect(createNamespace).not.toHaveBeenCalled();
  });

  it("mixes: one tenant created (with stream), one skipped (no stream call)", async () => {
    listNamespace.mockResolvedValueOnce({
      items: [{ metadata: { name: "acme-prod", labels: { "equity.io/tenant": "acme" } } }],
    });

    const res = await reconcileTenantsFromRepo();

    expect(res.skipped).toEqual(["acme"]);
    expect(res.created).toEqual(["beta"]);
    expect(ensureTenantStream).toHaveBeenCalledTimes(1);
    expect(ensureTenantStream).toHaveBeenCalledWith("beta");
    expect(ensureTenantStream).not.toHaveBeenCalledWith("acme");
  });

  it("REGRESSION: pre-existing namespace-creation + runner-secret seeding still works", async () => {
    await reconcileTenantsFromRepo();

    // Both tenants' namespaces got created
    expect(createNamespace).toHaveBeenCalledTimes(2);
    expect(createNamespace).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          metadata: expect.objectContaining({ name: "acme-prod" }),
        }),
      }),
    );
    // Runner secret was seeded per-namespace (existing behavior)
    expect(ensureRunnerSecret).toHaveBeenCalledTimes(2);
    expect(ensureRunnerSecret).toHaveBeenCalledWith("acme-prod");
    expect(ensureRunnerSecret).toHaveBeenCalledWith("beta-prod");
  });
});
