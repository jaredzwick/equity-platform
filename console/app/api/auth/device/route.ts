import { NextResponse } from "next/server";
import { startDeviceFlow } from "@/lib/github-oauth";
import { getSession } from "@/lib/session";

// POST /api/auth/device — kick off GitHub App device flow.
// Returns { user_code, verification_uri, interval, expires_in }.
// The device_code is stashed in the session so /api/auth/poll can read it
// without the client having to send it back.

export const runtime = "nodejs";

export async function POST() {
  try {
    const start = await startDeviceFlow();
    const session = await getSession();
    // Stash device_code in session temporarily — cleared after successful auth.
    (session as unknown as { deviceCode?: string }).deviceCode = start.device_code;
    await session.save();
    return NextResponse.json({
      user_code: start.user_code,
      verification_uri: start.verification_uri,
      interval: start.interval,
      expires_in: start.expires_in,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
