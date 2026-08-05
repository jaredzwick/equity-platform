import "server-only";
import { RetentionPolicy, StorageType } from "nats";
import { getConn } from "./nats-client";

export type EnsureResult = {
  ok: boolean;
  created?: boolean;
  exists?: boolean;
  error?: string;
};

// 7 days in nanoseconds.
const MAX_AGE_NS = 7 * 24 * 60 * 60 * 1_000_000_000;
// 1 GiB.
const MAX_BYTES = 1 << 30;

export function streamNameFor(slug: string): string {
  return `EVENTS_${slug.replace(/-/g, "_").toUpperCase()}`;
}

// Idempotent: if the stream exists, no-op. If it doesn't, create it.
// Per plan D3: called from tenant provisioning; failure is degrade-and-warn,
// not fail-hard. Retry endpoint exposes this same helper from /events.
export async function ensureTenantStream(slug: string): Promise<EnsureResult> {
  const name = streamNameFor(slug);
  const subjects = [`events.${slug}.>`];

  let nc;
  try {
    nc = await getConn();
  } catch (e) {
    return { ok: false, error: `NATS connect failed: ${msg(e)}` };
  }

  try {
    const jsm = await nc.jetstreamManager();
    const existing = await jsm.streams.info(name).catch(() => null);
    if (existing) return { ok: true, exists: true };

    await jsm.streams.add({
      name,
      subjects,
      retention: RetentionPolicy.Limits,
      storage: StorageType.File,
      max_age: MAX_AGE_NS,
      max_bytes: MAX_BYTES,
      num_replicas: 1,
    });
    return { ok: true, created: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
