import { describe, expect, it } from "vitest";
import { newEnvelope } from "@/lib/events/envelope";

describe("newEnvelope", () => {
  it("fills id, ts, and correlationId when omitted", () => {
    const env = newEnvelope({
      tenant: "pypes",
      actor: { kind: "human", id: "jared" },
      source: "test",
      data: { hello: "world" },
      schemaVersion: 1,
    });
    expect(env.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(env.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(env.id).not.toBe(env.correlationId);
    expect(env.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(env.data).toEqual({ hello: "world" });
    expect(env.schemaVersion).toBe(1);
  });

  it("preserves supplied correlationId and ts (for replay + join)", () => {
    const env = newEnvelope({
      tenant: "pypes",
      actor: { kind: "system", source: "scraper" },
      source: "scraper",
      data: null,
      schemaVersion: 1,
      correlationId: "fixed-correlation",
      ts: "2026-08-04T00:00:00.000Z",
    });
    expect(env.correlationId).toBe("fixed-correlation");
    expect(env.ts).toBe("2026-08-04T00:00:00.000Z");
  });

  it("accepts null tenant for cluster-scoped events", () => {
    const env = newEnvelope({
      tenant: null,
      actor: { kind: "system", source: "kube-controller" },
      source: "kube-controller",
      data: { pod: "nats-0" },
      schemaVersion: 1,
    });
    expect(env.tenant).toBeNull();
  });

  it("carries agent actor with optional runId", () => {
    const env = newEnvelope({
      tenant: "pypes",
      actor: { kind: "agent", name: "listing.scorer", runId: "abc123" },
      source: "listing.scorer",
      data: { score: 87 },
      schemaVersion: 1,
    });
    expect(env.actor).toEqual({ kind: "agent", name: "listing.scorer", runId: "abc123" });
  });
});
