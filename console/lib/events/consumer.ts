import "server-only";
import { AckPolicy, DeliverPolicy, JSONCodec } from "nats";
import { getConn } from "../nats-client";
import { streamNameFor } from "../nats-streams";
import type { Envelope } from "./envelope";

const codec = JSONCodec();

export type ConsumeOpts<T> = {
  // Unique consumer name — becomes the JetStream durable name. Convention:
  // "<domain>.<what-it-does>" e.g. "listing.scorer" or "billing.audit".
  name: string;

  // Which tenant's stream to bind to. Cross-tenant fanout means registering
  // once per tenant; strong per-tenant isolation is a feature, not a bug.
  tenant: string;

  // Subject filter — JetStream wildcards allowed:
  //   "events.pypes.listing.>" (all listing events for pypes)
  //   "events.pypes.billing.invoice.created.v1" (exact match)
  filterSubject: string;

  // Handler. Called once per delivery. Return normally = ack. Throw = nack
  // (message redelivered per max_deliver). Handler MUST be idempotent —
  // JetStream is at-least-once, and the same message can be delivered
  // multiple times if a consumer crashes between doing work and acking.
  handler: (env: Envelope<T>) => Promise<void> | void;

  // Optional: hard cap on redeliveries. After this, JetStream stops
  // redelivering (message stays in stream, no DLQ subject wired today).
  maxDeliver?: number;
};

// JetStream reserves `.` `*` `>` inside durable names (they collide with
// the subject wildcard grammar). Our public naming convention uses dots
// (e.g. "listing.scorer") because that matches the subject grammar and
// reads naturally. We sanitize at the boundary so both worlds are happy.
export function durableNameFor(name: string): string {
  return name.replace(/[.*>]/g, "-");
}

// Register a durable consumer and start pulling. Returns a stop() function
// that halts the pull loop; the durable consumer persists on the server
// so a fresh process picks up from the last ack. Idempotent — safe to call
// on every process start.
export async function consume<T>(opts: ConsumeOpts<T>): Promise<() => Promise<void>> {
  const nc = await getConn();
  const jsm = await nc.jetstreamManager();
  const streamName = streamNameFor(opts.tenant);
  const durableName = durableNameFor(opts.name);

  // Create-if-absent. If the durable already exists with different config,
  // JetStream returns an error and we surface it — silent config drift is
  // worse than a startup failure that forces you to redeploy or update.
  try {
    await jsm.consumers.add(streamName, {
      durable_name: durableName,
      filter_subject: opts.filterSubject,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      max_deliver: opts.maxDeliver ?? 5,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/already in use|consumer name already in use|already exists/i.test(msg)) {
      throw e;
    }
  }

  const js = nc.jetstream();
  const consumer = await js.consumers.get(streamName, durableName);
  let running = true;

  (async () => {
    while (running) {
      const iter = await consumer.consume({ max_messages: 25 });
      for await (const m of iter) {
        if (!running) break;
        try {
          const env = codec.decode(m.data) as Envelope<T>;
          await opts.handler(env);
          m.ack();
        } catch (err) {
          console.error(`[consume ${opts.name}] handler error on seq ${m.seq}:`, err);
          m.nak();
        }
      }
    }
  })().catch((err) => {
    console.error(`[consume ${opts.name}] pull loop crashed:`, err);
  });

  return async () => {
    running = false;
  };
}
