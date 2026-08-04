// POST /api/webhooks/resend  — ONE shared Resend webhook endpoint.
//
// Ideology: no per-tenant Resend UI setup. Tenant routing comes from the
// email's own tags, which Resend echoes into the webhook payload. Every
// outbound email in this platform MUST carry:
//
//   tags: [{ name: "tenant", value: "<slug>" }]
//
// See lib/resend-send.ts for the send-side helper that auto-adds it.
//
// Signing: single RESEND_WEBHOOK_SECRET covers every tenant. Set once in
// console/.env.local (or the platform's ExternalSecret in-cluster).

import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { insertEmailEvent, isEmailDbConfigured } from "@/lib/email-db";
import { resolveTenant } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResendPayload = {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[] | string;
    subject?: string;
    tags?: Array<{ name: string; value: string }>;
    [k: string]: unknown;
  };
};

export async function POST(req: NextRequest) {
  if (!isEmailDbConfigured()) {
    return Response.json({ error: "Email DB not configured" }, { status: 503 });
  }

  const raw = await req.text();

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const svixId = req.headers.get("svix-id");
    const svixTs = req.headers.get("svix-timestamp");
    const svixSig = req.headers.get("svix-signature");
    if (!svixId || !svixTs || !svixSig) {
      return Response.json({ error: "missing svix headers" }, { status: 401 });
    }
    if (!verifySvix(secret, svixId, svixTs, svixSig, raw)) {
      return Response.json({ error: "invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "RESEND_WEBHOOK_SECRET not set" }, { status: 503 });
  }

  let payload: ResendPayload;
  try {
    payload = JSON.parse(raw) as ResendPayload;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  // Route by the "tenant" tag on the email. Emails sent WITHOUT this tag
  // can't be attributed and are dropped with a 422 — surfaces bugs in the
  // send-side helper instead of silently swallowing events.
  const tenantTag = payload.data?.tags?.find((t) => t.name === "tenant");
  const slug = tenantTag?.value;
  if (!slug) {
    return Response.json(
      { error: 'missing tenant tag — send emails with tags: [{name:"tenant", value:"<slug>"}]' },
      { status: 422 },
    );
  }
  const t = await resolveTenant(slug);
  if (!t) return Response.json({ error: `unknown tenant tag: ${slug}` }, { status: 404 });

  const to = Array.isArray(payload.data?.to) ? payload.data.to[0] : payload.data?.to;
  const templateTag = payload.data?.tags?.find(
    (tg) => tg.name === "template_id" || tg.name === "template",
  );

  try {
    await insertEmailEvent(slug, {
      event_type: payload.type,
      email_id: payload.data?.email_id ?? "unknown",
      to_addr: to ?? "unknown",
      from_addr: payload.data?.from ?? "unknown",
      subject: payload.data?.subject ?? null,
      template_id: templateTag?.value ?? null,
      metadata: payload.data as Record<string, unknown>,
      created_at: payload.created_at ? new Date(payload.created_at) : new Date(),
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[resend-webhook] insert failed:", e);
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// Svix signature format: `v1,<base64-hmac>` (space-separated for multiple).
// See https://docs.svix.com/receiving/verifying-payloads/how-manual
function verifySvix(
  secret: string,
  svixId: string,
  svixTs: string,
  svixSig: string,
  body: string,
): boolean {
  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice(6), "base64")
    : Buffer.from(secret);
  const signed = `${svixId}.${svixTs}.${body}`;
  const expected = createHmac("sha256", key).update(signed).digest("base64");
  const provided = svixSig
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("v1,"))
    .map((s) => s.slice(3));
  const want = Buffer.from(expected);
  return provided.some((p) => {
    const got = Buffer.from(p);
    return got.length === want.length && timingSafeEqual(got, want);
  });
}
