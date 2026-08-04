// Outbound email helper — the ONE way any tenant should send email.
//
// Why route through here: every email must carry a `tenant` tag so the
// shared /api/webhooks/resend endpoint can route delivery events back to
// the right per-tenant email_events DB. Bypassing this helper means events
// land nowhere and the deliverability dashboard is silently blind.

import "server-only";

const RESEND_API = "https://api.resend.com";

export type SendEmailArgs = {
  tenant: string;               // required — slug from lib/tenants
  from: string;                 // "Name <hello@example.com>"
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  reply_to?: string;
  template_id?: string;         // free-form label, echoed into the webhook payload
  tags?: Array<{ name: string; value: string }>;
  headers?: Record<string, string>;
};

export type SendResult = { id: string };

/**
 * Send an email via Resend, tagged with the tenant slug so its webhook
 * events auto-route to the right per-tenant DB.
 *
 * Uses RESEND_API_KEY from env. Throws with the Resend API error body on
 * non-2xx responses — callers should surface, not swallow.
 */
export async function sendEmail(args: SendEmailArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  if (!args.tenant) throw new Error("sendEmail: tenant is required");

  const tags: Array<{ name: string; value: string }> = [
    { name: "tenant", value: args.tenant },
    ...(args.template_id ? [{ name: "template_id", value: args.template_id }] : []),
    ...(args.tags ?? []),
  ];

  const body = {
    from: args.from,
    to: Array.isArray(args.to) ? args.to : [args.to],
    subject: args.subject,
    html: args.html,
    text: args.text,
    reply_to: args.reply_to,
    tags,
    headers: args.headers,
  };

  const res = await fetch(`${RESEND_API}/emails`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend ${res.status}: ${errBody.slice(0, 400)}`);
  }
  return (await res.json()) as SendResult;
}
