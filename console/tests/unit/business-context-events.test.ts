import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted to top-of-file. Use vi.hoisted() to lift the mock
// functions above the hoist so they're available inside the factories.
const { fetchNats, peekStream } = vi.hoisted(() => ({
  fetchNats: vi.fn(),
  peekStream: vi.fn(),
}));

vi.mock("@/lib/nats", async () => {
  const actual = await vi.importActual<typeof import("@/lib/nats")>("@/lib/nats");
  return { ...actual, fetchNats };
});
vi.mock("@/lib/nats-peek", async () => {
  const actual = await vi.importActual<typeof import("@/lib/nats-peek")>("@/lib/nats-peek");
  return { ...actual, peekStream };
});

import { buildEventsContext } from "@/lib/business-context-events";
import { _resetBudgetMeterForTesting, getBudgetMeter } from "@/lib/events/budget";

beforeEach(() => {
  fetchNats.mockReset();
  peekStream.mockReset();
  _resetBudgetMeterForTesting();
});

afterEach(() => {
  vi.clearAllMocks();
});

function natsSnapshot(overrides: Partial<Awaited<ReturnType<typeof fetchNats>>> = {}) {
  return {
    reachable: true,
    monitorUrl: "http://localhost:8222",
    overview: { streams: 1, consumers: 0, messages: 0, bytes: 0, memory: 0, storage: 0 },
    streams: [],
    alerts: { redelivered: [], pending: [] },
    ...overrides,
  };
}

describe("buildEventsContext", () => {
  it("reports unreachable NATS cleanly", async () => {
    fetchNats.mockResolvedValueOnce({
      reachable: false,
      error: "connection refused",
      monitorUrl: "http://localhost:8222",
      streams: [],
      alerts: { redelivered: [], pending: [] },
    });
    peekStream.mockResolvedValueOnce({ ok: false, messages: [], error: "no conn" });

    const blurb = await buildEventsContext("pypes");
    expect(blurb).toContain("NATS unreachable");
    expect(blurb).toContain("connection refused");
  });

  it("reports no-stream state with a hint", async () => {
    fetchNats.mockResolvedValueOnce(natsSnapshot());
    peekStream.mockResolvedValueOnce({ ok: true, messages: [] });

    const blurb = await buildEventsContext("pypes");
    expect(blurb).toContain("(no stream yet");
    expect(blurb).toContain("/events tab");
  });

  it("groups recent events by subject with counts", async () => {
    fetchNats.mockResolvedValueOnce(
      natsSnapshot({
        streams: [
          {
            account: "$G",
            name: "EVENTS_PYPES",
            subjects: ["events.pypes.>"],
            messages: 3,
            bytes: 100,
            firstSeq: 1,
            lastSeq: 3,
            consumerCount: 0,
            consumers: [],
          },
        ],
      }),
    );
    peekStream.mockResolvedValueOnce({
      ok: true,
      messages: [
        {
          seq: 3,
          subject: "events.pypes.listing.deal.created.v1",
          timestamp: "2026-08-04T12:00:03Z",
          payload: { id: "d3" },
        },
        {
          seq: 2,
          subject: "events.pypes.listing.deal.created.v1",
          timestamp: "2026-08-04T12:00:02Z",
          payload: { id: "d2" },
        },
        {
          seq: 1,
          subject: "events.pypes.email.message.delivered.v1",
          timestamp: "2026-08-04T12:00:01Z",
          payload: { to: "a@b" },
        },
      ],
    });

    const blurb = await buildEventsContext("pypes");
    expect(blurb).toContain("Stream EVENTS_PYPES");
    expect(blurb).toContain("events.pypes.listing.deal.created.v1` × 2");
    expect(blurb).toContain("events.pypes.email.message.delivered.v1` × 1");
    // Sample of newest seq for each subject, one line each.
    expect(blurb).toMatch(/sample: \{"id":"d3"\}/);
    expect(blurb).toMatch(/sample: \{"to":"a@b"\}/);
  });

  it("lists registered consumers with alert flags", async () => {
    fetchNats.mockResolvedValueOnce(
      natsSnapshot({
        streams: [
          {
            account: "$G",
            name: "EVENTS_PYPES",
            subjects: ["events.pypes.>"],
            messages: 5,
            bytes: 200,
            firstSeq: 1,
            lastSeq: 5,
            consumerCount: 2,
            consumers: [
              {
                stream: "EVENTS_PYPES",
                name: "listing.scorer",
                numPending: 12,
                numAckPending: 0,
                numRedelivered: 0,
                numWaiting: 0,
              },
              {
                stream: "EVENTS_PYPES",
                name: "listing.audit",
                numPending: 0,
                numAckPending: 0,
                numRedelivered: 3,
                numWaiting: 0,
              },
            ],
          },
        ],
      }),
    );
    peekStream.mockResolvedValueOnce({ ok: true, messages: [] });

    const blurb = await buildEventsContext("pypes");
    expect(blurb).toContain("listing.scorer (pending=12)");
    expect(blurb).toContain("listing.audit (redelivered=3)");
  });

  it("reports non-zero budget spend, skips zero rows", async () => {
    fetchNats.mockResolvedValueOnce(
      natsSnapshot({
        streams: [
          {
            account: "$G",
            name: "EVENTS_PYPES",
            subjects: ["events.pypes.>"],
            messages: 1,
            bytes: 50,
            firstSeq: 1,
            lastSeq: 1,
            consumerCount: 1,
            consumers: [
              {
                stream: "EVENTS_PYPES",
                name: "listing.scorer",
                numPending: 0,
                numAckPending: 0,
                numRedelivered: 0,
                numWaiting: 0,
              },
            ],
          },
        ],
      }),
    );
    peekStream.mockResolvedValueOnce({ ok: true, messages: [] });

    // Charge the meter for one currency; the other should be omitted.
    const key = { tenant: "pypes", agent: "listing.scorer", currency: "tokens" as const };
    await getBudgetMeter().setLimit(key, { perDay: 10_000 });
    await getBudgetMeter().charge(key, 2_500);

    const blurb = await buildEventsContext("pypes");
    expect(blurb).toContain("listing.scorer · tokens: spent=2,500 / 10,000");
    // The usd_micros row (spend=0) is skipped.
    expect(blurb).not.toContain("usd_micros");
  });
});
