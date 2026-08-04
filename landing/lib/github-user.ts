import "server-only";

export type GitHubUser = {
  id: number;
  login: string;
  avatarUrl: string;
  name: string;
  email: string; // best-effort — see fetchUserEmail
};

// GET /user with a user access token. Used right after OAuth to cache
// identity in the session so we don't hit /user on every page load.
//
// email: /user returns the primary verified email when the App has the
// user:email (email.readonly) scope. When the primary is set to
// private on the profile, /user still returns null — fall back to
// /user/emails and pick the primary verified address. Returns empty
// string when neither call surfaces one; callers tolerate this so
// sign-in doesn't fail for private-email accounts.
export async function fetchUser(token: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GET /user → ${res.status}`);
  }
  const u = (await res.json()) as {
    id: number;
    login: string;
    avatar_url: string;
    name: string | null;
    email: string | null;
  };
  let email = u.email ?? "";
  if (!email) {
    email = await fetchUserEmail(token);
  }
  return {
    id: u.id,
    login: u.login,
    avatarUrl: u.avatar_url,
    name: u.name ?? "",
    email,
  };
}

// GET /user/emails — pick primary verified. Returns "" on any failure
// so a private-email account doesn't block sign-in; the backend will
// still create a buyer keyed on github_id.
async function fetchUserEmail(token: string): Promise<string> {
  try {
    const res = await fetch("https://api.github.com/user/emails", {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    });
    if (!res.ok) return "";
    const rows = (await res.json()) as Array<{
      email: string;
      primary: boolean;
      verified: boolean;
    }>;
    const primary = rows.find((r) => r.primary && r.verified) ?? rows.find((r) => r.verified);
    return primary?.email ?? "";
  } catch {
    return "";
  }
}
