import { NextRequest, NextResponse } from "next/server";
import { submitLead, normalizePhone } from "@/lib/leads-store";
import { syncLeadInBackground } from "@/lib/pypes-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leads — capture a name+phone signup from the landing form.
// Idempotent on phone; dedup returns { ok: true, created: false }.
//
// On a successful CREATE (not dedup), fire-and-forget a proxy call to
// the pypes backend, which owns Postgres storage + GHL upsert +
// retry queue (matching careerjumpship_lead_capture.go's pattern).
// The response doesn't wait on the sync — signup UX must not block on
// backend availability.
//
// Not rate-limited today — MVP relies on the front-end form being the
// only public consumer. If we start seeing abuse in server logs, add
// an IP-based token bucket here (per-IP 5/min is usually enough).
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { name?: unknown; phone?: unknown; source?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const source = typeof body.source === "string" ? body.source : undefined;

  const result = await submitLead({ name, phone, source });

  // Only sync on brand-new leads. Dedup collisions (created=false) mean
  // the contact already exists — GHL's upsert would be a no-op too, but
  // skipping the network call keeps the sync signal clean.
  if (result.ok && result.created) {
    const normalized = normalizePhone(phone);
    if (normalized) {
      syncLeadInBackground({
        name: name.trim(),
        phone: normalized,
        source,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
