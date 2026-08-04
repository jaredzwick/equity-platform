import { NextRequest, NextResponse } from "next/server";
import { callAsBuyer } from "@/lib/lamboapp-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/buyer/me/buy-box — save the buy-box editor form.
// Body shape mirrors the backend's lamboBuyerBuyBoxPatchInput.Body:
//   { industries, locations, origins, asking_price_min/max, revenue_min/max,
//     profit_min/max, sde_multiple_max, min_business_age_years }
// Proxies to pypes PATCH /lamboapp/buyers/me/buy-box.
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await callAsBuyer<unknown>({
    method: "PATCH",
    path: "/lamboapp/buyers/me/buy-box",
    body,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 200 });
}
