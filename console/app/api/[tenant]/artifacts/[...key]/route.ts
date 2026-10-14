// GET /api/[tenant]/artifacts/[...key] — stream a tenant's artifact bytes
// from MinIO back to the browser through the console.
//
// Why proxied (not presigned URLs):
//   The MinIO service is ClusterIP-only — not reachable from the browser.
//   Rather than wire presigned URLs + per-tenant creds + CORS, we keep all
//   artifact traffic flowing through the console's authenticated route.
//   The console already resolves tenant → namespace → bucket, so auth is
//   just tenant-slug validation.
//
// Scale caveat: every byte flows through Node. Fine for the current
// local-only console; revisit (presigned URLs) if we ever hoist to a
// hosted deployment with large uploads at scale.

import { NextRequest } from "next/server";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { getObjectStream, statObject } from "@/lib/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenant: string; key: string[] }> },
) {
  const { tenant, key: keyParts } = await params;
  if (tenant === MASTER_SLUG) {
    return Response.json({ error: "Pick a business first" }, { status: 400 });
  }
  const t = await resolveTenant(tenant);
  if (!t) return Response.json({ error: `Unknown tenant: ${tenant}` }, { status: 404 });

  const key = (keyParts ?? []).join("/");
  if (!key) return Response.json({ error: "key required" }, { status: 400 });

  let stat;
  try {
    stat = await statObject(tenant, key);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.toLowerCase().includes("not found") ? 404 : 500;
    return Response.json({ error: msg }, { status });
  }

  const stream = await getObjectStream(tenant, key);
  // Convert Node stream → Web stream so Next can return it directly.
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk: Buffer | Uint8Array) => {
        controller.enqueue(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk));
      });
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      // Caller aborted — stop pulling bytes from MinIO. The minio SDK
      // returns a Node Readable (not DOM ReadableStream) which has a
      // .destroy() method; narrow via `unknown` since the SDK's declared
      // return type doesn't surface it.
      const asNode = stream as unknown as { destroy?: () => void };
      asNode.destroy?.();
    },
  });

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": stat.contentType ?? "application/octet-stream",
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=60",
      "ETag": stat.etag,
    },
  });
}
