import { KubeConfig, CoreV1Api, BatchV1Api, CustomObjectsApi } from "@kubernetes/client-node";
import type { V1CronJob, V1Job, V1Pod } from "@kubernetes/client-node";

let _kc: KubeConfig | null = null;

function kc(): KubeConfig {
  if (_kc) return _kc;
  const k = new KubeConfig();
  if (process.env.KUBERNETES_SERVICE_HOST) {
    k.loadFromCluster();
  } else {
    k.loadFromDefault();
  }
  _kc = k;
  return k;
}

export function core(): CoreV1Api {
  return kc().makeApiClient(CoreV1Api);
}

export function batch(): BatchV1Api {
  return kc().makeApiClient(BatchV1Api);
}

export function custom(): CustomObjectsApi {
  return kc().makeApiClient(CustomObjectsApi);
}

export type ArgoApp = {
  metadata: { name: string; namespace: string };
  spec: {
    destination: { namespace: string; server?: string };
    source?: { repoURL?: string; chart?: string; targetRevision?: string };
    sources?: Array<{ repoURL?: string; chart?: string; targetRevision?: string; ref?: string }>;
  };
  status?: {
    sync?: { status?: string; revision?: string };
    health?: { status?: string };
    operationState?: { phase?: string; message?: string; startedAt?: string };
  };
};

// Filter helper: undefined nsFilter = no filter (return everything).
// Empty array = filter matches nothing (return []).
function passesNs(ns: string | undefined, nsFilter?: string[]): boolean {
  if (!nsFilter) return true;
  if (nsFilter.length === 0) return false;
  return nsFilter.includes(ns ?? "");
}

export async function listArgoApps(nsFilter?: string[]): Promise<ArgoApp[]> {
  const res = await custom().listNamespacedCustomObject({
    group: "argoproj.io",
    version: "v1alpha1",
    namespace: "argocd",
    plural: "applications",
  });
  const body = res as { items?: ArgoApp[] };
  const items = body.items ?? [];
  // ArgoCD Apps live in the argocd namespace, but each has a
  // spec.destination.namespace pointing at where it deploys. Filter on THAT.
  if (!nsFilter) return items;
  return items.filter((a) => passesNs(a.spec.destination.namespace, nsFilter));
}

export type ArgoRootSource = {
  repoURL: string;
  targetRevision: string;
  path: string;
  syncStatus: string | null;
  healthStatus: string | null;
};

// Read the ArgoCD root Application (spec.source) — this is what the cluster
// is *actually* reconciling from. Used by the GitHub settings page to detect
// mismatches between the console's write target (user's fork) and ArgoCD's
// read target (whatever up.sh baked in).
export async function getArgoRootSource(): Promise<ArgoRootSource | null> {
  try {
    const res = await custom().getNamespacedCustomObject({
      group: "argoproj.io",
      version: "v1alpha1",
      namespace: "argocd",
      plural: "applications",
      name: "root",
    });
    const app = res as ArgoApp;
    const src = app.spec.source ?? app.spec.sources?.[0];
    if (!src?.repoURL) return null;
    return {
      repoURL: src.repoURL,
      targetRevision: src.targetRevision ?? "HEAD",
      path: (src as { path?: string }).path ?? "apps",
      syncStatus: app.status?.sync?.status ?? null,
      healthStatus: app.status?.health?.status ?? null,
    };
  } catch {
    return null;
  }
}

export type CronJobRow = {
  namespace: string;
  name: string;
  schedule: string;
  suspend: boolean;
  lastScheduleTime: string | null;
  lastSuccessfulTime: string | null;
  activeCount: number;
};

export async function listCronJobs(nsFilter?: string[]): Promise<CronJobRow[]> {
  const res = await batch().listCronJobForAllNamespaces();
  const items: V1CronJob[] = res.items ?? [];
  return items
    .filter((cj) => passesNs(cj.metadata?.namespace, nsFilter))
    .map((cj) => ({
      namespace: cj.metadata?.namespace ?? "",
      name: cj.metadata?.name ?? "",
      schedule: cj.spec?.schedule ?? "",
      suspend: !!cj.spec?.suspend,
      lastScheduleTime: cj.status?.lastScheduleTime
        ? new Date(cj.status.lastScheduleTime).toISOString()
        : null,
      lastSuccessfulTime: cj.status?.lastSuccessfulTime
        ? new Date(cj.status.lastSuccessfulTime).toISOString()
        : null,
      activeCount: cj.status?.active?.length ?? 0,
    }));
}

// ── Single CronJob + its recent runs (Jobs + Pods) ──────────────────────────

export type CronJobDetail = {
  namespace: string;
  name: string;
  schedule: string;
  concurrencyPolicy: string;
  suspend: boolean;
  labels: Record<string, string>;
  image: string | null;
  isRunner: boolean;      // convenience: labels["equity.io/runner"] === "claude"
  prompt: string | null;  // for runner mode, the PROMPT env value (null if not set)
};

export async function getCronJob(namespace: string, name: string): Promise<CronJobDetail | null> {
  const cj = await batch()
    .readNamespacedCronJob({ namespace, name })
    .catch(() => null);
  if (!cj) return null;
  const labels = cj.metadata?.labels ?? {};
  const container = cj.spec?.jobTemplate?.spec?.template?.spec?.containers?.[0];
  const env = container?.env ?? [];
  // For runner-mode crons we care about the PROMPT env value — that's the
  // natural-language spec the operator originally described.
  const promptEnv = env.find((e) => e.name === "PROMPT")?.value ?? null;
  return {
    namespace: cj.metadata?.namespace ?? namespace,
    name: cj.metadata?.name ?? name,
    schedule: cj.spec?.schedule ?? "",
    concurrencyPolicy: cj.spec?.concurrencyPolicy ?? "Allow",
    suspend: !!cj.spec?.suspend,
    labels,
    image: container?.image ?? null,
    isRunner: labels["equity.io/runner"] === "claude",
    prompt: promptEnv,
  };
}

export type CronRun = {
  jobName: string;
  podName: string | null;
  startedAt: string | null;      // ISO
  completedAt: string | null;    // ISO — null while running
  durationMs: number | null;
  status: "running" | "succeeded" | "failed" | "unknown";
  succeeded: number;
  failed: number;
  active: number;
};

// List recent Jobs for a given CronJob. k8s owner-references + a
// well-known label (`batch.kubernetes.io/cronjob-name`) tag every Job the
// CronJob controller creates; we filter on that label. Also fetches the
// Pod for each Job so callers can pull logs by pod name later.
export async function listCronJobRuns(
  namespace: string,
  cronName: string,
  limit = 10,
): Promise<CronRun[]> {
  const jobsRes = await batch().listNamespacedJob({
    namespace,
    labelSelector: `batch.kubernetes.io/cronjob-name=${cronName}`,
  });
  const jobs: V1Job[] = jobsRes.items ?? [];
  if (jobs.length === 0) return [];

  // Sort newest first by start time, then trim.
  const sorted = jobs
    .slice()
    .sort((a, b) => {
      const at = a.status?.startTime ? new Date(a.status.startTime).getTime() : 0;
      const bt = b.status?.startTime ? new Date(b.status.startTime).getTime() : 0;
      return bt - at;
    })
    .slice(0, limit);

  // Pods for each Job — one call per namespace, filter by owner Job name.
  // Cheaper than listing per-job when there are many jobs in the namespace,
  // but we scope by labelSelector so it's still narrow.
  const podsRes = await core().listNamespacedPod({
    namespace,
    labelSelector: `batch.kubernetes.io/cronjob-name=${cronName}`,
  });
  const pods: V1Pod[] = podsRes.items ?? [];
  const podByJobName = new Map<string, string>();
  for (const p of pods) {
    const jobName = p.metadata?.labels?.["batch.kubernetes.io/job-name"]
      ?? p.metadata?.labels?.["job-name"];
    if (jobName && p.metadata?.name && !podByJobName.has(jobName)) {
      podByJobName.set(jobName, p.metadata.name);
    }
  }

  return sorted.map((j) => {
    const jobName = j.metadata?.name ?? "";
    const startedAt = j.status?.startTime ? new Date(j.status.startTime).toISOString() : null;
    const completedAt = j.status?.completionTime
      ? new Date(j.status.completionTime).toISOString()
      : null;
    const succeeded = j.status?.succeeded ?? 0;
    const failed = j.status?.failed ?? 0;
    const active = j.status?.active ?? 0;
    let status: CronRun["status"] = "unknown";
    if (active > 0) status = "running";
    else if (succeeded > 0) status = "succeeded";
    else if (failed > 0) status = "failed";
    const durationMs = startedAt && completedAt
      ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
      : null;
    return {
      jobName,
      podName: podByJobName.get(jobName) ?? null,
      startedAt,
      completedAt,
      durationMs,
      status,
      succeeded,
      failed,
      active,
    };
  });
}

// Read a pod's stdout (tail last N lines). Wraps readNamespacedPodLog +
// coerces the k8s-client's odd return shape (V1PodLogOptions vs raw
// string depending on version) into a plain string.
export async function readPodLog(
  namespace: string,
  podName: string,
  tailLines = 500,
): Promise<string> {
  const res = await core().readNamespacedPodLog({
    name: podName,
    namespace,
    tailLines,
  });
  if (typeof res === "string") return res;
  // Some client-node versions return an object with .body containing the
  // string; handle both. Fall back to JSON.stringify so we never lose data.
  const withBody = res as { body?: string };
  if (typeof withBody?.body === "string") return withBody.body;
  return typeof res === "object" ? JSON.stringify(res, null, 2) : String(res);
}
