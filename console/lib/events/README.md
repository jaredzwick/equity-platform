# events/ — event-driven primitives for the platform

An extendable primitive for building event-driven systems across a portfolio of
tenants on the same NATS JetStream backbone. Every event carries a canonical
envelope, subjects follow a strict grammar, consumers are durable and
budget-aware, and reaction patterns (enrich, route, draft, act, investigate,
watch) are thin adapters on top of the same primitives.

## The four locked-in decisions

1. **Subject grammar** — `events.<tenant>.<domain>.<entity>.<action>.v<n>`.
   Version in the subject so consumers can subscribe to one version and ignore
   others during migrations.
2. **Envelope** — every event carries
   `{id, tenant, actor, source, correlationId, ts, schemaVersion, data}`.
   Enables replay, cost attribution, audit, and cross-consumer correlation.
3. **Human-gate matrix** — reactions declare intent (enrich/route/draft/…).
   Drafts stay under human approval; only `enrich` and `investigate` run
   fully autonomously by default.
4. **Per-tenant budget cap** — agent consumers check a token/dollar meter
   per tenant per day. Exhausted budget = ack + skip (not nack, which
   would loop).

## Publish an event

```ts
import { publishEvent } from "@/lib/events";

await publishEvent({
  subject: {
    tenant: "pypes",
    domain: "listing",
    entity: "deal",
    action: "created",
    version: 1,
  },
  data: { id: "abc123", asking: 250_000, broker: "BizBuySell" },
  actor: { kind: "system", source: "scraper" },
  source: "scraper",
});
```

The tenant's JetStream (`EVENTS_<TENANT>`) is auto-provisioned on first
publish. The envelope's `id` is used as the JetStream `msgID` for dedup
inside the default 2-minute window.

## Consume events

```ts
import { consume, type Envelope } from "@/lib/events";

const stop = await consume<{ id: string; asking: number }>({
  name: "listing.audit",             // JetStream durable name
  tenant: "pypes",
  filterSubject: "events.pypes.listing.deal.created.v1",
  handler: async (env) => {
    // Handler MUST be idempotent — at-least-once delivery.
    await recordDeal(env.data);
  },
});

// On shutdown:
// await stop();
```

- `consume()` creates the durable consumer idempotently — safe to call on
  every process start.
- `filterSubject` supports JetStream wildcards
  (`events.pypes.listing.>`, `events.pypes.billing.*.created.v1`, etc.).
- Throwing in the handler triggers a nack; the message is redelivered
  up to `maxDeliver` (default 5).
- **Durable naming**: JetStream reserves `.` `*` `>` inside durable names,
  so `name: "listing.scorer"` becomes the durable `listing-scorer` on the
  server. This is transparent — budget keys use the same sanitized form
  so lookups from event-bus snapshots (which read durable names) match.
  If you list consumers via `nats consumer ls`, you'll see the sanitized
  form.

## Register an enrich reaction

Enrich = "raw record arrives → transform (often AI) → publish decorated
version." The most common pattern.

```ts
import { registerEnrich } from "@/lib/events";

await registerEnrich<
  { title: string; description: string },
  { score: number; thesis: string; flags: string[] }
>({
  name: "listing.scorer",
  tenant: "pypes",
  filterSubject: "events.pypes.listing.deal.created.v1",
  budget: { currency: "tokens", perDay: 200_000 },
  handler: async (env) => {
    const scored = await callClaude(env.data.title, env.data.description);
    return {
      outputSubject: {
        tenant: "pypes",
        domain: "listing",
        entity: "deal",
        action: "scored",
        version: 1,
      },
      data: scored,
      cost: scored.tokensUsed,
    };
  },
});
```

What the adapter does for you:

- Preserves `correlationId` from the input event onto the output event, so
  downstream consumers can join scored/raw pairs.
- Sets the output event's `actor` to `{ kind: "agent", name: "listing.scorer" }`
  automatically.
- Pre-checks the tenant's daily budget; if exhausted, skips + acks (no
  redelivery loop) and logs a warning.
- Charges the budget by `result.cost` after a successful publish.

Return `null` from the handler to skip publishing (e.g., "this listing
doesn't need a score").

## Budget

```ts
import { getBudgetMeter } from "@/lib/events";

const key = { tenant: "pypes", agent: "listing.scorer", currency: "tokens" };
await getBudgetMeter().setLimit(key, { perDay: 200_000 });

const snap = await getBudgetMeter().snapshot(key);
// { spent, limit, remaining, exhausted, windowStart }
```

Backing store is in-memory today — single-process, resets on restart. Swap
`getBudgetMeter()` for a Postgres or Redis impl when you need durability
or multi-replica accuracy. The `BudgetMeter` interface is what stays
stable.

## Extending — writing a new reaction pattern

The five other patterns (route/draft/act/investigate/watch) will follow the
same wrapping shape as `registerEnrich`:

1. Take an `opts` object with `{ name, tenant, filterSubject, budget?, handler }`.
2. Delegate to `consume()` for the subscribe half.
3. Delegate to `publishEvent()` for any emissions (optional — `draft` might
   only write to a review queue; `investigate` might only log).
4. Wrap the handler in budget pre-check + post-charge if `budget` is set.
5. Set `actor` to `{ kind: "agent", name: opts.name }` on emissions.

New patterns live in `reactions.ts` alongside `registerEnrich`. Keep the
adapter layer thin — anything larger than ~40 lines usually means the
pattern is doing work that belongs in the handler.

## Testing

Unit tests for envelope, subject, and budget live in
`console/tests/unit/events/`. They don't touch NATS — the wire-level
publish/consume paths are covered by the integration flow demonstrated in
the Events tab of the console (`/[tenant]/events`).

Run: `npm test` from `console/`.
