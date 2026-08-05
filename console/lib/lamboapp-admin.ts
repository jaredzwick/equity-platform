// Server-only helper for hitting the pypes admin endpoints from console
// RSC + route handlers. Wraps the Authorization: Bearer <ADMIN_LAMBOAPP_TOKEN>
// header so page code doesn't touch the secret directly.

import "server-only";

const PYPES_API_URL =
  process.env.PYPES_API_URL ??
  process.env.NEXT_PUBLIC_PYPES_API_URL ??
  "https://api.pypes.dev";

function adminToken(): string {
  const t = process.env.ADMIN_LAMBOAPP_TOKEN ?? "";
  if (!t) {
    throw new Error(
      "ADMIN_LAMBOAPP_TOKEN not set — set the same value as pypes' env var",
    );
  }
  return t;
}

export type SellerListing = {
  deal_id: string;
  slug?: string;
  name: string;
  industry?: string;
  origin: string;
  location?: string;
  asking_price?: number;
  annual_revenue?: number;
  annual_profit?: number;
  thesis?: string;
  red_flags?: string[];
  published: boolean;
  paid_amount_cents?: number;
  published_at?: number;
  created_at: number;
  file_count: number;
  seller_id?: string;
  seller_email?: string;
  seller_phone?: string;
  ghl_contact_id?: string;
};

export async function listSellerListings(opts?: {
  limit?: number;
  onlyDrafts?: boolean;
}): Promise<SellerListing[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.onlyDrafts) params.set("only_drafts", "true");
  const url = `${PYPES_API_URL}/lamboapp/admin/seller-listings?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${adminToken()}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`pypes admin GET failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const body = (await res.json()) as { items: SellerListing[] };
  return body.items ?? [];
}

export async function unpublishSellerListing(
  dealID: string,
  reason: string,
): Promise<void> {
  const url = `${PYPES_API_URL}/lamboapp/admin/seller-listings/${encodeURIComponent(dealID)}/unpublish`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    throw new Error(`pypes admin unpublish failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
}
