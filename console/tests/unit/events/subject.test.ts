import { describe, expect, it } from "vitest";
import { buildSubject, parseSubject } from "@/lib/events/subject";

describe("buildSubject", () => {
  it("builds the canonical form", () => {
    expect(
      buildSubject({
        tenant: "pypes",
        domain: "billing",
        entity: "invoice",
        action: "created",
        version: 1,
      }),
    ).toBe("events.pypes.billing.invoice.created.v1");
  });

  it("allows hyphens inside segments", () => {
    expect(
      buildSubject({
        tenant: "hiring-funnel",
        domain: "email",
        entity: "message",
        action: "delivered",
        version: 2,
      }),
    ).toBe("events.hiring-funnel.email.message.delivered.v2");
  });

  it("rejects invalid segments", () => {
    // leading dash
    expect(() =>
      buildSubject({ tenant: "-bad", domain: "d", entity: "e", action: "a", version: 1 }),
    ).toThrow();
    // uppercase
    expect(() =>
      buildSubject({ tenant: "pypes", domain: "d", entity: "e", action: "Created", version: 1 }),
    ).toThrow();
    // underscore
    expect(() =>
      buildSubject({ tenant: "pypes", domain: "d", entity: "e", action: "bad_action", version: 1 }),
    ).toThrow();
    // version < 1
    expect(() =>
      buildSubject({ tenant: "pypes", domain: "d", entity: "e", action: "created", version: 0 }),
    ).toThrow();
    // non-integer version
    expect(() =>
      buildSubject({ tenant: "pypes", domain: "d", entity: "e", action: "created", version: 1.5 }),
    ).toThrow();
  });
});

describe("parseSubject", () => {
  it("round-trips a valid subject", () => {
    const parts = {
      tenant: "pypes",
      domain: "listing",
      entity: "deal",
      action: "scored",
      version: 2,
    };
    expect(parseSubject(buildSubject(parts))).toEqual(parts);
  });

  it("returns null for non-events subjects", () => {
    expect(parseSubject("something.else.entirely")).toBeNull();
    expect(parseSubject("events.pypes.billing.invoice.created")).toBeNull(); // missing v<n>
    expect(parseSubject("events.pypes.billing.invoice.created.foo")).toBeNull();
    expect(parseSubject("events.pypes.billing.invoice.created.v0")).toBeNull();
    expect(parseSubject("events..billing.invoice.created.v1")).toBeNull(); // empty tenant
  });
});
