// Entitlements — the one seam between the OSS core and the commercial
// hosted SaaS. See ../../COMMERCIAL_BOUNDARY.md for the contract.
//
// OSS default: every check returns { ok: true, plan: "self-hosted" }.
// Self-hosters get every feature.
//
// Commercial override: set COMMERCIAL_ENTITLEMENTS_MODULE=<import path> in
// production. The core dynamically imports that module and delegates. The
// commercial module is responsible for real billing/plan/usage checks and
// MUST fail closed on unknown actions.

import "server-only";

export type EntitlementAction =
  // AI features — metered per generation on paid plans, unlimited on self-hosted.
  | "ai.logo_generate"
  | "ai.chat_message"
  // GitOps writeback — metered per commit on paid plans.
  | "gitops.write"
  // Provisioning — plan may cap tenant/app counts.
  | "provision.tenant"
  | "provision.app"
  | "provision.cron";

export type EntitlementContext = {
  tenant?: string;
  userId?: string;
  // Free-form for the commercial layer to attach org id, plan hints, etc.
  // The core never reads these — it just passes them through.
  meta?: Record<string, unknown>;
};

export type EntitlementResult =
  | { ok: true; plan: string }
  | { ok: false; reason: string; upgrade_url?: string; plan?: string };

// The shape a commercial module must export. Keep this stable — changing
// it breaks every hosted deployment.
export type EntitlementModule = {
  checkEntitlement(
    action: EntitlementAction,
    ctx: EntitlementContext,
  ): Promise<EntitlementResult>;
};

// ─── OSS default ──────────────────────────────────────────────────────────

const ossDefault: EntitlementModule = {
  async checkEntitlement(): Promise<EntitlementResult> {
    return { ok: true, plan: "self-hosted" };
  },
};

// ─── Plugin resolution ────────────────────────────────────────────────────

let cached: EntitlementModule | null = null;

async function resolveModule(): Promise<EntitlementModule> {
  if (cached) return cached;
  const path = process.env.COMMERCIAL_ENTITLEMENTS_MODULE;
  if (!path) {
    cached = ossDefault;
    return cached;
  }
  try {
    // Dynamic import so the OSS build has zero dependency on the commercial
    // module. In production, the deployer ships the commercial package
    // alongside this repo and sets the env var to its import path.
    const mod = (await import(/* webpackIgnore: true */ path)) as
      | EntitlementModule
      | { default: EntitlementModule };
    const impl = "default" in mod ? mod.default : mod;
    if (typeof impl?.checkEntitlement !== "function") {
      throw new Error(`module ${path} does not export checkEntitlement`);
    }
    cached = impl;
    return cached;
  } catch (e) {
    console.error(
      `[entitlements] failed to load COMMERCIAL_ENTITLEMENTS_MODULE=${path}:`,
      e,
    );
    // Fail CLOSED on module load failure — a broken commercial deploy
    // must not silently grant free access to paid features.
    cached = {
      async checkEntitlement() {
        return {
          ok: false,
          reason: "Entitlement service unavailable. Please try again shortly.",
        };
      },
    };
    return cached;
  }
}

/**
 * The public API. Every server action or API route that performs a
 * gated/metered operation MUST call this before doing the work.
 *
 * ```ts
 * const gate = await checkEntitlement("ai.logo_generate", { tenant });
 * if (!gate.ok) {
 *   return Response.json({ error: gate.reason, upgrade_url: gate.upgrade_url }, { status: 402 });
 * }
 * // ... do the work
 * ```
 */
export async function checkEntitlement(
  action: EntitlementAction,
  ctx: EntitlementContext = {},
): Promise<EntitlementResult> {
  const mod = await resolveModule();
  return mod.checkEntitlement(action, ctx);
}
