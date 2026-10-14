// SERVER-ONLY. MinIO/S3 client for per-tenant artifact buckets.
//
// Not guarded by `import "server-only"` because the MCP server
// (console/mcp/server.ts) imports this directly — the MCP runs under tsx,
// not Next's bundler, and `server-only` throws unconditionally outside
// Next. Never import this module from a client component; admin creds
// come from process.env which isn't available client-side anyway.
//
// Operations split in two groups:
//   Admin ops   — bucket create, lifecycle. Called from tenant provisioning;
//                 never from user-facing routes.
//   Data ops    — put/get/list/delete objects. Called from the artifact
//                 proxy route, MCP tools, and chat flows.
//
// Credentials:
//   S3_ENDPOINT       — http://minio.minio.svc:9000 in-cluster, override for host.
//   S3_ROOT_USER      — admin user, mirrors charts/minio/values.yaml rootUser.
//   S3_ROOT_PASSWORD  — admin password, mirrors rootPassword.
//
// Missing env is NOT an error at import time — only when a function that
// needs it is actually called. That way the console still boots on
// machines where MinIO isn't up yet (shell crons + chat still work).

import { Client as MinioClient } from "minio";

const DEFAULT_LIFECYCLE_DAYS = 90;

export function bucketForTenant(slug: string): string {
  // S3 bucket naming rules: lowercase, 3-63 chars, no underscores. We
  // enforce by prefixing + replacing. Tenant slugs are already kebab-case
  // from the console input validator, so this is defense-in-depth.
  const safe = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  return `tenant-${safe}`;
}

// ─── Admin client (singleton, root creds) ─────────────────────────────────

let _adminClient: MinioClient | null = null;

export function adminClient(): MinioClient {
  if (_adminClient) return _adminClient;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ROOT_USER;
  const secretKey = process.env.S3_ROOT_PASSWORD;
  if (!endpoint || !accessKey || !secretKey) {
    throw new Error(
      "S3 admin client requires S3_ENDPOINT, S3_ROOT_USER, S3_ROOT_PASSWORD env vars",
    );
  }
  const url = new URL(endpoint);
  _adminClient = new MinioClient({
    endPoint: url.hostname,
    port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
    useSSL: url.protocol === "https:",
    accessKey,
    secretKey,
  });
  return _adminClient;
}

// ─── Bucket provisioning ──────────────────────────────────────────────────

export type EnsureBucketResult =
  | { ok: true; action: "created" | "exists"; bucket: string }
  | { ok: false; reason: string };

export async function ensureTenantBucket(
  slug: string,
  options?: { lifecycleDays?: number },
): Promise<EnsureBucketResult> {
  let client: MinioClient;
  try {
    client = adminClient();
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
  const bucket = bucketForTenant(slug);
  try {
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket);
    }
    await setLifecycle(bucket, options?.lifecycleDays ?? DEFAULT_LIFECYCLE_DAYS);
    return { ok: true, action: exists ? "exists" : "created", bucket };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

async function setLifecycle(bucket: string, days: number): Promise<void> {
  // Expire every object `days` after creation. Idempotent — overwrites
  // whatever rule set is on the bucket today.
  const rule = {
    Rule: [
      {
        ID: `expire-${days}d`,
        Status: "Enabled",
        Filter: { Prefix: "" },
        Expiration: { Days: days },
      },
    ],
  };
  await adminClient().setBucketLifecycle(bucket, rule);
}

// ─── Data ops (used by MCP tools + proxy route) ───────────────────────────

export type PutResult = {
  bucket: string;
  key: string;
  size: number;
  etag: string;
};

export async function putObject(
  slug: string,
  key: string,
  body: Buffer | Uint8Array,
  contentType?: string,
): Promise<PutResult> {
  const bucket = bucketForTenant(slug);
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const info = await adminClient().putObject(
    bucket,
    key,
    buf,
    buf.byteLength,
    contentType ? { "Content-Type": contentType } : undefined,
  );
  return { bucket, key, size: buf.byteLength, etag: info.etag };
}

export type ObjectStat = {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
  contentType?: string;
};

export async function statObject(slug: string, key: string): Promise<ObjectStat> {
  const bucket = bucketForTenant(slug);
  const s = await adminClient().statObject(bucket, key);
  return {
    key,
    size: s.size,
    lastModified: s.lastModified,
    etag: s.etag,
    contentType: s.metaData?.["content-type"] ?? undefined,
  };
}

// Stream version — used by the proxy route to avoid buffering large objects
// into memory before sending to the client.
export async function getObjectStream(
  slug: string,
  key: string,
): Promise<NodeJS.ReadableStream> {
  const bucket = bucketForTenant(slug);
  return adminClient().getObject(bucket, key);
}

// Buffered version — used by MCP s3_get when the agent wants the bytes
// (small artifacts; large ones should go through the proxy URL instead).
export async function getObjectBuffer(slug: string, key: string): Promise<Buffer> {
  const stream = await getObjectStream(slug, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export type ListEntry = {
  key: string;
  size: number;
  lastModified: Date;
  etag: string;
};

export async function listObjects(
  slug: string,
  prefix: string = "",
  maxKeys: number = 1000,
): Promise<ListEntry[]> {
  const bucket = bucketForTenant(slug);
  const out: ListEntry[] = [];
  const stream = adminClient().listObjectsV2(bucket, prefix, true);
  for await (const item of stream) {
    if (!item.name) continue;
    out.push({
      key: item.name,
      size: item.size,
      lastModified: item.lastModified,
      etag: item.etag,
    });
    if (out.length >= maxKeys) break;
  }
  return out;
}

export async function removeObject(slug: string, key: string): Promise<void> {
  const bucket = bucketForTenant(slug);
  await adminClient().removeObject(bucket, key);
}
