import { NextResponse } from "next/server";
import { pollDeviceFlow, fetchUser } from "@/lib/github-oauth";
import { getSession } from "@/lib/session";

// POST /api/auth/poll — poll for the access token after the user enters the
// device code at github.com/login/device. Reads device_code from the session.

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  const deviceCode = (session as unknown as { deviceCode?: string }).deviceCode;
  if (!deviceCode) {
    return NextResponse.json(
      { status: "error", error: "no device flow in progress — call /api/auth/device first" },
      { status: 400 },
    );
  }

  try {
    const result = await pollDeviceFlow(deviceCode);
    if (result.status === "success") {
      // Fetch user identity to cache in the session.
      const user = await fetchUser(result.access_token);
      session.githubToken = result.access_token;
      session.login = user.login;
      session.avatarUrl = user.avatarUrl;
      (session as unknown as { deviceCode?: string }).deviceCode = undefined;
      await session.save();
      return NextResponse.json({ status: "success", login: user.login });
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", error: msg }, { status: 500 });
  }
}
