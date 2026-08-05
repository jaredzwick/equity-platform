import { NextResponse } from "next/server";
import { unpublishSellerListing } from "@/lib/lamboapp-admin";

// POST /api/listings/{id}/unpublish
//
// Server-side proxy: browser hits this route, this route holds the
// ADMIN_LAMBOAPP_TOKEN and forwards to pypes /lamboapp/admin/seller-
// listings/{id}/unpublish. Keeps the admin bearer off the client bundle.
//
// Body: {reason?: string}  — free-form takedown note logged on pypes.

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  let reason = "";
  try {
    const body = (await req.json()) as { reason?: string };
    reason = String(body?.reason ?? "");
  } catch {
    // no body / bad JSON is fine — reason is optional
  }
  try {
    await unpublishSellerListing(id, reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
