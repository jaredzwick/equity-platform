import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the fs writes to keep tests hermetic. Same pattern as the
// console's backup-config.test.ts.
const { store, readFile, writeFile, mkdir } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    readFile: vi.fn(async (path: string) => {
      const v = store.get(path);
      if (v === undefined) {
        const e = new Error("ENOENT") as NodeJS.ErrnoException;
        e.code = "ENOENT";
        throw e;
      }
      return v;
    }),
    writeFile: vi.fn(async (path: string, content: string) => {
      store.set(path, content);
    }),
    mkdir: vi.fn(async () => undefined),
  };
});

vi.mock("node:fs/promises", () => ({ readFile, writeFile, mkdir }));

import {
  normalizePhone,
  submitLead,
  listLeads,
} from "@/lib/leads-store";

beforeEach(() => {
  store.clear();
  readFile.mockClear();
  writeFile.mockClear();
  mkdir.mockClear();
});

afterEach(() => vi.clearAllMocks());

describe("normalizePhone", () => {
  it("accepts a bare 10-digit US number and prepends +1", () => {
    expect(normalizePhone("2125551234")).toBe("+12125551234");
    expect(normalizePhone("(212) 555-1234")).toBe("+12125551234");
    expect(normalizePhone("212.555.1234")).toBe("+12125551234");
  });

  it("preserves the country code when leading + is present", () => {
    expect(normalizePhone("+442071838750")).toBe("+442071838750");
  });

  it("rejects too-short numbers", () => {
    expect(normalizePhone("555")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("rejects too-long numbers", () => {
    expect(normalizePhone("1".repeat(16))).toBeNull();
  });
});

describe("submitLead", () => {
  it("stores a valid lead and returns created=true", async () => {
    const r = await submitLead({
      name: "Jane Doe",
      phone: "212-555-1234",
      source: "hero",
    });
    expect(r).toEqual({ ok: true, created: true });
    const all = await listLeads();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      name: "Jane Doe",
      phone: "+12125551234",
      source: "hero",
    });
    expect(all[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("dedups on normalized phone", async () => {
    await submitLead({ name: "Jane", phone: "212-555-1234" });
    const r = await submitLead({ name: "Jane again", phone: "(212) 555 1234" });
    expect(r).toEqual({ ok: true, created: false });
    const all = await listLeads();
    expect(all).toHaveLength(1);
    // Original name wins — subsequent submits are no-ops, not updates.
    expect(all[0].name).toBe("Jane");
  });

  it("rejects an empty name", async () => {
    const r = await submitLead({ name: " ", phone: "2125551234" });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("name") });
    const all = await listLeads();
    expect(all).toHaveLength(0);
  });

  it("rejects a name > 100 chars", async () => {
    const r = await submitLead({ name: "x".repeat(101), phone: "2125551234" });
    expect(r.ok).toBe(false);
  });

  it("rejects an invalid phone", async () => {
    const r = await submitLead({ name: "Jane", phone: "abc" });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("phone") });
  });

  it("preserves order across multiple submissions", async () => {
    await submitLead({ name: "Alice", phone: "2125550001" });
    await submitLead({ name: "Bob", phone: "2125550002" });
    await submitLead({ name: "Carol", phone: "2125550003" });
    const all = await listLeads();
    expect(all.map((l) => l.name)).toEqual(["Alice", "Bob", "Carol"]);
  });
});
