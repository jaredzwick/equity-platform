import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "equity-console",
  description: "One-pane visibility for the equity-platform stack",
};

const nav = [
  { href: "/", label: "Overview" },
  { href: "/apps", label: "Apps" },
  { href: "/cron", label: "Cron" },
  { href: "/email", label: "Email" },
  { href: "/events", label: "Events" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <aside className="w-56 border-r border-[color:var(--color-border)] p-6 flex flex-col gap-1">
            <div className="mb-6">
              <div className="text-lg font-semibold">equity-console</div>
              <div className="text-xs text-[color:var(--color-muted)]">v0.1</div>
            </div>
            <nav className="flex flex-col gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 rounded hover:bg-white/5 text-sm"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-8 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
