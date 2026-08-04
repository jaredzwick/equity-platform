"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/master", label: "Businesses", exact: true },
  { href: "/master/aggregate", label: "Aggregate observability", exact: false },
  { href: "/master/email", label: "Email", exact: false },
  { href: "/master/settings", label: "Agency settings", exact: false },
];

export default function MasterTabs() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 text-sm">
      {tabs.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "px-3 py-1.5 rounded " +
              (active
                ? "bg-white/10 text-[color:var(--color-fg)]"
                : "hover:bg-white/5 text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
