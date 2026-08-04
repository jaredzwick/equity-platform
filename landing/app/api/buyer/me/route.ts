import { NextResponse } from "next/server";
import { callAsBuyer } from "@/lib/lamboapp-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/buyer/me — dashboard identity + buy_box + tier + 30d digest count.
// Proxies to pypes GET /lamboapp/buyers/me with the iron-session's github_id.
// Returns 401 when the caller isn't signed in.
export async function GET(): Promise<NextResponse> {
  const result = await callAsBuyer<unknown>({
    method: "GET",
    path: "/lamboapp/buyers/me",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: 200 });
}
