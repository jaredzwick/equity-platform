import "server-only";

// Signup leads store — name + phone from the landing /signup form.
//
// MVP: file-backed at landing/.leads.json (gitignored). Good enough for
// low-volume signups on a single Vercel deployment. Rotate to Postgres
// when volume warrants — the store interface stays stable.
//
// TODO (bigger scope): wire to the pypes backend as
//   POST /lamboapp/buyers/upsert-by-phone
// mirroring the existing upsert-by-github endpoint (see
// lib/lamboapp-backend.ts::upsertBuyerByGithub). That gives lead-to-buyer
// continuity, but requires a backend schema change (buyer PK by phone
// vs. github_id). Local file is the shippable MVP.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Resolves to <project-root>/.leads.json. process.cwd() during `next
// dev`/`next start` in the landing app is the landing directory itself.
function storePath(): string {
  return path.resolve(process.cwd(), ".leads.json");
}

export type Lead = {
  name: string;
  phone: string; // stored in E.164-ish normalized form (see normalizePhone)
  createdAt: string; // ISO
  source?: string; // where they came from on the site (hero, footer, /signup direct)
};

export type SubmitResult =
  | { ok: true; created: boolean }
  | { ok: false; error: string };

// Validation is conservative — we want anyone with a real US or intl
// number to succeed, but reject obviously malformed input. E.164 max is
// 15 digits; min useful (US mobile) is 10.
const PHONE_MIN = 10;
const PHONE_MAX = 15;

export function normalizePhone(raw: string): string | null {
  // Keep leading + then strip everything except digits.
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < PHONE_MIN || digits.length > PHONE_MAX) return null;
  // Normalize a bare US 10-digit number to +1XXXXXXXXXX so dedup works
  // regardless of how the user typed it.
  if (!hasPlus && digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

function validateName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2 || name.length > 100) return null;
  return name;
}

export async function submitLead(input: {
  name: string;
  phone: string;
  source?: string;
}): Promise<SubmitResult> {
  const name = validateName(input.name);
  if (!name) return { ok: false, error: "name must be 2–100 characters" };

  const phone = normalizePhone(input.phone);
  if (!phone) {
    return {
      ok: false,
      error: "phone must be a valid number (10–15 digits, US or international)",
    };
  }

  const existing = await loadAll();
  if (existing.some((l) => l.phone === phone)) {
    // Dedup on phone: same phone signing up twice is a no-op, not an
    // error — reduces friction if a user forgets they already opted in.
    return { ok: true, created: false };
  }

  const next: Lead = {
    name,
    phone,
    createdAt: new Date().toISOString(),
    source: input.source?.trim() || undefined,
  };
  await saveAll([...existing, next]);
  return { ok: true, created: true };
}

export async function listLeads(): Promise<Lead[]> {
  return loadAll();
}

async function loadAll(): Promise<Lead[]> {
  try {
    const raw = await readFile(storePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Lead[]) : [];
  } catch (e) {
    if (isNotFound(e)) return [];
    throw e;
  }
}

async function saveAll(leads: Lead[]): Promise<void> {
  const target = storePath();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(leads, null, 2) + "\n", "utf8");
}

function isNotFound(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "ENOENT"
  );
}
