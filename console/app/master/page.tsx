import { discoverTenants, type Tenant } from "@/lib/tenants";
import { listArgoApps, listCronJobs } from "@/lib/k8s";
import MasterView from "./MasterView";

export const dynamic = "force-dynamic";

export type BusinessSummary = {
  slug: string;
  name: string;
  namespaces: string[];
  apps: { total: number; healthy: number; synced: number };
  crons: { total: number; stale: number; suspended: number };
};

async function summarize(t: Tenant): Promise<BusinessSummary> {
  const [apps, crons] = await Promise.all([
    listArgoApps(t.namespaces).catch(() => []),
    listCronJobs(t.namespaces).catch(() => []),
  ]);
  const staleCutoff = Date.now() - 24 * 60 * 60 * 1000;
  return {
    slug: t.slug,
    name: t.name,
    namespaces: t.namespaces,
    apps: {
      total: apps.length,
      healthy: apps.filter((a) => a.status?.health?.status === "Healthy").length,
      synced: apps.filter((a) => a.status?.sync?.status === "Synced").length,
    },
    crons: {
      total: crons.length,
      stale: crons.filter((c) => !c.suspend && (!c.lastSuccessfulTime || new Date(c.lastSuccessfulTime).getTime() < staleCutoff)).length,
      suspended: crons.filter((c) => c.suspend).length,
    },
  };
}

export default async function MasterPage() {
  const tenants = await discoverTenants().catch(() => []);
  const businesses = await Promise.all(tenants.map(summarize));
  return <MasterView businesses={businesses} />;
}
