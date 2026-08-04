import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "equity-platform — Run every business on one Kubernetes platform",
  description:
    "Boot a multi-tenant Kubernetes stack for every business you own with one command. GitOps by default. Console-driven. Local in 3 minutes.",
  openGraph: {
    title: "equity-platform",
    description:
      "One-command Kubernetes for running many businesses on shared infra.",
    type: "website",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  const login = session?.login;
  const avatar = session?.avatarUrl;

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col overflow-x-hidden">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl supports-[backdrop-filter]:bg-black/30">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
              <LogoMark />
              <span>equity-platform</span>
            </Link>
            <nav className="hidden items-center gap-1 text-sm text-white/60 md:flex">
              <Link href="/#how" className="rounded-md px-3 py-1.5 hover:bg-white/5 hover:text-white">How it works</Link>
              <Link href="/docs" className="rounded-md px-3 py-1.5 hover:bg-white/5 hover:text-white">Docs</Link>
              <a
                href="https://github.com/jaredzwick/equity-platform"
                className="rounded-md px-3 py-1.5 hover:bg-white/5 hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
            </nav>
            <div className="flex items-center gap-3">
              {login ? (
                <>
                  <Link
                    href="/onboarding"
                    className="hidden items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:shadow-indigo-500/40 sm:inline-flex"
                  >
                    Continue setup
                  </Link>
                  {avatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatar} alt={login} className="h-8 w-8 rounded-full ring-2 ring-white/10" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-white/10" />
                  )}
                </>
              ) : (
                <a
                  href="/api/auth/login"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black shadow-lg transition hover:bg-white/90"
                >
                  Sign in
                </a>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 pt-[57px]">{children}</main>

        <footer className="mt-16 border-t border-white/[0.06] bg-black/40 backdrop-blur">
          <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-2 text-white">
                  <LogoMark />
                  <span className="font-semibold">equity-platform</span>
                </div>
                <p className="mt-2 max-w-sm text-sm text-white/50">
                  One-command Kubernetes platform for the sub-agency model.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-3 md:gap-14">
                <FooterCol
                  title="Product"
                  links={[
                    ["Docs", "/docs"],
                    ["How it works", "/#how"],
                  ]}
                />
                <FooterCol
                  title="Source"
                  links={[
                    ["GitHub", "https://github.com/jaredzwick/equity-platform"],
                    ["License (BSL 1.1)", "https://github.com/jaredzwick/equity-platform/blob/main/LICENSE"],
                  ]}
                />
                <FooterCol
                  title="Legal"
                  links={[
                    ["Commercial boundary", "https://github.com/jaredzwick/equity-platform/blob/main/COMMERCIAL_BOUNDARY.md"],
                  ]}
                />
              </div>
            </div>
            <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/5 pt-6 text-xs text-white/40 md:flex-row md:items-center">
              <div>© 2026 Pypes LLC · BSL 1.1 · Auto-converts to Apache 2.0 on 2030-08-03</div>
              <div>Built with Next.js 15 · Deployed on Vercel</div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-widest text-white/40">{title}</div>
      <ul className="mt-3 space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <a
              href={href}
              className="text-white/70 hover:text-white"
              {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LogoMark() {
  return (
    <div className="relative h-6 w-6">
      <div className="absolute inset-0 rounded-md bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-cyan-400" />
      <div className="absolute inset-[3px] rounded-[5px] bg-black/70 backdrop-blur" />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
        eq
      </div>
    </div>
  );
}
