import "server-only";

// Landing signup → pypes backend proxy. Server-side sync only; the
// backend at api.pypes.dev owns Postgres storage + GHL upsert + retry
// queue, matching the pattern in careerjumpship_lead_capture.go and
// lamboapp buyer/seller flows.
//
// Landing's job is:
//   1. Validate + local-file the lead (in leads-store.ts).
//   2. Fire-and-forget a proxy call to the pypes /lamboapp/leads/capture
//      endpoint. Backend does DB + GHL.
//
// Required backend endpoint (Go, in pypes/infra/server):
//   POST /lamboapp/leads/capture
//   Headers: Authorization: Bearer <LAMBOAPP_BACKEND_BEARER>
//   Body: { name, phone_e164, email?, source }
//   Returns: { lead_id, ghl_contact_id, ghl_status }
//   Pattern reference: careerjumpship_lead_capture.go (email-based,
//   same shape modulo the phone-first key).
//
// email is optional — only sent by funnels that ask for it (currently
// the /join lead-magnet, which needs an inbox for the PDF delivery).
// It's not persisted to the local .leads.json audit file — that stays
// name+phone only. Email lives in Resend (send log) + GHL (CRM), which
// are the two systems that actually need it.
//
// If the endpoint is 404 (not deployed yet), we log a clear "backend
// endpoint missing" warning and continue — the local .leads.json
// still has the lead, and backfill is trivial once the endpoint ships.
// This keeps signup UX green while backend catches up.

import type { Lead } from "@/lib/leads-store";
import { pypesApiUrl, lamboappBackendBearer } from "@/lib/env";

export type PypesLeadSyncStatus =
  | { status: "disabled"; reason: string }
  | { status: "ok"; leadId: string; ghlContactId?: string; ghlStatus?: string }
  | { status: "endpoint_missing"; url: string }
  | { status: "error"; error: string };

// Fire-and-forget wrapper. Safe to `void` from the API route. Logs
// every terminal outcome to server console/Vercel logs but never throws.
//
// extras carries per-funnel optional fields that don't belong on the
// Lead audit record (email today, others later). Keeps the local
// .leads.json shape stable while still letting the backend + GHL sync
// receive the extra fields when the funnel provides them.
export function syncLeadInBackground(
  lead: Lead,
  extras?: { email?: string },
): void {
  syncLeadToPypes(lead, extras).then(
    (result) => {
      switch (result.status) {
        case "disabled":
          console.log("[pypes-leads] disabled:", result.reason);
          return;
        case "endpoint_missing":
          console.warn(
            `[pypes-leads] backend endpoint not deployed (${result.url}). ` +
              `Lead in local .leads.json only. Deploy the handler documented ` +
              `in landing/lib/pypes-leads.ts and this will auto-sync.`,
          );
          return;
        case "ok":
          console.log(
            `[pypes-leads] synced lead=${result.leadId} ghl=${result.ghlContactId ?? "-"} status=${result.ghlStatus ?? "-"}`,
          );
          return;
        case "error":
          console.error("[pypes-leads] failed:", result.error, "phone=", lead.phone);
          return;
      }
    },
    (err) => console.error("[pypes-leads] unhandled:", err),
  );
}

// Awaitable version — for tests and callers that need the result.
export async function syncLeadToPypes(
  lead: Lead,
  extras?: { email?: string },
): Promise<PypesLeadSyncStatus> {
  let bearer: string;
  try {
    bearer = lamboappBackendBearer();
  } catch {
    return {
      status: "disabled",
      reason: "LAMBOAPP_BACKEND_BEARER not set",
    };
  }

  const url = `${pypesApiUrl()}/lamboapp/leads/capture`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: lead.name,
        phone_e164: lead.phone,
        source: lead.source ?? "lamboapp-landing",
        // Only send email when provided. The backend accepts omit-empty;
        // sending "" trips the 422 email-must-be-valid validator.
        ...(extras?.email && extras.email.trim()
          ? { email: extras.email.trim() }
          : {}),
      }),
    });
  } catch (e) {
    return {
      status: "error",
      error: e instanceof Error ? e.message : String(e),
    };
  }

  // 404 = the backend endpoint isn't deployed yet. Treat specially so
  // it shows up as a clear "wire up the backend" prompt in logs rather
  // than blending into generic errors.
  if (res.status === 404) return { status: "endpoint_missing", url };

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { detail?: string; title?: string };
      msg = `${msg}: ${j.detail ?? j.title ?? ""}`.trim();
    } catch {
      // non-JSON body — keep status code.
    }
    return { status: "error", error: msg };
  }

  const parsed = (await res.json().catch(() => ({}))) as {
    lead_id?: string;
    ghl_contact_id?: string;
    ghl_status?: string;
  };
  return {
    status: "ok",
    leadId: parsed.lead_id ?? "unknown",
    ghlContactId: parsed.ghl_contact_id,
    ghlStatus: parsed.ghl_status,
  };
}
