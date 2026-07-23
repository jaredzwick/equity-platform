import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveTenant } from "@/lib/tenants";

type Props = { children: React.ReactNode; params: Promise<{ tenant: string }> };

export default async function TenantLayout({ children, params }: Props) {
  const { tenant: slug } = await params;
  // "master" is served by app/master/*, not this dynamic route. If Next
  // ever routes it here (shouldn't — static routes win), refuse.
  if (slug === "master") notFound();
  const tenant = await resolveTenant(slug);
  if (!tenant || tenant.slug === "master") notFound();

  const tabs = [
    { href: `/${slug}`, label: "Overview" },
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
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold">{tenant.name}</h1>
          <span className="text-xs text-[color:var(--color-muted)] font-mono">
            {tenant.namespaces.length > 0 ? tenant.namespaces.join(", ") : "no namespaces"}
          </span>
        </div>
        <nav className="mt-4 flex gap-1 text-sm">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="px-3 py-1.5 rounded hover:bg-white/5 text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
