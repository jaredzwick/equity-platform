import "server-only";
import { getConn } from "./nats-client";

export type PeekedMessage = {
  seq: number;
  subject: string;
  timestamp: string; // ISO
  // Payload: parsed JSON if valid, else the raw string truncated to 500 chars.
  payload: unknown;
  raw?: string; // present only when payload was truncated (i.e. non-JSON)
};

const PAYLOAD_MAX = 500;

export type PeekResult = {
  ok: boolean;
  messages: PeekedMessage[];
  error?: string;
};

// Fetch the last `count` messages on a stream via JetStream direct
// getMessage(seq). Per plan D1: peek is a one-shot, not a subscription,
// so we avoid consumer lifecycle by fetching by sequence number.
//
// Gaps handled: retention/compaction can delete individual seqs. If
// getMessage returns 404 we skip and keep scanning back until we've
// tried up to `count * 2` sequences.
export async function peekStream(name: string, count = 10): Promise<PeekResult> {
  if (count <= 0 || count > 100) {
    return { ok: false, messages: [], error: "count must be 1..100" };
  }

  let nc;
  try {
    nc = await getConn();
  } catch (e) {
    return { ok: false, messages: [], error: `NATS connect failed: ${msg(e)}` };
  }

  try {
    const jsm = await nc.jetstreamManager();
    const info = await jsm.streams.info(name).catch(() => null);
    if (!info) return { ok: false, messages: [], error: `stream not found: ${name}` };

    const lastSeq = info.state.last_seq;
    if (lastSeq === 0) return { ok: true, messages: [] };

    // Ask for count*2 seqs up front so retention gaps (404s) don't
    // starve the result — we take the first `count` successful.
    const maxScanback = count * 2;
    const seqs: number[] = [];
    for (let i = 0; i < maxScanback; i++) {
      const s = lastSeq - i;
      if (s < 1) break;
      seqs.push(s);
    }

    const results = await Promise.allSettled(
      seqs.map((seq) => jsm.streams.getMessage(name, { seq })),
    );

    const messages: PeekedMessage[] = [];
    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value) continue;
      if (messages.length >= count) break;
      const raw = new TextDecoder().decode(r.value.data);
      messages.push({
        seq: Number(r.value.seq),
        subject: r.value.subject,
        timestamp: r.value.time instanceof Date
          ? r.value.time.toISOString()
          : String(r.value.time),
        ...decodePayload(raw),
      });
    }

    // Newest first.
    messages.sort((a, b) => b.seq - a.seq);
    return { ok: true, messages };
  } catch (e) {
    return { ok: false, messages: [], error: msg(e) };
  }
}

function decodePayload(raw: string): { payload: unknown; raw?: string } {
  try {
    return { payload: JSON.parse(raw) };
  } catch {
    const truncated = raw.length > PAYLOAD_MAX ? raw.slice(0, PAYLOAD_MAX) + "…" : raw;
    return { payload: truncated, raw: truncated };
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
