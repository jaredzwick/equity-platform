import { loadAll as yamlLoadAll } from "js-yaml";
import { core } from "@/lib/k8s";
import { getFile } from "@/lib/github";

// A tenant (business) is discovered by scanning cluster namespaces for the
// label `equity.io/tenant`. The label value is the slug used in URLs; the
// display name comes from `equity.io/tenant-name` (falls back to the slug).
//
// A tenant may own MULTIPLE namespaces later (e.g., acme-prod + acme-staging).
// For now: one namespace per tenant. `namespaces` is a list so the model is
// future-proof.

export type Tenant = {
  slug: string;             // "acme"
  name: string;             // "Acme"
  namespaces: string[];     // ["acme-prod"]
};

export const MASTER_SLUG = "master";
export const MASTER: Tenant = {
  slug: MASTER_SLUG,
  name: "All businesses",
  namespaces: [],           // sentinel: means "all tenant namespaces"
};

export async function discoverTenants(): Promise<Tenant[]> {
  const res = await core().listNamespace({
    labelSelector: "equity.io/tenant",
  });
  const byslug = new Map<string, Tenant>();
  for (const ns of res.items ?? []) {
    const slug = ns.metadata?.labels?.["equity.io/tenant"];
    if (!slug) continue;
    const name = ns.metadata?.labels?.["equity.io/tenant-name"] ?? slug;
    const nsName = ns.metadata?.name ?? "";
    if (!nsName) continue;
    const existing = byslug.get(slug);
    if (existing) {
      existing.namespaces.push(nsName);
    } else {
      byslug.set(slug, { slug, name, namespaces: [nsName] });
    }
  }
  return Array.from(byslug.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Resolve a tenant slug from a URL param. `master` returns the sentinel.
// Anything else must exist in the discovered set or we return null.
export async function resolveTenant(slug: string): Promise<Tenant | null> {
  if (slug === MASTER_SLUG) {
    const all = await discoverTenants();
    return { ...MASTER, namespaces: all.flatMap((t) => t.namespaces) };
  }
  const all = await discoverTenants();
  return all.find((t) => t.slug === slug) ?? null;
}

// Namespace filter to pass into k8s list calls. Empty array = "no filter"
// (used by MASTER when there are zero tenants — return nothing to avoid
// leaking platform namespace resources).
export function nsFilterFor(tenant: Tenant): string[] {
  return tenant.namespaces;
}

// Parse bootstrap/00-namespaces.yaml from the connected fork and return
// every business declared there (any namespace carrying equity.io/tenant).
// Returns null if we can't fetch the file (unauth, 404, network) so callers
// can distinguish "no repo access" from "repo has zero businesses".
const BOOTSTRAP_NAMESPACES_PATH = "bootstrap/00-namespaces.yaml";

type NamespaceDoc = {
  kind?: string;
  metadata?: {
    name?: string;
    labels?: Record<string, string>;
  };
};

export async function discoverTenantsFromRepo(): Promise<Tenant[] | null> {
  let file: { content: string } | null = null;
  try {
    file = await getFile(BOOTSTRAP_NAMESPACES_PATH);
  } catch {
    return null;
  }
  if (!file) return null;
  const docs = yamlLoadAll(file.content) as NamespaceDoc[];
  const byslug = new Map<string, Tenant>();
  for (const doc of docs) {
    if (!doc || doc.kind !== "Namespace") continue;
    const slug = doc.metadata?.labels?.["equity.io/tenant"];
    if (!slug) continue;
    const name = doc.metadata?.labels?.["equity.io/tenant-name"] ?? slug;
    const nsName = doc.metadata?.name ?? "";
    if (!nsName) continue;
    const existing = byslug.get(slug);
    if (existing) existing.namespaces.push(nsName);
    else byslug.set(slug, { slug, name, namespaces: [nsName] });
  }
  return Array.from(byslug.values()).sort((a, b) => a.name.localeCompare(b.name));
}
