import { KubeConfig, CoreV1Api, BatchV1Api, CustomObjectsApi } from "@kubernetes/client-node";
import type { V1CronJob } from "@kubernetes/client-node";

let _kc: KubeConfig | null = null;

function kc(): KubeConfig {
  if (_kc) return _kc;
  const k = new KubeConfig();
  // In-cluster (Pod): loads /var/run/secrets/kubernetes.io/serviceaccount tokens.
  // Local dev: loads ~/.kube/config for the current context.
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

// ArgoCD Applications live in argoproj.io/v1alpha1 as a CRD. We read them via
// the custom-objects API so we don't need to codegen the ArgoCD types.
export type ArgoApp = {
  metadata: { name: string; namespace: string };
  spec: { destination: { namespace: string }; source?: { repoURL?: string } };
  status?: {
    sync?: { status?: string };
    health?: { status?: string };
    operationState?: { phase?: string; message?: string; startedAt?: string };
  };
};

export async function listArgoApps(): Promise<ArgoApp[]> {
  const res = await custom().listNamespacedCustomObject(
    "argoproj.io",
    "v1alpha1",
    "argocd",
    "applications",
  );
  const body = res.body as { items?: ArgoApp[] };
  return body.items ?? [];
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

export async function listCronJobs(): Promise<CronJobRow[]> {
  const res = await batch().listCronJobForAllNamespaces();
  const items: V1CronJob[] = res.body.items ?? [];
  return items.map((cj) => ({
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
