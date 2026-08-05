import { NextResponse } from "next/server";
import { ensureTenantStream } from "@/lib/nats-streams";

export const dynamic = "force-dynamic";

// POST /api/nats/ensure-stream
// Body: { slug: string }
// Idempotent — safe to call from the /events empty-state retry button.
export async function POST(req: Request): Promise<NextResponse> {
  let body: { slug?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(slug)) {
    return NextResponse.json({ ok: false, error: "invalid slug" }, { status: 400 });
  }
  const result = await ensureTenantStream(slug);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
