import "server-only";

// Tenant-scoped snapshot of the event bus for the chat's LIVE STATE block.
// Kept separate from business-context.ts so the events section can grow
// without bloating the general k8s/nats context.
//
// Design decisions:
// - Cap peek to 20 messages to keep the system prompt small (~few KB).
// - Group peeked messages by subject with counts; show only the newest
//   subject occurrence's payload. The model doesn't need every payload —
//   it needs the shape and the fact that events are flowing.
// - Consumer list stays raw; there aren't many of them (< 20 realistic).
// - Budget snapshots: for each durable consumer, snapshot both currencies
//   (tokens + usd_micros). Skip zero-spend rows to keep noise down.

import { fetchNats, type StreamRow } from "@/lib/nats";
import { streamNameFor } from "@/lib/nats-streams";
import { peekStream } from "@/lib/nats-peek";
import { getBudgetMeter, type Currency } from "@/lib/events";

const PEEK_MAX = 20;
const CURRENCIES: Currency[] = ["tokens", "usd_micros"];

export async function buildEventsContext(tenantSlug: string): Promise<string> {
  const streamName = streamNameFor(tenantSlug);
  const [nats, peek] = await Promise.all([
    fetchNats().catch(() => null),
    peekStream(streamName, PEEK_MAX).catch(() => null),
  ]);

  const lines: string[] = [];
  lines.push(`## Event bus (tenant scope: events.${tenantSlug}.>)`);

  if (!nats || !nats.reachable) {
    lines.push(`NATS unreachable${nats?.error ? `: ${nats.error}` : ""}`);
    lines.push("");
    return lines.join("\n");
  }

  const stream = nats.streams.find((s) => s.name === streamName);
  if (!stream) {
    lines.push("(no stream yet — publish an event or provision from /events tab)");
    lines.push("");
    return lines.join("\n");
  }

  lines.push(
    `Stream ${stream.name}: ${stream.messages.toLocaleString()} msgs · ` +
      `subjects=${stream.subjects.join(", ")} · ` +
      `${stream.consumerCount} consumer(s)`,
  );
  lines.push("");

  // Recent subjects — grouped, newest payload sample per subject.
  lines.push(`### Recent events (last ${PEEK_MAX} on the stream)`);
  if (!peek || !peek.ok || peek.messages.length === 0) {
    lines.push("(no messages yet)");
  } else {
    const bySubject = new Map<string, { count: number; sample: unknown; lastSeq: number; lastTs: string }>();
    for (const m of peek.messages) {
      const cur = bySubject.get(m.subject);
      if (cur) {
        cur.count += 1;
        if (m.seq > cur.lastSeq) {
          cur.lastSeq = m.seq;
          cur.lastTs = m.timestamp;
          cur.sample = m.payload;
        }
      } else {
        bySubject.set(m.subject, {
          count: 1,
          sample: m.payload,
          lastSeq: m.seq,
          lastTs: m.timestamp,
        });
      }
    }
    for (const [subject, info] of bySubject) {
      lines.push(`- \`${subject}\` × ${info.count}, last at ${info.lastTs} (seq #${info.lastSeq})`);
      const sampleStr = compactSample(info.sample);
      lines.push(`  sample: ${sampleStr}`);
    }
  }
  lines.push("");

  // Durable consumers on this stream — these are the "reactions" that already exist.
  lines.push(`### Consumers on ${stream.name}`);
  if (stream.consumers.length === 0) {
    lines.push("(none registered — nothing is reacting to these events yet)");
  } else {
    for (const c of stream.consumers) {
      const flags: string[] = [];
      if (c.numPending > 0) flags.push(`pending=${c.numPending}`);
      if (c.numAckPending > 0) flags.push(`ack-pending=${c.numAckPending}`);
      if (c.numRedelivered > 0) flags.push(`redelivered=${c.numRedelivered}`);
      lines.push(`- ${c.name}${flags.length ? ` (${flags.join(", ")})` : ""}`);
    }
  }
  lines.push("");

  // Budgets — only show rows with non-zero spend to keep the section short.
  await appendBudgetSection(lines, tenantSlug, stream);

  return lines.join("\n");
}

async function appendBudgetSection(
  lines: string[],
  tenantSlug: string,
  stream: StreamRow,
): Promise<void> {
  const meter = getBudgetMeter();
  const rows: string[] = [];
  for (const consumer of stream.consumers) {
    for (const currency of CURRENCIES) {
      const snap = await meter.snapshot({
        tenant: tenantSlug,
        agent: consumer.name,
        currency,
      });
      if (snap.spent === 0) continue;
      const limit = snap.limit === Infinity ? "no cap" : snap.limit.toLocaleString();
      const flag = snap.exhausted ? " ⚠️ EXHAUSTED" : "";
      rows.push(
        `- ${consumer.name} · ${currency}: spent=${snap.spent.toLocaleString()} / ${limit}${flag} ` +
          `(window from ${snap.windowStart})`,
      );
    }
  }
  lines.push("### Budget (today)");
  lines.push(rows.length ? rows.join("\n") : "(no charges today)");
  lines.push("");
}

// Compact a payload sample to one line so many subjects can share screen
// space. Long JSON gets truncated with an ellipsis; strings get quoted.
function compactSample(payload: unknown): string {
  if (payload === null || payload === undefined) return "(empty)";
  const s = typeof payload === "string" ? payload : JSON.stringify(payload);
  const compact = s.replace(/\s+/g, " ");
  return compact.length > 200 ? `${compact.slice(0, 197)}…` : compact;
}
