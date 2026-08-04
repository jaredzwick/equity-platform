import "server-only";

export type GitHubUser = {
  id: number;
  login: string;
  avatarUrl: string;
};

// GET /user with a user access token. Used right after OAuth to cache
// identity in the session so we don't hit /user on every page load.
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
  const u = (await res.json()) as { id: number; login: string; avatar_url: string };
  return { id: u.id, login: u.login, avatarUrl: u.avatar_url };
}
