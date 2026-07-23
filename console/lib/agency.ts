// SERVER-ONLY. Master agency config — one YAML file at agency.yaml in the
// platform repo. Loaded via GitHub raw + parsed by js-yaml; saved via
// GitHub Contents API. Same round-trip pattern as business profiles.

import "server-only";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import { authToken, getFileSha, putFile, resolveTargetRepo } from "@/lib/github";
import { AGENCY_PATH, type AgencyConfig } from "@/lib/agency-schema";

export {
  AGENCY_SCHEMA,
  AGENCY_PATH,
  getAtPath,
  setAtPath,
  type AgencyConfig,
  type Field,
  type Section,
  type FieldKind,
} from "@/lib/agency-schema";

export function serializeAgency(cfg: AgencyConfig): string {
  const header =
    "# Agency-level config — master org, shared across every tenant.\n" +
    "# Edited via /master/settings OR by hand + commit.\n" +
    "# Schema: console/lib/agency-schema.ts\n\n";
  return header + yamlDump(cfg, { sortKeys: false, lineWidth: 100, noRefs: true });
}

export function parseAgency(text: string): AgencyConfig {
  const parsed = yamlLoad(text);
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as AgencyConfig;
}

export async function loadAgency(): Promise<AgencyConfig | null> {
  let token: string;
  try {
    token = await authToken();
  } catch {
    return null;
  }
  const { owner, name, branch } = await resolveTargetRepo();
  const url = `https://raw.githubusercontent.com/${owner}/${name}/${branch}/${AGENCY_PATH}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub raw ${url} → ${res.status}`);
  const text = await res.text();
  return parseAgency(text);
}

export async function saveAgency(cfg: AgencyConfig): Promise<{ commitSha: string }> {
  const existingSha = await getFileSha(AGENCY_PATH);
  const commit = await putFile({
    path: AGENCY_PATH,
    content: serializeAgency(cfg),
    message: existingSha ? "chore(agency): update agency config" : "feat(agency): initialize agency config",
    sha: existingSha ?? undefined,
  });
  return { commitSha: commit.commitSha };
}
