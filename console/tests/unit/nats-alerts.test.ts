import { describe, expect, it } from "vitest";
import { computeAlerts, type StreamRow } from "@/lib/nats";

const stream = (name: string, consumers: StreamRow["consumers"]): StreamRow => ({
  account: "$G",
  name,
  subjects: [],
  messages: 0,
  bytes: 0,
  firstSeq: 0,
  lastSeq: 0,
  consumerCount: consumers.length,
  consumers,
});

const consumer = (
  overrides: Partial<StreamRow["consumers"][number]>,
): StreamRow["consumers"][number] => ({
  stream: "s",
  name: "c",
  numPending: 0,
  numAckPending: 0,
  numRedelivered: 0,
  numWaiting: 0,
  ...overrides,
});

describe("computeAlerts", () => {
  it("returns empty alerts when everything is healthy", () => {
    const s = stream("healthy", [consumer({ numPending: 5, numRedelivered: 0 })]);
    expect(computeAlerts([s])).toEqual({ redelivered: [], pending: [] });
  });

  it("flags any consumer with redelivered > 0", () => {
    const s = stream("redel", [consumer({ name: "worker", numRedelivered: 3 })]);
    const alerts = computeAlerts([s]);
    expect(alerts.redelivered).toEqual([{ stream: "redel", consumer: "worker", count: 3 }]);
    expect(alerts.pending).toEqual([]);
  });

  it("flags pending only above the hardcoded threshold of 100", () => {
    const s = stream("pend", [
      consumer({ name: "under", numPending: 100 }),
      consumer({ name: "over", numPending: 101 }),
    ]);
    const alerts = computeAlerts([s]);
    expect(alerts.pending).toEqual([{ stream: "pend", consumer: "over", count: 101 }]);
  });

  it("aggregates across streams", () => {
    const s1 = stream("a", [consumer({ name: "c1", numRedelivered: 1 })]);
    const s2 = stream("b", [consumer({ name: "c2", numPending: 500 })]);
    const alerts = computeAlerts([s1, s2]);
    expect(alerts.redelivered).toHaveLength(1);
    expect(alerts.pending).toHaveLength(1);
  });

  it("returns empty for an empty streams array", () => {
    expect(computeAlerts([])).toEqual({ redelivered: [], pending: [] });
  });
});
