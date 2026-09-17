// GET /api/pods/[namespace]/[pod]/logs?tail=500
//
// Thin proxy over k8s readNamespacedPodLog for the cron-run details UI.
// Server-side only — the k8s client uses the console's kubeconfig; the
// browser never talks to the API server directly.
//
// Auth model: the console is a single-operator local tool. No per-user
// auth on this route yet — it can only read pods that exist in the local
// cluster's tenant namespaces, which the operator already has full
// kubectl access to. When multi-user auth lands, add a namespace-scope
// check against the caller's session.

import { NextRequest } from "next/server";
import { readPodLog } from "@/lib/k8s";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reject any pod name / namespace that isn't a valid k8s DNS-1123 label.
// Pathological values could try to break out of the URL scheme; k8s already
// rejects them at write time but the log-read path doesn't validate, so we
// do it here.
const DNS_1123 = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ namespace: string; pod: string }> },
) {
  const { namespace, pod } = await params;
  if (!DNS_1123.test(namespace) || !DNS_1123.test(pod)) {
    return new Response("invalid namespace or pod name", { status: 400 });
  }

  const url = new URL(req.url);
  const tailRaw = url.searchParams.get("tail");
  const tail = tailRaw ? Number.parseInt(tailRaw, 10) : 500;
  if (!Number.isFinite(tail) || tail < 1 || tail > 10_000) {
    return new Response("tail must be 1..10000", { status: 400 });
  }

  try {
    const text = await readPodLog(namespace, pod, tail);
    return new Response(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Distinguish 404 (pod gone / never existed) from generic — the
    // details UI shows a clear "log unavailable" message on 404 rather
    // than a scary stack trace.
    if (msg.includes("not found") || msg.includes("404")) {
      return new Response(`Log unavailable — pod "${pod}" no longer exists in namespace "${namespace}". k8s GC'd it (successful pods are pruned per successfulJobsHistoryLimit).`, {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return new Response(`Log fetch failed: ${msg}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
