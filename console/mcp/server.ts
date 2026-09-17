// equity-mcp — MCP stdio server that exposes tenant primitives as tools.
//
// Runs standalone (no Next.js runtime): reads GITHUB_TOKEN + GITHUB_REPO from
// env, talks to K8s via kubeconfig, and reuses pure helpers from console/lib.
// The stateful bits of the console (iron-session, backup-config UI) are not
// used — this server is for founder/operator use from Claude Code where env
// vars are the natural auth surface.
//
// Tools:
//   list_businesses   — union of cluster + repo discovery
//   get_business      — profile YAML + namespace + warnings
//   create_business   — parse input → commit namespace → apply to cluster
//   update_profile    — patch businesses/<slug>.yaml, commit
//   create_cron       — schedule a CronJob (shell OR AI-runner mode)
//
// Design note: pure lib functions (parseBusinessInput, provisionCron) are
// imported directly; k8s + github ops for business primitives are done
// inline against the raw SDK/HTTP so the MCP has no dependency on the Next
// runtime or the console session. create_cron reuses the shared
// provisionCron code path so the chat + form + tool produce identical YAML.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { KubeConfig, CoreV1Api, BatchV1Api } from "@kubernetes/client-node";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";
import { homedir } from "node:os";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseBusinessInput } from "../lib/business-url.js";
import {
  ALLOWED_CONCURRENCY,
  CLAUDE_RUNNER_SECRET,
  buildCronJobBody,
  renderCronYaml,
  validateProvisionInput,
  type ConcurrencyPolicy,
  type ProvisionCronInput,
} from "../lib/cron-render.js";

// ── K8s client (kubeconfig or in-cluster) ────────────────────────────────────
//
// When this MCP is spawned as a child of `claude --print` (e.g. from the
// console's /api/chat route), Claude Code hands the subprocess a minimal
// env — only the vars listed in .mcp.json's `env` block. That block passes
// `KUBECONFIG: "${KUBECONFIG}"`; if the operator's shell hasn't exported
// KUBECONFIG explicitly (relying on the standard ~/.kube/config default),
// the substitution yields empty string. loadFromDefault() then sees a
// literal-empty KUBECONFIG and fails to reach the cluster instead of
// falling back. We handle that explicitly here.
let _core: CoreV1Api | null = null;
let _batch: BatchV1Api | null = null;
function kubeConfig(): KubeConfig {
  const kc = new KubeConfig();
  if (process.env.KUBERNETES_SERVICE_HOST) {
    kc.loadFromCluster();
    return kc;
  }
  const envPath = process.env.KUBECONFIG?.trim();
  const defaultPath = path.join(homedir(), ".kube", "config");
  if (envPath && existsSync(envPath)) {
    kc.loadFromFile(envPath);
    return kc;
  }
  if (envPath && !existsSync(envPath)) {
    // Warn once so operators can find the stale export (leftover from a
    // prior shell session is the usual culprit).
    console.error(
      `[equity-mcp] warning: KUBECONFIG="${envPath}" doesn't exist — ` +
      `falling back to ${defaultPath}. Unset KUBECONFIG in your shell to silence this.`,
    );
  }
  if (existsSync(defaultPath)) {
    kc.loadFromFile(defaultPath);
    return kc;
  }
  // Last resort — lets the k8s client throw its own descriptive error
  // instead of us guessing at what's wrong.
  kc.loadFromDefault();
  return kc;
}
function core(): CoreV1Api {
  if (_core) return _core;
  _core = kubeConfig().makeApiClient(CoreV1Api);
  return _core;
}
function batch(): BatchV1Api {
  if (_batch) return _batch;
  _batch = kubeConfig().makeApiClient(BatchV1Api);
  return _batch;
}

// ── GitHub write target — config-file first, env second ─────────────────────
//
// Precedence (must match the console-side `resolveTargetRepo` in
// console/lib/github.ts):
//   1. local/.config.json's `githubBackup.repoUrl` when backup is enabled —
//      this is the UI-managed truth set via the console's GitHub tab. Wins
//      even when the operator's shell has an old `export GITHUB_REPO=…` from
//      another project that would otherwise silently route writes elsewhere.
//   2. process.env.GITHUB_REPO fallback for headless / OSS-contributor use.
//
// This was originally env-only and caused private data to land on the OSS
// repo when the operator's ~/.zshrc had `export GITHUB_REPO=<oss-slug>`
// left over — Next.js's .env.local does NOT override existing shell env,
// so console/.env.local was silently ignored. Config-file-first fixes it.
type Repo = { owner: string; name: string; branch: string };

// Slug from https://github.com/<owner>/<name>[.git] → "owner/name"
function slugFromRepoUrl(url: string): string | null {
  const m = url.trim().match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

function repoFromLocalConfig(): Repo | null {
  // The MCP is spawned from the repo root (console's chat spawn sets cwd),
  // OR from console/ (when Claude Code CLI auto-spawns via .mcp.json). Walk
  // up from this module's file location to find the repo root reliably.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "..", "..", "local", ".config.json"),   // repo-root/local/.config.json
    path.resolve(here, "..", "..", "..", "local", ".config.json"),
    path.resolve(process.cwd(), "local", ".config.json"),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const cfg = JSON.parse(readFileSync(p, "utf8")) as {
        githubBackup?: { enabled?: boolean; repoUrl?: string; branch?: string };
      };
      if (!cfg.githubBackup?.enabled || !cfg.githubBackup.repoUrl) continue;
      const slug = slugFromRepoUrl(cfg.githubBackup.repoUrl);
      if (!slug) continue;
      const [owner, name] = slug.split("/");
      return { owner, name, branch: cfg.githubBackup.branch ?? "main" };
    } catch {
      continue;
    }
  }
  return null;
}

function repo(): Repo | null {
  const fromConfig = repoFromLocalConfig();
  if (fromConfig) return fromConfig;

  const slug = process.env.GITHUB_REPO;
  if (!slug || !slug.includes("/")) return null;
  const [owner, name] = slug.split("/");
  return { owner, name, branch: process.env.GITHUB_BRANCH ?? "main" };
}

async function ghFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not set");
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function getFile(path: string): Promise<{ content: string; sha: string } | null> {
  const r = repo();
  if (!r) return null;
  const res = await ghFetch(
    `/repos/${r.owner}/${r.name}/contents/${encodeURIComponent(path)}?ref=${r.branch}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getFile ${path}: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { content: string; sha: string; encoding: string };
  const content = body.encoding === "base64" ? Buffer.from(body.content, "base64").toString("utf8") : body.content;
  return { content, sha: body.sha };
}

async function putFile(args: {
  path: string;
  content: string;
  message: string;
  sha?: string;
}): Promise<void> {
  const r = repo();
  if (!r) throw new Error("GITHUB_REPO not set");
  const res = await ghFetch(`/repos/${r.owner}/${r.name}/contents/${encodeURIComponent(args.path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message: args.message,
      content: Buffer.from(args.content, "utf8").toString("base64"),
      branch: r.branch,
      sha: args.sha,
    }),
  });
  if (!res.ok) throw new Error(`putFile ${args.path}: ${res.status} ${await res.text()}`);
}

// ── Tenant discovery ─────────────────────────────────────────────────────────
type Tenant = { slug: string; name: string; namespaces: string[]; source: "cluster" | "repo" | "both" };

async function discoverCluster(): Promise<Map<string, Tenant>> {
  const out = new Map<string, Tenant>();
  try {
    const res = await core().listNamespace({ labelSelector: "equity.io/tenant" });
    for (const ns of res.items ?? []) {
      const slug = ns.metadata?.labels?.["equity.io/tenant"];
      const nsName = ns.metadata?.name;
      if (!slug || !nsName) continue;
      const name = ns.metadata?.labels?.["equity.io/tenant-name"] ?? slug;
      const existing = out.get(slug);
      if (existing) existing.namespaces.push(nsName);
      else out.set(slug, { slug, name, namespaces: [nsName], source: "cluster" });
    }
  } catch (e) {
    // K8s unreachable is a soft error — repo view still works.
    console.error("[discoverCluster]", e instanceof Error ? e.message : e);
  }
  return out;
}

async function discoverRepo(): Promise<Map<string, Tenant>> {
  const out = new Map<string, Tenant>();
  const file = await getFile("bootstrap/00-namespaces.yaml").catch(() => null);
  if (!file) return out;
  // bootstrap/00-namespaces.yaml is multi-doc; split on `---` and parse each
  // separately (js-yaml `load` only returns the last doc of a multi-doc file).
  type Doc = { kind?: string; metadata?: { name?: string; labels?: Record<string, string> } };
  const rawDocs = file.content.split(/^---\s*$/m).map((s) => s.trim()).filter(Boolean);
  for (const raw of rawDocs) {
    const doc = yamlLoad(raw) as Doc;
    if (!doc || doc.kind !== "Namespace") continue;
    const slug = doc.metadata?.labels?.["equity.io/tenant"];
    const nsName = doc.metadata?.name;
    if (!slug || !nsName) continue;
    const name = doc.metadata?.labels?.["equity.io/tenant-name"] ?? slug;
    const existing = out.get(slug);
    if (existing) existing.namespaces.push(nsName);
    else out.set(slug, { slug, name, namespaces: [nsName], source: "repo" });
  }
  return out;
}

async function discoverAll(): Promise<Tenant[]> {
  const [cluster, repo] = await Promise.all([discoverCluster(), discoverRepo()]);
  const merged = new Map<string, Tenant>();
  for (const [slug, t] of cluster) merged.set(slug, { ...t });
  for (const [slug, t] of repo) {
    const existing = merged.get(slug);
    if (existing) {
      existing.source = "both";
      for (const ns of t.namespaces) if (!existing.namespaces.includes(ns)) existing.namespaces.push(ns);
    } else merged.set(slug, { ...t });
  }
  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ── Business profile helpers ─────────────────────────────────────────────────
function profilePath(slug: string): string {
  return `businesses/${slug}.yaml`;
}

async function readProfile(slug: string): Promise<Record<string, unknown> | null> {
  const file = await getFile(profilePath(slug)).catch(() => null);
  if (!file) return null;
  return (yamlLoad(file.content) as Record<string, unknown>) ?? {};
}

// Deep merge for profile patches. Arrays are replaced, not concatenated —
// the operator's intent when they pass an array is usually "make it this,"
// not "add to it." Callers who want append semantics should read → mutate → write.
function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── Tool handlers ────────────────────────────────────────────────────────────
async function toolListBusinesses(): Promise<string> {
  const tenants = await discoverAll();
  if (tenants.length === 0) return "No businesses found. Use create_business to onboard one.";
  const lines = tenants.map(
    (t) => `- ${t.name} (slug: ${t.slug}) — namespaces: ${t.namespaces.join(", ")} [${t.source}]`,
  );
  return `${tenants.length} business(es):\n${lines.join("\n")}`;
}

async function toolGetBusiness(args: { slug: string }): Promise<string> {
  const tenants = await discoverAll();
  const tenant = tenants.find((t) => t.slug === args.slug);
  if (!tenant) return `No business found with slug "${args.slug}".`;
  const profile = await readProfile(args.slug);
  const sections: string[] = [];
  sections.push(`# ${tenant.name} (${tenant.slug})`);
  sections.push(`Namespaces: ${tenant.namespaces.join(", ")}`);
  sections.push(`Source: ${tenant.source}`);
  if (tenant.source === "repo") sections.push("⚠️  In repo, not in cluster — namespace not yet applied.");
  if (tenant.source === "cluster") sections.push("⚠️  In cluster, not in repo — not backed by git.");
  if (profile) {
    sections.push("");
    sections.push("## Profile");
    sections.push("```yaml");
    sections.push(yamlDump(profile).trimEnd());
    sections.push("```");
  } else {
    sections.push("");
    sections.push(`(No profile yet at ${profilePath(args.slug)}. Use update_profile to create one.)`);
  }
  return sections.join("\n");
}

async function toolCreateBusiness(args: { input: string }): Promise<string> {
  const parsed = parseBusinessInput(args.input);
  if (!parsed.ok) return `Cannot create: ${parsed.reason}`;

  const existing = await discoverAll();
  if (existing.some((t) => t.slug === parsed.slug)) {
    return `Business "${parsed.slug}" already exists. Use get_business to inspect it.`;
  }

  const warnings: string[] = [];
  const notes: string[] = [];

  // 1) Commit namespace to git (if env is set).
  const r = repo();
  if (r && process.env.GITHUB_TOKEN) {
    try {
      const bootstrap = await getFile("bootstrap/00-namespaces.yaml");
      if (!bootstrap) {
        warnings.push("bootstrap/00-namespaces.yaml not found in repo; git commit skipped.");
      } else {
        const block = `---\napiVersion: v1\nkind: Namespace\nmetadata:\n  name: ${parsed.namespace}\n  labels:\n    equity.io/tenant: ${parsed.slug}\n    equity.io/tenant-name: ${parsed.name}\n`;
        const appended = bootstrap.content + (bootstrap.content.endsWith("\n") ? "" : "\n") + block;
        await putFile({
          path: "bootstrap/00-namespaces.yaml",
          content: appended,
          message: `feat(agency): add ${parsed.name} (${parsed.slug}) business`,
          sha: bootstrap.sha,
        });
        notes.push(`git: committed namespace to bootstrap/00-namespaces.yaml`);
      }
    } catch (e) {
      warnings.push(`git commit failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    warnings.push("GITHUB_TOKEN or GITHUB_REPO not set; git commit skipped.");
  }

  // 2) Apply namespace to cluster.
  try {
    await core().createNamespace({
      body: {
        metadata: {
          name: parsed.namespace,
          labels: {
            "equity.io/tenant": parsed.slug,
            "equity.io/tenant-name": parsed.name,
          },
        },
      },
    });
    notes.push(`k8s: namespace ${parsed.namespace} created`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists")) {
      notes.push(`k8s: namespace ${parsed.namespace} already existed`);
    } else {
      return `Created git-only. Cluster apply failed: ${msg}\n${notes.join("\n")}`;
    }
  }

  // 3) Best-effort seed of the claude-runner-auth Secret so AI crons on
  //    this tenant work without a manual `make runner-secret` step.
  //    Skipped silently when CLAUDE_CODE_OAUTH_TOKEN isn't in this MCP's
  //    env — chat's create_cron pre-flight will surface a clear message
  //    later. Idempotent.
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    try {
      await ensureRunnerSecretInline(parsed.namespace, process.env.CLAUDE_CODE_OAUTH_TOKEN);
      notes.push(`k8s: seeded ${CLAUDE_RUNNER_SECRET} in ${parsed.namespace}`);
    } catch (e) {
      warnings.push(`AI runner secret not seeded: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    warnings.push(`CLAUDE_CODE_OAUTH_TOKEN not set; AI-runner crons will need \`make runner-secret NS=${parsed.namespace}\` before use.`);
  }

  const lines = [
    `✅ Business "${parsed.name}" created (slug: ${parsed.slug}, namespace: ${parsed.namespace}).`,
    ...notes.map((n) => `  ${n}`),
  ];
  if (warnings.length) lines.push("", "Warnings:", ...warnings.map((w) => `  ${w}`));
  lines.push("", `Next: update_profile("${parsed.slug}", { identity: { ... }, ... })`);
  return lines.join("\n");
}

// MCP-local variant of ensureRunnerSecret. Kept inline (not imported from
// console/lib/runner-secret.ts) to preserve the "no Next runtime" design
// principle in the server's module docblock. If this drifts from the
// console-side helper, add a shared pure builder in cron-render.
async function ensureRunnerSecretInline(namespace: string, token: string): Promise<void> {
  const body = {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: CLAUDE_RUNNER_SECRET,
      namespace,
      labels: { "equity.io/managed-by": "console" },
    },
    type: "Opaque",
    stringData: { "oauth-token": token },
  };
  try {
    await core().createNamespacedSecret({ namespace, body });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("already exists")) throw e;
    await core().replaceNamespacedSecret({ name: CLAUDE_RUNNER_SECRET, namespace, body });
  }
}

// ── create_cron ──────────────────────────────────────────────────────────────
//
// Two calling shapes:
//
//   1) Runner mode (the natural-language flow the chat uses):
//      { tenant, name, schedule, prompt }
//      → runs equity/claude-runner:latest with $PROMPT env; publishes NATS
//        `events.<tenant>.cron.completed` on finish.
//
//   2) Shell mode (parity with the /cron/new form for edge cases):
//      { tenant, name, schedule, image, command }
//      → runs the given image with `/bin/sh -c '<command>'`.
//
// `namespace` defaults to the tenant's first known namespace; `concurrencyPolicy`
// defaults to "Forbid" for runner mode (LLM calls are expensive; overlap is
// worse than skip) and "Allow" for shell mode (form-flow default).
type CreateCronArgs = {
  tenant: string;
  name: string;
  schedule: string;
  prompt?: string;
  image?: string;
  command?: string;
  namespace?: string;
  concurrencyPolicy?: ConcurrencyPolicy;
};

async function toolCreateCron(args: CreateCronArgs): Promise<string> {
  const hasPrompt = typeof args.prompt === "string" && args.prompt.trim().length > 0;
  const hasImage = typeof args.image === "string" && args.image.length > 0;
  const hasCommand = typeof args.command === "string" && args.command.length > 0;

  if (hasPrompt && (hasImage || hasCommand)) {
    return `Ambiguous: pass EITHER prompt (runner mode) OR image+command (shell mode), not both.`;
  }
  if (!hasPrompt && !(hasImage && hasCommand)) {
    return `Missing input: pass either { prompt } for runner mode, or { image, command } for shell mode.`;
  }

  // Resolve namespace: use provided if any, else the tenant's first known.
  let namespace = args.namespace?.trim() ?? "";
  if (!namespace) {
    const tenants = await discoverAll();
    const t = tenants.find((x) => x.slug === args.tenant);
    if (!t || t.namespaces.length === 0) {
      return `No namespace could be resolved for tenant "${args.tenant}". Pass one explicitly, or run list_businesses to see what's available.`;
    }
    namespace = t.namespaces[0];
  }

  const concurrencyPolicy: ConcurrencyPolicy =
    args.concurrencyPolicy && ALLOWED_CONCURRENCY.includes(args.concurrencyPolicy)
      ? args.concurrencyPolicy
      : hasPrompt
        ? "Forbid"
        : "Allow";

  const input: ProvisionCronInput = hasPrompt
    ? {
        mode: "runner",
        tenant: args.tenant,
        name: args.name,
        namespace,
        schedule: args.schedule,
        prompt: args.prompt!.trim(),
        concurrencyPolicy,
      }
    : {
        mode: "shell",
        tenant: args.tenant,
        name: args.name,
        namespace,
        schedule: args.schedule,
        image: args.image!,
        command: args.command!,
        concurrencyPolicy,
      };

  const v = validateProvisionInput(input);
  if (!v.ok) return `Cannot create cron: ${v.error}`;

  // GitHub configured?
  if (!repo() || !process.env.GITHUB_TOKEN) {
    return "Cannot create cron: GITHUB_TOKEN + GITHUB_REPO must be set.";
  }

  // Runner-mode: fail loudly if the OAuth secret is missing rather than let
  // the pod ImagePullBackOff → CrashLoopBackOff silently forever.
  if (input.mode === "runner") {
    try {
      await core().readNamespacedSecret({ name: CLAUDE_RUNNER_SECRET, namespace });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Cluster unreachable vs. secret genuinely missing vs. everything
      // else — three very different fixes, three different messages.
      if (
        msg.includes("ECONNREFUSED") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("no current context") ||
        msg.includes("context") && msg.includes("not exist") ||
        msg.includes("dial tcp")
      ) {
        return (
          `Cannot create cron: cluster unreachable (${msg}). ` +
          `Your kind cluster may be down or your kubectl context is stale. ` +
          `Fix: run \`./local/up.sh\` from the repo root to bring it back.`
        );
      }
      if (msg.includes("not found") || msg.includes("404")) {
        return (
          `Cannot create cron: secret "${CLAUDE_RUNNER_SECRET}" not found in namespace "${namespace}". ` +
          `Fix: run \`make runner-secret NS=${namespace}\` from the repo root ` +
          `(or rerun \`./local/up.sh\` which auto-seeds it for every tenant namespace).`
        );
      }
      return `Cannot create cron: failed to verify runner secret: ${msg}`;
    }
  }

  const path = `crons/${input.name}.yaml`;

  // 1) Refuse if the file already exists.
  const existing = await getFile(path).catch((e) => {
    throw new Error(`GitHub read failed: ${e instanceof Error ? e.message : String(e)}`);
  });
  if (existing) {
    return `Cannot create cron: a cron named "${input.name}" already exists at ${path}.`;
  }

  // 2) Commit manifest to git.
  const manifest = renderCronYaml(input);
  try {
    await putFile({
      path,
      content: manifest,
      message: `feat(${input.tenant}): add cron ${input.name} via console`,
    });
  } catch (e) {
    return `Cannot create cron: GitHub write failed: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 3) Apply to cluster. If this fails, git already landed — return a
  //    warning rather than rolling back the commit.
  let warning: string | undefined;
  try {
    await batch().createNamespacedCronJob({
      namespace: input.namespace,
      body: buildCronJobBody(input),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("already exists")) {
      warning = `Committed but cluster-apply failed: ${msg}. Run kubectl apply -f ${path} manually.`;
    }
  }

  const lines = [
    `✅ Cron "${input.name}" scheduled for ${input.tenant} (namespace ${namespace}).`,
    `  git: committed manifest to ${path}`,
    `  k8s: CronJob applied${warning ? " (with warning)" : ""}`,
    `  schedule: ${input.schedule}  ·  concurrency: ${concurrencyPolicy}`,
  ];
  if (input.mode === "runner") {
    lines.push(
      `  runner: equity/claude-runner:latest — publishes events.${input.tenant}.cron.completed on finish`,
    );
  }
  if (warning) {
    lines.push("", `Warning: ${warning}`);
  }
  return lines.join("\n");
}

async function toolUpdateProfile(args: { slug: string; patch: Record<string, unknown> }): Promise<string> {
  const r = repo();
  if (!r || !process.env.GITHUB_TOKEN) return "GITHUB_TOKEN + GITHUB_REPO required to write profiles.";
  const tenants = await discoverAll();
  if (!tenants.some((t) => t.slug === args.slug)) {
    return `No business with slug "${args.slug}". Create it first with create_business.`;
  }
  const path = profilePath(args.slug);
  const existing = await getFile(path).catch(() => null);
  const base = existing ? ((yamlLoad(existing.content) as Record<string, unknown>) ?? {}) : {};
  const merged = deepMerge(base, args.patch);
  const yaml = yamlDump(merged, { lineWidth: 100, noRefs: true });
  await putFile({
    path,
    content: yaml,
    message: existing
      ? `chore(${args.slug}): update profile`
      : `feat(${args.slug}): create profile`,
    sha: existing?.sha,
  });
  return `✅ Profile ${existing ? "updated" : "created"} at ${path}.\n\n\`\`\`yaml\n${yaml.trimEnd()}\n\`\`\``;
}

// ── Server wiring ────────────────────────────────────────────────────────────
const server = new Server(
  { name: "equity-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_businesses",
      description:
        "List every business (tenant) discovered from the local K8s cluster and the connected git repo. Shows namespaces, display name, and where each business is defined (cluster / repo / both).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "get_business",
      description:
        "Return the full profile YAML + namespace + drift status for one business. Use after list_businesses to inspect a specific tenant.",
      inputSchema: {
        type: "object",
        properties: { slug: { type: "string", description: "Business slug (e.g. 'acme')" } },
        required: ["slug"],
        additionalProperties: false,
      },
    },
    {
      name: "create_business",
      description:
        "Create a new business (tenant). Parses a URL or free-text name into slug + namespace, commits the namespace block to bootstrap/00-namespaces.yaml (if GitHub env is set), and applies the namespace to the local cluster. Idempotent for existing namespaces.",
      inputSchema: {
        type: "object",
        properties: {
          input: {
            type: "string",
            description: "URL (myshop.com) or free-text name ('Acme Operations'). Parsed into slug automatically.",
          },
        },
        required: ["input"],
        additionalProperties: false,
      },
    },
    {
      name: "update_profile",
      description:
        "Patch the business profile YAML at businesses/<slug>.yaml. Deep-merges the patch into the existing profile (arrays are replaced, not concatenated) and commits. Creates the file if it doesn't exist.",
      inputSchema: {
        type: "object",
        properties: {
          slug: { type: "string", description: "Business slug" },
          patch: {
            type: "object",
            description:
              "Partial profile object. Example: { identity: { legal_name: 'Foo LLC', jurisdiction: 'NV, USA' }, offer: { name: 'Used Cars' } }",
            additionalProperties: true,
          },
        },
        required: ["slug", "patch"],
        additionalProperties: false,
      },
    },
    {
      name: "create_cron",
      description:
        "Schedule a CronJob for a tenant. Two shapes: (1) runner mode — pass `prompt` and the cron runs equity/claude-runner:latest with $PROMPT env, publishing events.<tenant>.cron.completed on finish; (2) shell mode — pass `image` + `command` for arbitrary containers. Commits crons/<name>.yaml AND applies to the cluster. IMPORTANT: propose the YAML to the operator and wait for explicit confirmation before calling this tool — do not auto-create.",
      inputSchema: {
        type: "object",
        properties: {
          tenant: { type: "string", description: "Tenant slug (e.g. 'pypes')." },
          name: {
            type: "string",
            description: "Cron name: kebab-case, ≤52 chars. Becomes the k8s resource name AND the git file name.",
          },
          schedule: {
            type: "string",
            description: "5-field cron expression (e.g. '0 0 * * 0' for weekly) or an @keyword (e.g. '@daily').",
          },
          prompt: {
            type: "string",
            description:
              "RUNNER MODE. Natural-language instruction the claude-runner container runs on each tick. Multi-line OK. Do not pass this together with image/command.",
          },
          image: {
            type: "string",
            description:
              "SHELL MODE. Docker image (tag required, avoid :latest in prod). Pair with `command`. Do not pass this together with prompt.",
          },
          command: {
            type: "string",
            description:
              "SHELL MODE. Shell command run via /bin/sh -c. Pair with `image`. Do not pass this together with prompt.",
          },
          namespace: {
            type: "string",
            description: "Kubernetes namespace. Optional — defaults to the tenant's first known namespace.",
          },
          concurrencyPolicy: {
            type: "string",
            enum: ["Allow", "Forbid", "Replace"],
            description:
              "Optional. Defaults to 'Forbid' in runner mode (avoid overlapping LLM spend), 'Allow' in shell mode.",
          },
        },
        required: ["tenant", "name", "schedule"],
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let text: string;
    switch (name) {
      case "list_businesses":
        text = await toolListBusinesses();
        break;
      case "get_business":
        text = await toolGetBusiness(args as { slug: string });
        break;
      case "create_business":
        text = await toolCreateBusiness(args as { input: string });
        break;
      case "update_profile":
        text = await toolUpdateProfile(args as { slug: string; patch: Record<string, unknown> });
        break;
      case "create_cron":
        text = await toolCreateCron(args as CreateCronArgs);
        break;
      default:
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
    return { content: [{ type: "text", text }] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[equity-mcp] ready");
}

main().catch((e) => {
  console.error("[equity-mcp] fatal:", e);
  process.exit(1);
});
