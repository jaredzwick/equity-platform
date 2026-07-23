// NATS JetStream monitoring — reads the nats-server /jsz HTTP endpoint.
//
// Local dev requires a port-forward:
//   kubectl port-forward -n nats svc/nats-headless 8222:8222
// In-cluster: set NATS_MONITOR_URL=http://nats-headless.nats.svc.cluster.local:8222
//
// /jsz reference: https://docs.nats.io/running-a-nats-service/nats_admin/monitoring
// The `?streams=1&consumers=1` params make the server include per-stream and
// per-consumer details in the response.

const MONITOR_URL = process.env.NATS_MONITOR_URL ?? "http://localhost:8222";

// Raw shape returned by /jsz?streams=1&consumers=1. Only the fields we render
// are typed — everything else stays untyped so we don't have to keep this in
// sync with nats-server releases.
type JszResponse = {
  disabled?: boolean | null;
  streams: number;
  consumers: number;
  messages: number;
  bytes: number;
  memory: number;
  storage: number;
  account_details?: Array<{
    name: string;
    stream_detail?: Array<{
      name: string;
      config?: { subjects?: string[] | null; retention?: string | null };
      state: {
        messages: number;
        bytes: number;
        first_seq: number;
        last_seq: number;
        consumer_count: number;
      };
      consumer_detail?: Array<{
        name: string;
        num_pending: number;
        num_ack_pending: number;
        num_redelivered: number;
        num_waiting?: number;
      }>;
    }>;
  }>;
};

export type JsOverview = {
  streams: number;
  consumers: number;
  messages: number;
  bytes: number;
  memory: number;
  storage: number;
};

export type StreamRow = {
  account: string;
  name: string;
  subjects: string[];
  messages: number;
  bytes: number;
  firstSeq: number;
  lastSeq: number;
  consumerCount: number;
  consumers: ConsumerRow[];
};

export type ConsumerRow = {
  stream: string;
  name: string;
  numPending: number;
  numAckPending: number;
  numRedelivered: number;
  numWaiting: number;
};

export type NatsSnapshot = {
  reachable: boolean;
  error?: string;
  monitorUrl: string;
  overview?: JsOverview;
  streams: StreamRow[];
};

export async function fetchNats(): Promise<NatsSnapshot> {
  const url = `${MONITOR_URL}/jsz?streams=1&consumers=1&config=1`;
  let raw: JszResponse;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) {
      return { reachable: false, error: `HTTP ${res.status}`, monitorUrl: MONITOR_URL, streams: [] };
    }
    raw = (await res.json()) as JszResponse;
  } catch (e) {
    return {
      reachable: false,
      error: e instanceof Error ? e.message : String(e),
      monitorUrl: MONITOR_URL,
      streams: [],
    };
  }

  const streams: StreamRow[] = [];
  for (const acct of raw.account_details ?? []) {
    for (const s of acct.stream_detail ?? []) {
      streams.push({
        account: acct.name,
        name: s.name,
        subjects: s.config?.subjects ?? [],
        messages: s.state.messages,
        bytes: s.state.bytes,
        firstSeq: s.state.first_seq,
        lastSeq: s.state.last_seq,
        consumerCount: s.state.consumer_count,
        consumers: (s.consumer_detail ?? []).map((c) => ({
          stream: s.name,
          name: c.name,
          numPending: c.num_pending,
          numAckPending: c.num_ack_pending,
          numRedelivered: c.num_redelivered,
          numWaiting: c.num_waiting ?? 0,
        })),
      });
    }
  }

  return {
    reachable: true,
    monitorUrl: MONITOR_URL,
    overview: {
      streams: raw.streams,
      consumers: raw.consumers,
      messages: raw.messages,
      bytes: raw.bytes,
      memory: raw.memory,
      storage: raw.storage,
    },
    streams,
  };
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MiB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GiB`;
}
