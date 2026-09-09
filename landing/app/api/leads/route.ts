import { NextRequest, NextResponse } from "next/server";
import { submitLead, normalizePhone } from "@/lib/leads-store";
import { syncLeadInBackground } from "@/lib/pypes-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leads — capture a name+phone signup from the landing form.
// Idempotent on phone; dedup returns { ok: true, created: false }.
//
// On a successful CREATE (not dedup), fire-and-forget a proxy call to
// the pypes backend, which owns Postgres storage + GHL upsert + PDF
// playbook delivery for /join lead-magnet opt-ins. The response doesn't
// wait on the sync — signup UX must not block on backend availability.
//
// The /join lead-magnet PDF send lives in pypes (lamboapp_join_delivery.go),
// not here. Landing forwards the email in the sync payload and the pypes
// handler dispatches a fire-and-forget goroutine when source starts with
// "join-guide" and email is present. Single Resend surface, single key
// rotation. See CEO plan 2026-09-08.
//
// Not rate-limited today — MVP relies on the front-end form being the
// only public consumer. If we start seeing abuse in server logs, add
// an IP-based token bucket here (per-IP 5/min is usually enough).
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let body: {
      name?: unknown;
      phone?: unknown;
      email?: unknown;
      source?: unknown;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name : "";
    const phone = typeof body.phone === "string" ? body.phone : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const source = typeof body.source === "string" ? body.source : undefined;

    const result = await submitLead({ name, phone, source });

    // Sync on brand-new leads (created=true) so pypes owns Postgres + GHL
    // upsert. Also sync on /join-guide dedup replays so the pypes handler
    // can re-dispatch the fire-and-forget playbook PDF — a resubmit is
    // usually the user recovering from a lost first email, and the guide
    // re-send costs less than a support ticket. For every other funnel
    // (created=false + non-join-guide source), skip the sync call since
    // GHL's upsert would be a no-op anyway and we prefer clean sync logs.
    if (result.ok) {
      const normalized = normalizePhone(phone);
      const isJoinGuide =
        typeof source === "string" && source.startsWith("join-guide");
      if (normalized && (result.created || isJoinGuide)) {
        syncLeadInBackground(
          {
            name: name.trim(),
            phone: normalized,
            source,
            createdAt: new Date().toISOString(),
          },
          // Email piggybacks on the sync payload but isn't stored on the
          // local Lead audit record. GHL gets it via ContactInput.Email
          // and the pypes handler uses it to trigger the /join playbook PDF.
          email && /.+@.+\..+/.test(email) ? { email } : undefined,
        );
      }
    }

    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (e) {
    // Belt-and-suspenders: any unexpected throw becomes a JSON error the
    // client can render, not an empty-body 500 that crashes res.json().
    console.error("[/api/leads] unexpected:", e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "internal server error",
      },
      { status: 500 },
    );
  }
}
