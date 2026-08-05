import "server-only";
import { consume, durableNameFor } from "./consumer";
import type { Envelope } from "./envelope";
import { publishEvent } from "./publish";
import { getBudgetMeter, type BudgetKey, type Currency } from "./budget";
import type { SubjectParts } from "./subject";

// enrich — the baseline reaction pattern. Subscribe to input events, run
// a transform (often an AI call), publish the result as a new event.
// Common shape: "raw record arrives → AI decorates it → decorated record".
//
// Correlation is preserved: the output event carries the input's
// correlationId so downstream consumers can join related events.
//
// Budget: if opts.budget is set, the consumer pre-checks the tenant's cap
// before doing any work. Exhausted budget = ack + skip (do NOT nack — that
// causes redelivery loops when the cap is real).
//
// Once this shape settles, the other patterns (route/draft/act/investigate/
// watch) can follow the same wrapping: they all delegate to consume() and
// publishEvent() with slightly different handler contracts.

export type EnrichOpts<TIn, TOut> = {
  name: string;             // consumer + agent name, e.g. "listing.scorer"
  tenant: string;
  filterSubject: string;    // JetStream filter; supports wildcards
  budget?: {
    currency: Currency;
    perDay: number;
  };
  handler: (
    env: Envelope<TIn>,
  ) => Promise<EnrichResult<TOut> | null> | EnrichResult<TOut> | null;
};

export type EnrichResult<TOut> = {
  outputSubject: SubjectParts;  // e.g. events.pypes.listing.deal.scored.v1
  data: TOut;
  cost?: number;                // charged against the budget if set
};

export async function registerEnrich<TIn, TOut>(
  opts: EnrichOpts<TIn, TOut>,
): Promise<() => Promise<void>> {
  // Budget key uses the sanitized name so lookups from event-bus snapshots
  // (which read the JetStream durable_name) join up with the budget rows.
  const agentName = durableNameFor(opts.name);
  const budgetKey: BudgetKey | null = opts.budget
    ? { tenant: opts.tenant, agent: agentName, currency: opts.budget.currency }
    : null;
  if (opts.budget && budgetKey) {
    await getBudgetMeter().setLimit(budgetKey, { perDay: opts.budget.perDay });
  }

  return consume<TIn>({
    name: opts.name,
    tenant: opts.tenant,
    filterSubject: opts.filterSubject,
    handler: async (env) => {
      if (budgetKey) {
        const snap = await getBudgetMeter().snapshot(budgetKey);
        if (snap.exhausted) {
          console.warn(
            `[${opts.name}] budget exhausted for ${opts.tenant} (${snap.spent}/${snap.limit}); dropping`,
          );
          return; // ack + skip
        }
      }

      const result = await opts.handler(env);
      if (!result) return;

      await publishEvent({
        subject: result.outputSubject,
        data: result.data,
        actor: { kind: "agent", name: agentName },
        source: agentName,
        correlationId: env.correlationId,
      });

      if (budgetKey && result.cost) {
        await getBudgetMeter().charge(budgetKey, result.cost);
      }
    },
  });
}
