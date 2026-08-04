import { NextRequest, NextResponse } from "next/server";
import { callAsBuyer } from "@/lib/lamboapp-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/buyer/me/digest-history?limit=50&offset=0 — past deals sent.
// Proxies to pypes GET /lamboapp/buyers/me/digest-history.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const limitStr = url.searchParams.get("limit");
  const offsetStr = url.searchParams.get("offset");

  // Cap limit at the backend's max (200) so a malicious query param can't
  // provoke a 422 round-trip.
  const parsedLimit = Number(limitStr);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 50;
  const parsedOffset = Number(offsetStr);
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

  const result = await callAsBuyer<unknown>({
    method: "GET",
    path: "/lamboapp/buyers/me/digest-history",
    query: { limit, offset },
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 200 });
}
