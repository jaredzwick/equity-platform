"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string };

export default function TenantTabs({ tabs }: { tabs: Tab[] }) {
  const path = usePathname();
  // Match longest prefix — /pypes/apps/new should highlight the Apps tab
  const active = tabs
    .slice()
    .sort((a, b) => b.href.length - a.href.length)
    .find((t) => path === t.href || path.startsWith(t.href + "/"));

  return (
    <nav className="mt-4 flex gap-1 text-sm">
      {tabs.map((t) => {
        const isActive = active?.href === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "px-3 py-1.5 rounded transition-colors " +
              (isActive
                ? "bg-white/10 text-[color:var(--color-fg)]"
                : "text-[color:var(--color-muted)] hover:bg-white/5 hover:text-[color:var(--color-fg)]")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
