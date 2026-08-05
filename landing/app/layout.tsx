import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import "./globals.css";

// www is canonical — Vercel 308-redirects apex → www by default. Indexing API
// rejects redirected URLs ("Failed to verify the URL ownership"), so every
// generated URL (metadata, JSON-LD, sitemap, OG image, IndexNow ping) sticks
// to www. Same pattern as CJS uses for www.careerjumpship.com.
const SITE_URL = "https://www.lamboapp.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LamboApp — Acquire cash-flowing SMBs (not meme stocks)",
    template: "%s · LamboApp",
  },
  description:
    "LamboApp screens ~100 businesses for sale every day across 30+ brokers. Claude reads every listing, flags the scams, scores the winners, hands you a 1-paragraph thesis. Stop yolo'ing SPY puts. Start acquiring cash-flowing SMBs at 3x SDE.",
  keywords: [
    "businesses for sale",
    "acquisition entrepreneur",
    "search fund",
    "SMB acquisition",
    "SDE multiple",
    "buy a business",
    "BizBuySell",
    "Flippa",
    "Empire Flippers",
    "Quiet Light",
    "deal sourcing",
    "M&A screening",
    "AI due diligence",
    "cash flow business",
    "roll-up",
    "holdco",
    "ETA",
    "microacquisition",
    // Sell-side keywords (2026-08-04, /sell page). Distinct intent
    // universe from the buyer keywords above — targets business owners
    // searching "sell my business" and adjacent phrases.
    "sell your business",
    "list business for sale",
    "sell online business",
    "sell SaaS",
    "sell ecommerce business",
    "business for sale by owner",
    "post business for sale",
    "business broker alternative",
  ],
  authors: [{ name: "Pypes LLC" }],
  creator: "Pypes LLC",
  publisher: "Pypes LLC",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: "LamboApp",
    title: "LamboApp — Acquire cash-flowing SMBs (not meme stocks)",
    description:
      "Businesses for sale, read by Claude, ranked by fit. ~100 listings a day from 30+ brokers. Every deal gets a thesis + red flags. When lambo? Now.",
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@lamboapp",
    creator: "@lamboapp",
    title: "LamboApp — Acquire cash-flowing SMBs (not meme stocks)",
    description:
      "Stop yolo'ing SPY puts. Start acquiring SMBs at 3x SDE. AI screens 100 deals/day, flags the scams, scores the winners.",
  },
  category: "finance",
  applicationName: "LamboApp",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "LamboApp",
  url: SITE_URL,
  logo: `${SITE_URL}/icon.svg`,
  description:
    "AI-powered deal sourcing for acquisition entrepreneurs. Screens ~100 businesses for sale daily across 30+ brokers.",
  sameAs: ["https://github.com/jaredzwick/equity-platform"],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "LamboApp",
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/deal/{search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession().catch(() => null);
  const login = session?.login;
  const avatar = session?.avatarUrl;

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col overflow-x-hidden">
        <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl supports-[backdrop-filter]:bg-black/30">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-white">
              <LogoMark />
              <span className="bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-lg italic text-transparent">
                LAMBOAPP
              </span>
            </Link>
            <nav className="hidden items-center gap-1 text-sm text-white/60 md:flex">
              <Link href="/#how" className="rounded-md px-3 py-1.5 hover:bg-white/5 hover:text-white">How it works</Link>
              <Link href="/sell" className="rounded-md px-3 py-1.5 text-yellow-300/80 hover:bg-white/5 hover:text-yellow-200">Sell $7</Link>
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
                    className="hidden items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-black shadow-lg shadow-orange-500/30 transition hover:shadow-orange-500/60 sm:inline-flex"
                  >
                    Continue printing
                  </Link>
                  {avatar ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatar} alt={login} className="h-8 w-8 rounded-full ring-2 ring-yellow-400/40" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-white/10" />
                  )}
                </>
              ) : (
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-black shadow-lg transition hover:shadow-orange-500/60"
                >
                  Sign up
                </Link>
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
                  <span className="bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 bg-clip-text font-bold italic text-transparent">
                    LAMBOAPP
                  </span>
                </div>
                <p className="mt-2 max-w-sm text-sm text-white/50">
                  Businesses for sale. Read by Claude. Ranked by fit. Ready to wire.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-3 md:gap-14">
                <FooterCol
                  title="Product"
                  links={[
                    ["How it works", "/#how"],
                    ["Docs", "/docs"],
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
                    ["Not financial advice", "/docs/disclaimer"],
                    ["Licensing (BSL 1.1)", "/docs/licensing"],
                    ["Commercial boundary", "https://github.com/jaredzwick/equity-platform/blob/main/COMMERCIAL_BOUNDARY.md"],
                  ]}
                />
              </div>
            </div>
            <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/5 pt-6 text-xs text-white/40 md:flex-row md:items-center">
              <div>© 2026 Pypes LLC · BSL 1.1 · Auto-converts to Apache 2.0 on 2030-08-03</div>
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
      <div className="absolute inset-0 rounded-md bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500" />
      <div className="absolute inset-[3px] rounded-[5px] bg-black/70 backdrop-blur" />
      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black italic text-white">
        L
      </div>
    </div>
  );
}
