import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

// Resend wrapper for the /join lead-magnet guide.
//
// Mirrors the pypes/infra/server/internal/mailer/mailer.go pattern: env-driven
// client, optional debug-BCC for send-mirroring, and a no-op fallback when the
// required env is unset so /api/leads never 500s in a dev env without email
// credentials. Env vars: RESEND_API_KEY, RESEND_FROM_EMAIL, GUIDE_DEBUG_BCC.
//
// Attaches the PDF from landing/public/guides/ so the recipient gets the file
// inline. The PDF also sits at /guides/<filename> for direct download on the
// thanks page; if you want the guide gated, move it out of public/ and serve
// it through a signed download route.
//
// OSS note: no personal email addresses are baked into this file. Every
// address is env-driven. Forks that don't set RESEND_FROM_EMAIL or
// GUIDE_DEBUG_BCC send from/BCC nothing — they never silently BCC the
// upstream author.

const GUIDE_FILENAME = "90-day-acquisition-playbook.pdf";
const GUIDE_SUBJECT =
  "Your 90-Day Business Acquisition Playbook is inside 📎";

let cachedGuideBase64: string | null = null;

async function loadGuideBase64(): Promise<string> {
  if (cachedGuideBase64) return cachedGuideBase64;
  const guidePath = path.resolve(
    process.cwd(),
    "public",
    "guides",
    GUIDE_FILENAME,
  );
  const buf = await readFile(guidePath);
  cachedGuideBase64 = buf.toString("base64");
  return cachedGuideBase64;
}

function parseDebugBcc(raw: string | undefined): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];
  return trimmed
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

function loadDebugBcc(): string[] {
  // OSS-safe default: unset means NO BCC. If you want a paper-trail mirror
  // for your own deployment, set GUIDE_DEBUG_BCC=you@example.com in env.
  // Comma-separated list is supported.
  return parseDebugBcc(process.env.GUIDE_DEBUG_BCC);
}

export type SendGuideInput = {
  to: string;
  name: string;
};

export type SendGuideResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendGuide(
  input: SendGuideInput,
): Promise<SendGuideResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      "[guide-mailer] RESEND_API_KEY not set — guide send skipped",
    );
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }

  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    console.warn(
      "[guide-mailer] RESEND_FROM_EMAIL not set — guide send skipped",
    );
    return { ok: false, error: "RESEND_FROM_EMAIL not configured" };
  }

  const client = new Resend(key);
  const bcc = loadDebugBcc();

  let pdfBase64: string;
  try {
    pdfBase64 = await loadGuideBase64();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[guide-mailer] failed to load guide PDF:", msg);
    return { ok: false, error: `guide PDF not found: ${msg}` };
  }

  const firstName = input.name.trim().split(/\s+/)[0] || "there";
  const html = renderGuideHtml(firstName);

  try {
    const res = await client.emails.send({
      from,
      to: [input.to],
      bcc: bcc.length > 0 ? bcc : undefined,
      subject: GUIDE_SUBJECT,
      html,
      attachments: [
        {
          filename: GUIDE_FILENAME,
          content: pdfBase64,
        },
      ],
    });
    if (res.error) {
      return { ok: false, error: res.error.message };
    }
    return { ok: true, id: res.data?.id ?? "" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[guide-mailer] send failed:", msg);
    return { ok: false, error: msg };
  }
}

// Fire-and-forget wrapper. Used from the /api/leads request path so the
// signup response doesn't wait on Resend — same pattern as
// syncLeadInBackground in lib/pypes-leads.ts.
export function sendGuideInBackground(input: SendGuideInput): void {
  sendGuide(input)
    .then((r) => {
      if (!r.ok) {
        console.warn("[guide-mailer] background send failed:", r.error);
      } else {
        console.info("[guide-mailer] guide sent", { id: r.id, to: input.to });
      }
    })
    .catch((e) => {
      console.error("[guide-mailer] background send threw:", e);
    });
}

function renderGuideHtml(firstName: string): string {
  // Kept plain and inline. Every major client (Gmail, Outlook, Apple Mail)
  // renders inline styles reliably; external stylesheets get stripped.
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b0b0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#e5e5e5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0e;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111114;border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 8px 32px;">
                <div style="font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.2em;text-transform:uppercase;color:#facc15;">
                  LamboApp · Free Guide
                </div>
                <h1 style="margin:12px 0 0 0;font-size:24px;line-height:1.25;color:#ffffff;font-weight:600;">
                  Hey ${escapeHtml(firstName)} — your playbook is attached.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 8px 32px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.78);">
                <p style="margin:0 0 12px 0;">
                  <strong style="color:#ffffff;">The 90-Day Business Acquisition Playbook</strong> is attached to this email as a PDF. Save it somewhere you'll actually read it tonight — the whole thing is designed to fit in one sitting.
                </p>
                <p style="margin:0 0 12px 0;">
                  Inside you'll find the credit stack self-funded searchers use, the 2-3 financing sources actually worth your time, the 90-day timeline week-by-week, and the questions to ask lenders + sellers that separate real deals from tire-kickers.
                </p>
                <p style="margin:0 0 12px 0;">
                  If it saves you one bad LOI, it's done its job.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;">
                <a
                  href="https://www.lamboapp.com/deals"
                  style="display:inline-block;background:linear-gradient(90deg,#facc15,#f97316,#ef4444);color:#000;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;text-decoration:none;padding:14px 24px;border-radius:8px;font-size:14px;"
                >
                  See today's scored deals →
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);font-size:12px;line-height:1.6;color:rgba(255,255,255,0.5);">
                <p style="margin:0 0 4px 0;">
                  — Jared Zwick, LamboApp
                </p>
                <p style="margin:0;">
                  Nothing in this guide is financial, legal, or tax advice. Consult a licensed SBA lender, CPA, and M&amp;A attorney before signing any LOI.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
