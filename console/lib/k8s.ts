import { KubeConfig, CoreV1Api, BatchV1Api, CustomObjectsApi } from "@kubernetes/client-node";
import type { V1CronJob } from "@kubernetes/client-node";

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
  const res = await custom().listNamespacedCustomObject(
    "argoproj.io",
    "v1alpha1",
    "argocd",
    "applications",
  );
  const body = res.body as { items?: ArgoApp[] };
  const items = body.items ?? [];
  // ArgoCD Apps live in the argocd namespace, but each has a
  // spec.destination.namespace pointing at where it deploys. Filter on THAT.
  if (!nsFilter) return items;
  return items.filter((a) => passesNs(a.spec.destination.namespace, nsFilter));
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
  const items: V1CronJob[] = res.body.items ?? [];
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
