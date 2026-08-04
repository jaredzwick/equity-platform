import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "equity-platform",
  description: "One-command Kubernetes platform for the sub-agency model. Fork the repo, boot locally in 3 min.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  const login = session?.login;

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-[color:var(--color-border)]">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight">
              equity-platform
            </Link>
            <nav className="flex items-center gap-6 text-sm text-[color:var(--color-muted)]">
              <Link href="/docs" className="hover:text-[color:var(--color-fg)]">Docs</Link>
              <a
                href="https://github.com/jaredzwick/equity-platform"
                className="hover:text-[color:var(--color-fg)]"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              {login ? (
                <Link
                  href="/onboarding"
                  className="rounded-md bg-[color:var(--color-accent)] px-3 py-1.5 text-white hover:opacity-90"
                >
                  Continue setup
                </Link>
              ) : (
                <a
                  href="/api/auth/login"
                  className="rounded-md bg-[color:var(--color-accent)] px-3 py-1.5 text-white hover:opacity-90"
                >
                  Sign in with GitHub
                </a>
              )}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[color:var(--color-border)] py-6 text-center text-xs text-[color:var(--color-muted)]">
          BSL 1.1 · © 2026 Pypes LLC
        </footer>
      </body>
    </html>
  );
}
