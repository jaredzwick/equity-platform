// POST /api/[tenant]/logo — generate a logo variant via OpenAI gpt-image-1.
//
// Auth: OPENAI_API_KEY from console/.env.local.
// State: stateless. Client keeps the iteration history and passes it back
// each turn so the model has continuity context in the prompt.

import { NextRequest } from "next/server";
import { loadProfile } from "@/lib/business-profile";
import { generateLogo, buildLogoPrompt } from "@/lib/openai-images";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { checkEntitlement } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type ChatMsg = { role: "user" | "assistant"; content: string };
type Body = {
  directive: string;
  history?: ChatMsg[];
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant } = await params;
  if (tenant === MASTER_SLUG) {
    return Response.json({ error: "Pick a business first" }, { status: 400 });
  }
  const t = await resolveTenant(tenant);
  if (!t) return Response.json({ error: `Unknown tenant: ${tenant}` }, { status: 404 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const directive = String(body.directive ?? "").trim();
  if (!directive) return Response.json({ error: "directive required" }, { status: 400 });

  // Entitlement gate. OSS default = always allow. Hosted SaaS = per-plan
  // metering via COMMERCIAL_ENTITLEMENTS_MODULE (see lib/entitlements.ts).
  const gate = await checkEntitlement("ai.logo_generate", { tenant });
  if (!gate.ok) {
    return Response.json(
      { error: gate.reason, upgrade_url: gate.upgrade_url },
      { status: 402 },
    );
  }

  const profile = (await loadProfile(tenant).catch(() => null)) ?? {};
  const prompt = buildLogoPrompt({
    displayName: (profile.identity?.display_name as string) ?? t.name,
    legalName: profile.identity?.legal_name as string | undefined,
    tagline: profile.brand?.tagline as string | undefined,
    primaryColor: profile.brand?.primary_color as string | undefined,
    secondaryColor: profile.brand?.secondary_color as string | undefined,
    accentColor: profile.brand?.accent_color as string | undefined,
    voice: profile.copy?.voice_notes as string | undefined,
    offer: profile.offer?.one_liner as string | undefined,
    history: Array.isArray(body.history) ? body.history : [],
    directive,
  });

  try {
    const { b64 } = await generateLogo({
      prompt,
      size: body.size,
      quality: body.quality,
    });
    return Response.json({ b64, prompt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
