import { NextResponse } from "next/server";
import { peekStream } from "@/lib/nats-peek";

export const dynamic = "force-dynamic";

// POST /api/nats/peek
// Body: { stream: string, count?: number }
// Returns: { ok: boolean, messages: [...], error?: string }
export async function POST(req: Request): Promise<NextResponse> {
  let body: { stream?: unknown; count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, messages: [], error: "invalid JSON" }, { status: 400 });
  }
  const stream = typeof body.stream === "string" ? body.stream : "";
  const count = typeof body.count === "number" ? body.count : 10;
  if (!stream) {
    return NextResponse.json({ ok: false, messages: [], error: "stream required" }, { status: 400 });
  }
  const result = await peekStream(stream, count);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
