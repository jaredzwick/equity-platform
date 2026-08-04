import { notFound } from "next/navigation";
import { resolveTenant } from "@/lib/tenants";
import { loadProfile } from "@/lib/business-profile";
import TenantTabs from "./TenantTabs";

type Props = { children: React.ReactNode; params: Promise<{ tenant: string }> };

export default async function TenantLayout({ children, params }: Props) {
  const { tenant: slug } = await params;
  // "master" is served by app/master/*, not this dynamic route. If Next
  // ever routes it here (shouldn't — static routes win), refuse.
  if (slug === "master") notFound();
  const tenant = await resolveTenant(slug);
  if (!tenant || tenant.slug === "master") notFound();

  // Best-effort profile load for the nav logo. Never fail the layout on it.
  const profile = await loadProfile(slug).catch(() => null);
  const logoUrl = (profile?.brand?.logo_url as string | undefined) ?? null;
  const displayName = (profile?.identity?.display_name as string | undefined) ?? tenant.name;

  const tabs = [
    { href: `/${slug}`, label: "Overview" },
    { href: `/${slug}/profile`, label: "Profile" },
    { href: `/${slug}/logo`, label: "Logo" },
    { href: `/${slug}/apps`, label: "Apps" },
    { href: `/${slug}/cron`, label: "Cron" },
    { href: `/${slug}/email`, label: "Email" },
    { href: `/${slug}/events`, label: "Events" },
    { href: `/${slug}/chat`, label: "Chat" },
    { href: `/${slug}/history`, label: "History" },
  ];

  return (
    <div>
      <header className="mb-6 border-b border-[color:var(--color-border)] pb-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // Logos are generated on WHITE backgrounds by default (see the
            // prompt in lib/openai-images.ts). The console UI is dark, so we
            // flip luminance without shifting hues — a black mark on white
            // becomes white on the dark nav; a colored mark keeps its hue.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${displayName} logo`}
              className="w-9 h-9 rounded object-contain"
              style={{ filter: "invert(1) hue-rotate(180deg)" }}
            />
          ) : (
            <div
              aria-hidden
              className="w-9 h-9 rounded bg-white/5 border border-[color:var(--color-border)] flex items-center justify-center text-xs font-semibold text-[color:var(--color-muted)]"
            >
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold">{displayName}</h1>
            <span className="text-xs text-[color:var(--color-muted)] font-mono">
              {tenant.namespaces.length > 0 ? tenant.namespaces.join(", ") : "no namespaces"}
            </span>
          </div>
        </div>
        <TenantTabs tabs={tabs} />
      </header>
      {children}
    </div>
  );
}
