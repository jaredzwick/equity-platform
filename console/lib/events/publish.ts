import "server-only";
import { JSONCodec } from "nats";
import { getConn } from "../nats-client";
import { ensureTenantStream } from "../nats-streams";
import { newEnvelope, type Actor, type Envelope } from "./envelope";
import { buildSubject, type SubjectParts } from "./subject";

const codec = JSONCodec();

export type PublishOpts<T> = {
  subject: SubjectParts;
  data: T;
  actor: Actor;
  source: string;
  correlationId?: string;
};

export type PublishResult<T> = {
  subject: string;
  seq: number;
  envelope: Envelope<T>;
};

// Publish one event. Ensures the tenant's stream exists (idempotent, cheap
// after the first call). Returns the envelope + assigned stream sequence
// so callers can wire correlation on downstream reactions.
//
// JetStream dedup: msgID is set to envelope.id, so re-invoking publishEvent
// with the same envelope (retries, replay) doesn't double-emit within the
// dedup window (default 2m).
export async function publishEvent<T>(opts: PublishOpts<T>): Promise<PublishResult<T>> {
  const envelope = newEnvelope({
    tenant: opts.subject.tenant,
    actor: opts.actor,
    source: opts.source,
    data: opts.data,
    schemaVersion: opts.subject.version,
    correlationId: opts.correlationId,
  });
  const subject = buildSubject(opts.subject);

  const ensured = await ensureTenantStream(opts.subject.tenant);
  if (!ensured.ok) {
    throw new Error(`could not ensure stream for ${opts.subject.tenant}: ${ensured.error}`);
  }

  const nc = await getConn();
  const js = nc.jetstream();
  const ack = await js.publish(subject, codec.encode(envelope), {
    msgID: envelope.id,
  });
  return { subject, seq: Number(ack.seq), envelope };
}
