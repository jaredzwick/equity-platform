import { notFound } from "next/navigation";
import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { isConfigured } from "@/lib/github";
import { loadProfile } from "@/lib/business-profile";
import LogoStudio from "./LogoStudio";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ error?: string; warn?: string }>;
};

export default async function LogoPage({ params, searchParams }: Props) {
  const { tenant: slug } = await params;
  const { error, warn } = await searchParams;
  if (slug === MASTER_SLUG) notFound();

  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const configured = isConfigured();
  const profile = configured ? await loadProfile(slug).catch(() => null) : null;

  const currentLogoUrl = (profile?.brand?.logo_url as string | undefined) ?? null;
  const displayName = (profile?.identity?.display_name as string | undefined) ?? tenant.name;
  const openaiConfigured = !!process.env.OPENAI_API_KEY;

  return (
    <div className="max-w-6xl">
      <div className="mb-4 text-sm text-[color:var(--color-muted)]">
        Iterative logo studio for <span className="text-[color:var(--color-fg)]">{displayName}</span>.
        Each accepted logo commits <code className="text-xs">businesses/{slug}/logo.png</code> and
        updates <code className="text-xs">brand.logo_url</code> in the profile.
      </div>

      {!openaiConfigured && (
        <div className="mb-4 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm text-amber-100">
          <div className="font-semibold mb-1">OpenAI not configured</div>
          Set <code>OPENAI_API_KEY</code> in <code>console/.env.local</code> and restart{" "}
          <code>npm run dev</code>.
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 border border-red-500/40 rounded-lg bg-red-950/80 text-sm text-red-200">
          {error}
        </div>
      )}
      {warn && (
        <div className="mb-4 p-4 border border-amber-500/40 rounded-lg bg-amber-950/80 text-sm text-amber-200">
          {warn}
        </div>
      )}

      <LogoStudio
        tenantSlug={slug}
        tenantName={displayName}
        currentLogoUrl={currentLogoUrl}
        disabled={!openaiConfigured || !configured}
      />
    </div>
  );
}
