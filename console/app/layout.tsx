import type { Metadata } from "next";
import Link from "next/link";
import { discoverTenants } from "@/lib/tenants";
import SignInGitHub from "@/components/SignInGitHub";
import "./globals.css";

export const metadata: Metadata = {
  title: "equity-console",
  description: "One-pane visibility for the equity-platform stack",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tenants = await discoverTenants().catch(() => []);

  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <aside className="w-64 border-r border-[color:var(--color-border)] p-5 flex flex-col gap-6">
            <div>
              <div className="text-lg font-semibold">equity-console</div>
              <div className="text-xs text-[color:var(--color-muted)]">v0.2 · multi-tenant</div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)] mb-2 px-2">
                Businesses
              </div>
              <nav className="flex flex-col gap-0.5">
                <Link
                  href="/master"
                  className="px-3 py-2 rounded hover:bg-white/5 text-sm flex items-center justify-between"
                >
                  <span className="font-medium">Agency</span>
                  <span className="text-[10px] text-[color:var(--color-muted)]">{tenants.length}</span>
                </Link>
                {tenants.length === 0 && (
                  <div className="px-3 py-2 text-xs text-[color:var(--color-muted)]">
                    No tenants labeled yet
                  </div>
                )}
                {tenants.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/${t.slug}`}
                    className="px-3 py-2 rounded hover:bg-white/5 text-sm"
                  >
                    {t.name}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="mt-auto">
              <SignInGitHub />
            </div>
          </aside>
          <main className="flex-1 p-8 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
