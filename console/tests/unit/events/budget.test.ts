import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetBudgetMeterForTesting,
  getBudgetMeter,
  type BudgetKey,
} from "@/lib/events/budget";

beforeEach(() => _resetBudgetMeterForTesting());

const key: BudgetKey = {
  tenant: "pypes",
  agent: "listing.scorer",
  currency: "tokens",
};

describe("budget meter", () => {
  it("accumulates charges within the day window", async () => {
    const m = getBudgetMeter();
    await m.setLimit(key, { perDay: 1000 });
    await m.charge(key, 100);
    const snap = await m.charge(key, 250);
    expect(snap.spent).toBe(350);
    expect(snap.remaining).toBe(650);
    expect(snap.exhausted).toBe(false);
  });

  it("marks exhausted when spent >= limit", async () => {
    const m = getBudgetMeter();
    await m.setLimit(key, { perDay: 500 });
    const snap = await m.charge(key, 500);
    expect(snap.exhausted).toBe(true);
    expect(snap.remaining).toBe(0);
  });

  it("treats an unset limit as Infinity (fail-open in dev)", async () => {
    const m = getBudgetMeter();
    const snap = await m.charge(key, 999_999);
    expect(snap.exhausted).toBe(false);
    expect(snap.limit).toBe(Infinity);
  });

  it("isolates per-tenant + per-agent counters", async () => {
    const m = getBudgetMeter();
    const otherTenant: BudgetKey = { ...key, tenant: "other" };
    const otherAgent: BudgetKey = { ...key, agent: "deal.recommender" };
    await m.setLimit(key, { perDay: 100 });
    await m.setLimit(otherTenant, { perDay: 100 });
    await m.setLimit(otherAgent, { perDay: 100 });
    await m.charge(key, 100);
    // Same tenant, different agent — should still have full budget.
    expect((await m.snapshot(otherAgent)).spent).toBe(0);
    // Different tenant, same agent — should still have full budget.
    expect((await m.snapshot(otherTenant)).spent).toBe(0);
  });

  it("snapshot without charge returns spent=0", async () => {
    const m = getBudgetMeter();
    await m.setLimit(key, { perDay: 100 });
    const snap = await m.snapshot(key);
    expect(snap.spent).toBe(0);
    expect(snap.remaining).toBe(100);
    expect(snap.exhausted).toBe(false);
  });
});
