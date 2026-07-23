// GitHub App device flow — user-to-server token, no client secret needed.
//
// Docs: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app#using-the-device-flow-to-generate-a-user-access-token
//
// Flow:
//   1. POST /login/device/code with client_id → { device_code, user_code, verification_uri, interval }
//   2. Show user_code to user; they enter it at verification_uri
//   3. POST /login/oauth/access_token every `interval` seconds → { access_token } once user approves
//   4. Store access_token in session
//   5. Use it as `Authorization: Bearer <token>` on api.github.com calls

export type DeviceStart = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

export type DevicePollResult =
  | { status: "pending" }
  | { status: "slow_down"; interval: number }
  | { status: "success"; access_token: string; scope: string }
  | { status: "denied" | "expired" | "error"; error: string };

const CLIENT_ID_ENV = "GITHUB_APP_CLIENT_ID";

export function clientId(): string {
  const id = process.env[CLIENT_ID_ENV];
  if (!id) throw new Error(`${CLIENT_ID_ENV} not set — register the App and set this in .env.local`);
  return id;
}

export async function startDeviceFlow(): Promise<DeviceStart> {
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId() }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`device/code → ${res.status}: ${await res.text()}`);
  return (await res.json()) as DeviceStart;
}

export async function pollDeviceFlow(deviceCode: string): Promise<DevicePollResult> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId(),
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as {
    error?: string;
    error_description?: string;
    interval?: number;
    access_token?: string;
    scope?: string;
  };
  if (data.access_token) {
    return { status: "success", access_token: data.access_token, scope: data.scope ?? "" };
  }
  if (data.error === "authorization_pending") return { status: "pending" };
  if (data.error === "slow_down") return { status: "slow_down", interval: data.interval ?? 5 };
  if (data.error === "access_denied") return { status: "denied", error: data.error_description ?? data.error };
  if (data.error === "expired_token") return { status: "expired", error: data.error_description ?? data.error };
  return { status: "error", error: data.error_description ?? data.error ?? "unknown" };
}

// Get the user's login + avatar with an access token. Used to cache identity
// in the session and to render the "signed in as X" chip.
export async function fetchUser(token: string): Promise<{ login: string; avatarUrl: string }> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET /user → ${res.status}`);
  const u = (await res.json()) as { login: string; avatar_url: string };
  return { login: u.login, avatarUrl: u.avatar_url };
}
