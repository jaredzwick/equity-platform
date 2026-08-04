import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the nats-client singleton before importing nats-peek.
const getMessage = vi.fn();
const info = vi.fn();
const mockJsm = { streams: { info, getMessage } };
const mockNc = { jetstreamManager: vi.fn(async () => mockJsm) };

vi.mock("@/lib/nats-client", () => ({
  getConn: vi.fn(async () => mockNc),
}));

import { peekStream } from "@/lib/nats-peek";

const encode = (s: string) => new TextEncoder().encode(s);

beforeEach(() => {
  getMessage.mockReset();
  info.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("peekStream", () => {
  it("rejects invalid counts", async () => {
    expect(await peekStream("EVENTS_x", 0)).toMatchObject({ ok: false });
    expect(await peekStream("EVENTS_x", 200)).toMatchObject({ ok: false });
  });

  it("returns error when stream is not found", async () => {
    info.mockRejectedValueOnce(new Error("stream not found"));
    const result = await peekStream("EVENTS_missing", 5);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("returns empty when stream has no messages", async () => {
    info.mockResolvedValueOnce({ state: { last_seq: 0 } });
    const result = await peekStream("EVENTS_new", 5);
    expect(result).toEqual({ ok: true, messages: [] });
    expect(getMessage).not.toHaveBeenCalled();
  });

  it("returns the last N messages, newest first, JSON-decoded when valid", async () => {
    info.mockResolvedValueOnce({ state: { last_seq: 3 } });
    getMessage.mockImplementation(async (_stream, { seq }: { seq: number }) => ({
      seq,
      subject: `events.pypes.msg.${seq}`,
      time: `2026-08-04T00:00:0${seq}Z`,
      data: encode(JSON.stringify({ n: seq })),
    }));

    const result = await peekStream("EVENTS_pypes", 3);
    expect(result.ok).toBe(true);
    expect(result.messages.map((m) => m.seq)).toEqual([3, 2, 1]);
    expect(result.messages[0].payload).toEqual({ n: 3 });
  });

  it("scans back past 404 gaps up to count*2 before giving up", async () => {
    info.mockResolvedValueOnce({ state: { last_seq: 10 } });
    // Seqs 10 and 9 are gone; 8, 7, 6 exist.
    getMessage.mockImplementation(async (_stream, { seq }: { seq: number }) => {
      if (seq === 10 || seq === 9) throw new Error("no message");
      return {
        seq,
        subject: `s.${seq}`,
        time: "2026-08-04T00:00:00Z",
        data: encode(`plain-${seq}`),
      };
    });

    const result = await peekStream("EVENTS_gappy", 3);
    expect(result.ok).toBe(true);
    // count=3, maxScanback=6 → tries seqs 10..5, gets 8/7/6/5, returns top 3.
    expect(result.messages.map((m) => m.seq)).toEqual([8, 7, 6]);
    // Non-JSON payload → raw string with truncation marker if long.
    expect(result.messages[0].payload).toBe("plain-8");
  });

  it("truncates non-JSON payloads over 500 chars with an ellipsis", async () => {
    info.mockResolvedValueOnce({ state: { last_seq: 1 } });
    const huge = "x".repeat(700);
    getMessage.mockResolvedValueOnce({
      seq: 1,
      subject: "s.big",
      time: "2026-08-04T00:00:00Z",
      data: encode(huge),
    });

    const result = await peekStream("EVENTS_big", 1);
    expect(result.ok).toBe(true);
    expect(typeof result.messages[0].payload).toBe("string");
    expect((result.messages[0].payload as string).length).toBe(501); // 500 + …
    expect((result.messages[0].payload as string).endsWith("…")).toBe(true);
  });
});
