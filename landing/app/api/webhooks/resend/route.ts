// POST /api/webhooks/resend  — the platform's single Resend webhook.
//
// Lives on landing (deployed to platform.pypes.dev via Vercel) rather than
// the console because the console requires a K8s cluster it can reach,
// which Vercel can't. Landing already has iron-session + a Node runtime;
// adding the ingest here means Resend has a stable public URL immediately.
//
// Tenant routing: every outbound email carries `tags:[{name:"tenant",
// value:"<slug>"}]` (enforced by console/lib/resend-send.ts). Resend echoes
// tags into webhook events; we read the tag and route to the right
// equity_email_<slug> Postgres. Zero per-tenant Resend UI setup.
//
// Signature verification: Svix format (Resend's webhook transport). The
// signature IS the trust boundary — no separate tenant existence check.

import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { insertEmailEvent, isEmailDbConfigured } from "@/lib/email-db";

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

  const tenantTag = payload.data?.tags?.find((t) => t.name === "tenant");
  const slug = tenantTag?.value;
  if (!slug) {
    return Response.json(
      { error: 'missing tenant tag — send emails with tags: [{name:"tenant", value:"<slug>"}]' },
      { status: 422 },
    );
  }
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(slug)) {
    return Response.json({ error: `invalid tenant slug: ${slug}` }, { status: 422 });
  }

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
// https://docs.svix.com/receiving/verifying-payloads/how-manual
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
