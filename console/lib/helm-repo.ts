import { load as yamlLoad } from "js-yaml";

// Helm repos publish an index.yaml at their root that enumerates every chart
// and every version. Fetching it lets us answer "is this pinned version still
// available upstream?" — which is the difference between "install writes 2
// files to git" and "install writes 2 files to git and then ArgoCD errors
// silently 30 seconds later."
//
// Cached by Next.js's fetch cache with a 1-hour revalidate. Multiple template
// picker loads within an hour hit the cache; the first load after cache expiry
// eats the fetch latency.
//
// Fail-open: if the repo is unreachable, if the response isn't valid YAML, or
// if the chart isn't listed at all, we return "unknown" rather than blocking
// the user. A false negative (repo down but the version is really fine) hurts
// less than a false positive (blocking a good install because a chart mirror
// happens to be flaky).

const INDEX_TTL_SECONDS = 3600; // 1 hour

// Cap the response size we'll parse. Bitnami's index is ~2 MB. Anything an
// order of magnitude larger is probably a bad URL or a hostile response.
const MAX_INDEX_BYTES = 32 * 1024 * 1024; // 32 MB

// Per-fetch timeout. Helm index responses from a CDN are typically <1 s; a
// slow mirror shouldn't hang the picker page for a whole minute.
const FETCH_TIMEOUT_MS = 5000;

export type Availability =
  | { status: "available"; availableVersions: string[]; latestVersion: string }
  | { status: "yanked"; availableVersions: string[]; latestVersion: string }
  | { status: "unknown"; reason: string };

type HelmIndex = {
  entries?: Record<string, Array<{ version?: string }>>;
};

function indexUrlFor(repoUrl: string): string {
  return repoUrl.replace(/\/+$/, "") + "/index.yaml";
}

// Newest-first semver-ish sort. Helm chart versions are semver by convention;
// a lexicographic fallback keeps non-semver charts (rare) from crashing.
function sortNewestFirst(versions: string[]): string[] {
  return [...versions].sort((a, b) => {
    const pa = parseVersion(a);
    const pb = parseVersion(b);
    if (pa && pb) {
      if (pa[0] !== pb[0]) return pb[0] - pa[0];
      if (pa[1] !== pb[1]) return pb[1] - pa[1];
      if (pa[2] !== pb[2]) return pb[2] - pa[2];
      return b.localeCompare(a);
    }
    return b.localeCompare(a);
  });
}

function parseVersion(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

async function fetchIndex(repoUrl: string): Promise<
  | { ok: true; text: string }
  | { ok: false; reason: string }
> {
  const url = indexUrlFor(repoUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Next.js fetch cache: hourly revalidate.
      next: { revalidate: INDEX_TTL_SECONDS },
      // Keep the header polite so mirrors don't rate-limit us.
      headers: { "user-agent": "equity-platform-console/1.0 (+helm-index-check)" },
    });
    if (!res.ok) {
      return { ok: false, reason: `HTTP ${res.status} from ${url}` };
    }
    // Guard against a huge or streaming body: read as text but with a size cap.
    const len = Number(res.headers.get("content-length") ?? "0");
    if (len > MAX_INDEX_BYTES) {
      return { ok: false, reason: `index too large (${len} bytes)` };
    }
    const text = await res.text();
    if (text.length > MAX_INDEX_BYTES) {
      return { ok: false, reason: `index too large after read` };
    }
    return { ok: true, text };
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "AbortError"
        ? `timeout after ${FETCH_TIMEOUT_MS}ms`
        : e instanceof Error
        ? e.message
        : String(e);
    return { ok: false, reason: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function getChartAvailability(
  repoUrl: string,
  chartName: string,
  pinnedVersion: string,
): Promise<Availability> {
  const fetched = await fetchIndex(repoUrl);
  if (!fetched.ok) {
    return { status: "unknown", reason: fetched.reason };
  }
  let index: HelmIndex;
  try {
    index = yamlLoad(fetched.text) as HelmIndex;
  } catch (e) {
    return {
      status: "unknown",
      reason: `index.yaml parse error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  const entries = index?.entries?.[chartName];
  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return {
      status: "unknown",
      reason: `chart "${chartName}" not listed in ${repoUrl}`,
    };
  }
  const versions = entries
    .map((e) => (typeof e?.version === "string" ? e.version : null))
    .filter((v): v is string => !!v);
  if (versions.length === 0) {
    return {
      status: "unknown",
      reason: `no valid versions listed for "${chartName}"`,
    };
  }
  const sorted = sortNewestFirst(versions);
  const latest = sorted[0];
  const status = versions.includes(pinnedVersion) ? "available" : "yanked";
  return { status, availableVersions: sorted, latestVersion: latest };
}

// Fetch availability for many chart pins in parallel; suitable for the picker
// which resolves ~10 templates at page-render time.
export async function getManyChartAvailabilities<T extends { chartRepo: string; chartName: string; chartVersion: string }>(
  templates: readonly T[],
): Promise<Map<string, Availability>> {
  const results = await Promise.all(
    templates.map(async (t) => {
      const key = `${t.chartRepo}|${t.chartName}|${t.chartVersion}`;
      const availability = await getChartAvailability(t.chartRepo, t.chartName, t.chartVersion);
      return [key, availability] as const;
    }),
  );
  return new Map(results);
}

export function availabilityKey(t: {
  chartRepo: string;
  chartName: string;
  chartVersion: string;
}): string {
  return `${t.chartRepo}|${t.chartName}|${t.chartVersion}`;
}
