import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "@/lib/leads-store";

// Mock fetch before importing the module under test so the mock is in
// place when pypes-leads captures a reference.
const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", fetchMock);

// The bearer must be set to reach the fetch path; unset would return
// `disabled` early. Set once at file scope so every test starts from
// the same known-good env.
const OLD_ENV = { ...process.env };
process.env.LAMBOAPP_BACKEND_BEARER = "test-bearer";
process.env.NEXT_PUBLIC_PYPES_API_URL = "https://api.pypes.test";

import { syncLeadToPypes } from "@/lib/pypes-leads";

const lead: Lead = {
  name: "Jane Doe",
  phone: "+12125550199",
  createdAt: "2026-08-05T00:00:00.000Z",
  source: "signup-page",
};

beforeEach(() => fetchMock.mockReset());
afterEach(() => {
  vi.clearAllMocks();
});

// Restore env after the file's tests finish so other test files aren't
// contaminated.
afterEach(() => {
  process.env = { ...OLD_ENV };
  process.env.LAMBOAPP_BACKEND_BEARER = "test-bearer";
  process.env.NEXT_PUBLIC_PYPES_API_URL = "https://api.pypes.test";
});

describe("syncLeadToPypes", () => {
  it("returns disabled when LAMBOAPP_BACKEND_BEARER is missing", async () => {
    delete process.env.LAMBOAPP_BACKEND_BEARER;
    const r = await syncLeadToPypes(lead);
    expect(r.status).toBe("disabled");
    process.env.LAMBOAPP_BACKEND_BEARER = "test-bearer";
  });

  it("returns endpoint_missing on 404 (backend not deployed yet)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);
    const r = await syncLeadToPypes(lead);
    expect(r.status).toBe("endpoint_missing");
    if (r.status === "endpoint_missing") {
      expect(r.url).toBe("https://api.pypes.test/lamboapp/leads/capture");
    }
  });

  it("returns ok with lead_id + ghl_contact_id on 200", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        lead_id: "lead-abc",
        ghl_contact_id: "ghl-xyz",
        ghl_status: "synced",
      }),
    } as Response);
    const r = await syncLeadToPypes(lead);
    expect(r).toEqual({
      status: "ok",
      leadId: "lead-abc",
      ghlContactId: "ghl-xyz",
      ghlStatus: "synced",
    });
  });

  it("returns error on 5xx with the backend's detail message", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: "database is down" }),
    } as Response);
    const r = await syncLeadToPypes(lead);
    expect(r.status).toBe("error");
    if (r.status === "error") {
      expect(r.error).toContain("500");
      expect(r.error).toContain("database is down");
    }
  });

  it("returns error when fetch itself throws", async () => {
    fetchMock.mockRejectedValueOnce(new Error("connection refused"));
    const r = await syncLeadToPypes(lead);
    expect(r.status).toBe("error");
    if (r.status === "error") {
      expect(r.error).toContain("connection refused");
    }
  });

  it("sends the expected body shape (name, phone_e164, source, bearer)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ lead_id: "x" }),
    } as Response);
    await syncLeadToPypes(lead);
    const call = fetchMock.mock.calls[0];
    const url = call[0] as string;
    const init = call[1] as RequestInit;
    expect(url).toBe("https://api.pypes.test/lamboapp/leads/capture");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-bearer",
    );
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      name: "Jane Doe",
      phone_e164: "+12125550199",
      source: "signup-page",
    });
  });
});
