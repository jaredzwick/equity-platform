import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const streamInfo = vi.fn();
const streamAdd = vi.fn();
const mockJsm = { streams: { info: streamInfo, add: streamAdd } };
const mockNc = { jetstreamManager: vi.fn(async () => mockJsm) };

vi.mock("@/lib/nats-client", () => ({
  getConn: vi.fn(async () => mockNc),
}));

import { ensureTenantStream, streamNameFor } from "@/lib/nats-streams";

beforeEach(() => {
  streamInfo.mockReset();
  streamAdd.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("streamNameFor", () => {
  it("uppercases and swaps hyphens for underscores", () => {
    expect(streamNameFor("pypes")).toBe("EVENTS_PYPES");
    expect(streamNameFor("hiring-funnel")).toBe("EVENTS_HIRING_FUNNEL");
  });
});

describe("ensureTenantStream", () => {
  it("no-ops when the stream already exists", async () => {
    streamInfo.mockResolvedValueOnce({ config: { name: "EVENTS_PYPES" } });
    const r = await ensureTenantStream("pypes");
    expect(r).toEqual({ ok: true, exists: true });
    expect(streamAdd).not.toHaveBeenCalled();
  });

  it("creates the stream when info returns null (404)", async () => {
    streamInfo.mockRejectedValueOnce(new Error("stream not found"));
    streamAdd.mockResolvedValueOnce({});
    const r = await ensureTenantStream("hiring-funnel");
    expect(r).toEqual({ ok: true, created: true });
    expect(streamAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "EVENTS_HIRING_FUNNEL",
        subjects: ["events.hiring-funnel.>"],
        num_replicas: 1,
      }),
    );
  });

  it("returns error when jsm.streams.add throws", async () => {
    streamInfo.mockRejectedValueOnce(new Error("not found"));
    streamAdd.mockRejectedValueOnce(new Error("insufficient storage"));
    const r = await ensureTenantStream("pypes");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("insufficient storage");
  });
});
