// GET /api/auth/github/install-callback
//
// The GitHub App redirects here after the user finishes installing (or
// updating) the App on a repo/org. GitHub appends:
//   ?code=<user-to-server code>&installation_id=<N>&setup_action=install|update
//
// We don't need to do anything with the code here — the console's device-
// flow login (kicked off from the sidebar) is what mints the session
// token. The installation itself already grants the App server-to-server
// access to the fork. Job of this route: acknowledge, then send the
// operator back to the GitHub tab so they see the "App installed" state.
//
// Set the App's "Setup URL" to https://<your-console-host>/api/auth/github/install-callback
// (locally: http://localhost:3030/api/auth/github/install-callback).

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const installationId = url.searchParams.get("installation_id") ?? "";
  const setupAction = url.searchParams.get("setup_action") ?? "install";

  const dest = new URL("/master/github", url.origin);
  dest.searchParams.set("installed", "1");
  if (installationId) dest.searchParams.set("installation_id", installationId);
  dest.searchParams.set("setup_action", setupAction);
  return NextResponse.redirect(dest);
}
