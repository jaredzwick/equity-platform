import "server-only";

// Per-tenant, per-day budget meter. In-memory MVP behind a stable interface;
// swap the backing store for Postgres UPSERT or Redis INCR when we need
// durability + multi-process. The BudgetMeter interface is deliberately
// small so consumers don't change when the impl changes.
//
// Currency: pick "tokens" for LLM token budgets (input+output combined) or
// "usd_micros" for anything money-denominated (1 USD = 1_000_000 units).
// Two currencies because $/token varies per model and we don't want a
// consumer converting on every event.

export type Currency = "tokens" | "usd_micros";

export type BudgetKey = {
  tenant: string;
  agent: string;      // logical consumer name — matches ConsumeOpts.name
  currency: Currency;
};

export type BudgetLimit = {
  perDay: number;     // in the same currency
};

export type BudgetSnapshot = {
  spent: number;
  limit: number;      // Infinity = no cap set
  remaining: number;  // 0 when exhausted, even if spent > limit
  exhausted: boolean; // true when spent >= limit
  windowStart: string; // ISO — start of the current day window
};

export interface BudgetMeter {
  charge(key: BudgetKey, amount: number): Promise<BudgetSnapshot>;
  snapshot(key: BudgetKey): Promise<BudgetSnapshot>;
  setLimit(key: BudgetKey, limit: BudgetLimit): Promise<void>;
}

// In-memory impl. Day rollover is lazy — a charge on a new day drops the
// old day's row. Single-process only; if you run more than one console
// replica you'll double-count until we swap for a shared backing store.
class InMemoryMeter implements BudgetMeter {
  private spent = new Map<string, number>();
  private limits = new Map<string, number>();

  async charge(k: BudgetKey, amount: number): Promise<BudgetSnapshot> {
    const day = dayKey();
    const key = spentKey(k, day);
    const spent = (this.spent.get(key) ?? 0) + amount;
    this.spent.set(key, spent);
    return this.build(k, day, spent);
  }

  async snapshot(k: BudgetKey): Promise<BudgetSnapshot> {
    const day = dayKey();
    return this.build(k, day, this.spent.get(spentKey(k, day)) ?? 0);
  }

  async setLimit(k: BudgetKey, limit: BudgetLimit): Promise<void> {
    this.limits.set(limitKey(k), limit.perDay);
  }

  private build(k: BudgetKey, day: string, spent: number): BudgetSnapshot {
    const limit = this.limits.get(limitKey(k)) ?? Infinity;
    return {
      spent,
      limit,
      remaining: Math.max(0, limit - spent),
      exhausted: spent >= limit,
      windowStart: `${day}T00:00:00.000Z`,
    };
  }
}

function dayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
function spentKey(k: BudgetKey, day: string): string {
  return `${k.tenant}|${k.agent}|${k.currency}|${day}`;
}
function limitKey(k: BudgetKey): string {
  return `${k.tenant}|${k.agent}|${k.currency}`;
}

let singleton: BudgetMeter | null = null;
export function getBudgetMeter(): BudgetMeter {
  if (!singleton) singleton = new InMemoryMeter();
  return singleton;
}

// Test helper — resets the singleton so per-test state doesn't leak.
export function _resetBudgetMeterForTesting(): void {
  singleton = null;
}
