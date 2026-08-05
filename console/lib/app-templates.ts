// Curated one-click app templates for the /apps/new picker.
//
// A template is a preset for the six fields the raw form asks for. Selecting
// a template routes the user to /:tenant/apps/new/:templateId where those
// fields are pre-filled; submit still hits provisionAppFromForm unchanged.
//
// To add a template: append an entry to TEMPLATES. The integrity test at
// console/tests/unit/app-templates.test.ts enforces schema on every entry
// (unique id, semver version, non-empty required fields, etc.), so a
// malformed template fails at `bun test`, not at a user's first click.
//
// Chart versions are pinned deliberately. Upstream repos may yank a version
// between when a template is authored and when a tenant installs it; when
// that happens ArgoCD sync fails silently (see plan TODO T-freshness).
// Bump versions here in the same PR as any UI mention of a version bump.

export const CATEGORIES = [
  "Database",
  "Cache",
  "Storage",
  "Analytics",
  "CMS",
  "Automation",
  "Observability",
  "Dev tools",
] as const;

export type AppCategory = (typeof CATEGORIES)[number];

export type AppTemplate = {
  id: string;                       // kebab; route segment for /apps/new/:id
  name: string;                     // display name on the card
  icon: string;                     // emoji (v1); swap for SVG when we have designer bandwidth
  category: AppCategory;
  summary: string;                  // one-liner for the card
  chartRepo: string;                // https helm repo URL
  chartName: string;                // helm chart name in the repo
  chartVersion: string;             // pinned semver; no ^ or ~
  defaultNamespace?: string;        // falls back to tenant.namespaces[0]
  valuesYaml: string;               // sensible defaults; ends with newline
  docsSlug?: string;                // links to /docs/<slug> on landing when set
};

const POSTGRES_VALUES = `# PostgreSQL with a single primary. Fine for dev + small workloads.
# For HA, add readReplicas.replicaCount and configure backups.
auth:
  postgresPassword: change-me-in-secret
  database: app
primary:
  persistence:
    size: 8Gi
  resources:
    requests:
      cpu: 100m
      memory: 256Mi
`;

const REDIS_VALUES = `# Redis in standalone mode. No replicas, no sentinel.
# For production HA, set architecture: replication.
architecture: standalone
auth:
  enabled: true
  password: change-me-in-secret
master:
  persistence:
    size: 4Gi
`;

const MINIO_VALUES = `# MinIO single-node, single-drive. S3-compatible object storage.
# For production, use distributed mode (mode: distributed, 4+ replicas).
mode: standalone
auth:
  rootUser: minio
  rootPassword: change-me-in-secret
persistence:
  size: 20Gi
`;

const GRAFANA_VALUES = `# Grafana with default admin password. Change it after first login.
adminUser: admin
adminPassword: change-me-in-secret
persistence:
  enabled: true
  size: 2Gi
`;

const N8N_VALUES = `# n8n workflow automation. Uses SQLite by default (fine for solo/small).
# For team use, point at an external Postgres via db.type + db.postgresdb.*.
main:
  persistence:
    enabled: true
    size: 4Gi
`;

const PLAUSIBLE_VALUES = `# Plausible analytics. Requires a Postgres and ClickHouse instance.
# The chart provisions both as subcharts by default.
baseURL: https://plausible.example.com
adminUser:
  email: admin@example.com
  name: Admin
  password: change-me-in-secret
`;

const GHOST_VALUES = `# Ghost blogging platform. Uses MySQL as the datastore.
ghostHost: blog.example.com
ghostUsername: admin
ghostPassword: change-me-in-secret
ghostEmail: admin@example.com
`;

const MEILISEARCH_VALUES = `# Meilisearch — fast typo-tolerant search.
auth:
  existingMasterKeySecret: ""
environment:
  MEILI_MASTER_KEY: change-me-in-secret
persistence:
  size: 4Gi
`;

const MAILHOG_VALUES = `# MailHog — SMTP capture server for dev. Do not run in production.
# UI on port 8025; SMTP on port 1025.
resources:
  requests:
    cpu: 50m
    memory: 64Mi
`;

const UPTIME_KUMA_VALUES = `# Uptime Kuma — self-hosted uptime monitor.
persistence:
  enabled: true
  size: 2Gi
`;

export const TEMPLATES: readonly AppTemplate[] = [
  {
    id: "postgresql",
    name: "PostgreSQL",
    icon: "🐘",
    category: "Database",
    summary: "The default relational database. Battle-tested, boring, correct.",
    chartRepo: "https://charts.bitnami.com/bitnami",
    chartName: "postgresql",
    chartVersion: "16.0.6",
    valuesYaml: POSTGRES_VALUES,
    docsSlug: "apps-choose-template",
  },
  {
    id: "redis",
    name: "Redis",
    icon: "🟥",
    category: "Cache",
    summary: "In-memory key/value store. Caching, queues, pub/sub, rate limiting.",
    chartRepo: "https://charts.bitnami.com/bitnami",
    chartName: "redis",
    chartVersion: "20.6.2",
    valuesYaml: REDIS_VALUES,
    docsSlug: "apps-choose-template",
  },
  {
    id: "minio",
    name: "MinIO",
    icon: "🪣",
    category: "Storage",
    summary: "S3-compatible object storage you can run on your own cluster.",
    chartRepo: "https://charts.bitnami.com/bitnami",
    chartName: "minio",
    chartVersion: "17.0.21",
    valuesYaml: MINIO_VALUES,
    docsSlug: "apps-choose-template",
  },
  {
    id: "grafana",
    name: "Grafana",
    icon: "📊",
    category: "Observability",
    summary: "Dashboards for metrics, logs, traces. Pairs with the platform's Prometheus.",
    chartRepo: "https://grafana.github.io/helm-charts",
    chartName: "grafana",
    chartVersion: "8.5.2",
    valuesYaml: GRAFANA_VALUES,
    docsSlug: "apps-choose-template",
  },
  {
    id: "n8n",
    name: "n8n",
    icon: "🔀",
    category: "Automation",
    summary: "Visual workflow automation — the open-source Zapier alternative.",
    chartRepo: "https://8gears.container-registry.com/chartrepo/library",
    chartName: "n8n",
    chartVersion: "1.0.10",
    valuesYaml: N8N_VALUES,
    docsSlug: "apps-choose-template",
  },
  {
    id: "plausible",
    name: "Plausible",
    icon: "📈",
    category: "Analytics",
    summary: "Privacy-friendly, cookieless web analytics. Lightweight script, no consent banner.",
    chartRepo: "https://helm.imio.be",
    chartName: "plausible",
    chartVersion: "0.1.0",
    valuesYaml: PLAUSIBLE_VALUES,
    docsSlug: "apps-choose-template",
  },
  {
    id: "ghost",
    name: "Ghost",
    icon: "👻",
    category: "CMS",
    summary: "Editorial CMS for blogs, newsletters, memberships. Publish long-form.",
    chartRepo: "https://charts.bitnami.com/bitnami",
    chartName: "ghost",
    chartVersion: "22.2.7",
    valuesYaml: GHOST_VALUES,
    docsSlug: "apps-choose-template",
  },
  {
    id: "meilisearch",
    name: "Meilisearch",
    icon: "🔎",
    category: "Dev tools",
    summary: "Full-text search for your app. Milliseconds, typo tolerance, no ops.",
    chartRepo: "https://meilisearch.github.io/meilisearch-kubernetes",
    chartName: "meilisearch",
    chartVersion: "0.9.0",
    valuesYaml: MEILISEARCH_VALUES,
    docsSlug: "apps-choose-template",
  },
  {
    id: "mailhog",
    name: "MailHog",
    icon: "📮",
    category: "Dev tools",
    summary: "SMTP capture for development. Send from your app; read in the web UI.",
    chartRepo: "https://codecentric.github.io/helm-charts",
    chartName: "mailhog",
    chartVersion: "5.2.3",
    valuesYaml: MAILHOG_VALUES,
    docsSlug: "apps-choose-template",
  },
  {
    id: "uptime-kuma",
    name: "Uptime Kuma",
    icon: "🟢",
    category: "Observability",
    summary: "Self-hosted uptime monitor. HTTP/TCP/DNS/ping checks with status pages.",
    chartRepo: "https://helm.irsigler.cloud",
    chartName: "uptime-kuma",
    chartVersion: "2.21.0",
    valuesYaml: UPTIME_KUMA_VALUES,
    docsSlug: "apps-choose-template",
  },
] as const;

export function getTemplate(id: string): AppTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function templatesByCategory(): Record<AppCategory, AppTemplate[]> {
  const grouped = Object.fromEntries(
    CATEGORIES.map((c) => [c, [] as AppTemplate[]]),
  ) as Record<AppCategory, AppTemplate[]>;
  for (const t of TEMPLATES) grouped[t.category].push(t);
  return grouped;
}
