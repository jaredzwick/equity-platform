import "server-only";
import { core } from "@/lib/k8s";
import { CLAUDE_RUNNER_SECRET } from "@/lib/cron-render";

// Auto-seed the claude-runner-auth Secret in a tenant namespace so
// AI-runner cron creation doesn't have to wait for the operator to run
// `make runner-secret` by hand.
//
// Called from every path that creates a tenant namespace:
//   - console/app/master/new/actions.ts   (the /master/new form)
//   - console/lib/tenants.ts              (reconcileTenantsFromRepo)
//   - console/mcp/server.ts               (the create_business MCP tool — inlines its own variant)
//
// Behavior is best-effort:
//   - CLAUDE_CODE_OAUTH_TOKEN missing → skip with { ok: true, skipped: true }. Business creation
//     should NOT fail just because AI crons aren't configured; the operator
//     can add the token later and rerun this via `make runner-secret NS=X`.
//   - k8s call fails → return { ok: false, reason } so callers can attach a
//     non-blocking warning to the tenant-creation flow.
//   - Idempotent — re-applies (replaces) the secret if it already exists.

export type EnsureResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; action: "created" | "updated" }
  | { ok: false; reason: string };

export async function ensureRunnerSecret(namespace: string): Promise<EnsureResult> {
  const token = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (!token) {
    return {
      ok: true,
      skipped: true,
      reason: "CLAUDE_CODE_OAUTH_TOKEN not set — AI-runner crons will fail pre-flight until it is.",
    };
  }

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
    return { ok: true, skipped: false, action: "created" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists")) {
      try {
        await core().replaceNamespacedSecret({
          name: CLAUDE_RUNNER_SECRET,
          namespace,
          body,
        });
        return { ok: true, skipped: false, action: "updated" };
      } catch (e2) {
        return {
          ok: false,
          reason: `Existing ${CLAUDE_RUNNER_SECRET} in ${namespace} could not be updated: ${e2 instanceof Error ? e2.message : String(e2)}`,
        };
      }
    }
    return { ok: false, reason: `Failed to create ${CLAUDE_RUNNER_SECRET} in ${namespace}: ${msg}` };
  }
}
