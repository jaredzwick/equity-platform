// SERVER-ONLY. This file imports iron-session + GitHub API helpers. Client
// components should import from ./business-profile-schema instead (pure
// types + schema + path helpers).

import "server-only";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import { getFile, getFileSha, putFile, isConfigured } from "@/lib/github";
import { profilePath, type BusinessProfile } from "@/lib/business-profile-schema";

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

// ─── Git round-trip ──────────────────────────────────────────────────────

export async function loadProfile(slug: string): Promise<BusinessProfile | null> {
  if (!isConfigured()) return null;
  try {
    const file = await getFile(profilePath(slug));
    return file ? parseProfile(file.content) : null;
  } catch {
    return null;
  }
}

export async function saveProfile(slug: string, profile: BusinessProfile): Promise<{ commitSha: string }> {
  const path = profilePath(slug);
  const existingSha = await getFileSha(path);
  const commit = await putFile({
    path,
    content: serializeProfile(profile),
    message: existingSha
      ? `chore(${slug}): update business profile`
      : `feat(${slug}): initialize business profile`,
    sha: existingSha ?? undefined,
  });
  return { commitSha: commit.commitSha };
}
