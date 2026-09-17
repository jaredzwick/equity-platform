// SERVER-ONLY. This file imports iron-session + GitHub API helpers. Client
// components should import from ./business-profile-schema instead (pure
// types + schema + path helpers).

import "server-only";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import { getFile, getFileSha, putFile, isConfigured } from "@/lib/github";
import { profilePath, type BusinessProfile } from "@/lib/business-profile-schema";
import { readStateFile, writeStateFile } from "@/lib/local-state";

// Relative path within EQUITY_STATE_DIR. Mirrors the git layout so the
// mental model is identical: businesses/<slug>.yaml.
function localProfilePath(slug: string): string {
  return `profiles/${slug}.yaml`;
}

// Re-export the client-safe surface so existing server-side call sites can
// keep importing from this file.
export {
  PROFILE_SCHEMA,
  getAtPath,
  setAtPath,
  profilePath,
  type BusinessProfile,
  type Field,
  type FieldKind,
  type Section,
} from "@/lib/business-profile-schema";

// ─── YAML round-trip ──────────────────────────────────────────────────────

export function serializeProfile(profile: BusinessProfile): string {
  const header =
    "# Business profile — declarative source of truth for this tenant.\n" +
    "# Edited via console/[tenant]/profile OR by hand + commit.\n" +
    "# Schema: console/lib/business-profile-schema.ts\n\n";
  return header + yamlDump(profile, { sortKeys: false, lineWidth: 100, noRefs: true });
}

export function parseProfile(text: string): BusinessProfile {
  const parsed = yamlLoad(text);
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as BusinessProfile;
}

// ─── Persistence ──────────────────────────────────────────────────────────
// Local file is primary; git is opt-in async backup. A busted GitHub session
// therefore never blocks a profile save. When both are configured and both
// succeed, saveProfile returns a commit SHA so the UI can link to it.

export type SaveResult = {
  saved: true;
  gitCommitSha: string | null;
  gitError: string | null;
};

export async function loadProfile(slug: string): Promise<BusinessProfile | null> {
  // Prefer local file — it's the authoritative store. Fall back to git so
  // that operators who used to save via git still see their profile the
  // first time they land here after the flip. First successful local save
  // makes the git copy stale (drift acceptable — git is backup, not source).
  const local = await readStateFile(localProfilePath(slug));
  if (local != null) return parseProfile(local);
  if (await isConfigured()) {
    try {
      const file = await getFile(profilePath(slug));
      return file ? parseProfile(file.content) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export async function saveProfile(slug: string, profile: BusinessProfile): Promise<SaveResult> {
  const serialized = serializeProfile(profile);
  // Local write MUST succeed or the caller sees the error — this is the
  // primary store. Failures here are filesystem-level (permissions, disk).
  await writeStateFile(localProfilePath(slug), serialized);

  // Git backup: best-effort. Any failure (401 from busted OAuth, 404 from
  // uninstalled App, network) is captured and returned but does NOT throw.
  // The console can surface a warning banner while the profile is safe.
  let gitCommitSha: string | null = null;
  let gitError: string | null = null;
  if (await isConfigured()) {
    try {
      const path = profilePath(slug);
      const existingSha = await getFileSha(path);
      const commit = await putFile({
        path,
        content: serialized,
        message: existingSha
          ? `chore(${slug}): update business profile`
          : `feat(${slug}): initialize business profile`,
        sha: existingSha ?? undefined,
      });
      gitCommitSha = commit.commitSha;
    } catch (e) {
      gitError = e instanceof Error ? e.message : String(e);
    }
  }
  return { saved: true, gitCommitSha, gitError };
}
