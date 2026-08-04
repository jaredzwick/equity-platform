import { ImageResponse } from "next/og";

// Root OG/Twitter card image. Next.js file-based metadata convention:
// the exported alt/size/contentType auto-populate the corresponding
// og:image:* and twitter:image:* tags in <head>.
export const runtime = "edge";
export const alt = "LamboApp — Acquire cash-flowing SMBs (not meme stocks)";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Rewritten from a previous version that stacked two radial-gradients
// inside a single `background` CSS string — satori silently returned an
// empty image on Vercel edge. Layered absolute-position divs are the
// portable pattern.
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          position: "relative",
          backgroundColor: "#0a0a0a",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Layered glows — satori supports absolute + radial per element */}
        <div
          style={{
            position: "absolute",
            top: -240,
            left: -240,
            width: 720,
            height: 720,
            background: "radial-gradient(circle, rgba(250,204,21,0.35) 0%, transparent 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -260,
            right: -220,
            width: 760,
            height: 760,
            background: "radial-gradient(circle, rgba(239,68,68,0.30) 0%, transparent 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 200,
            right: 100,
            width: 380,
            height: 380,
            background: "radial-gradient(circle, rgba(249,115,22,0.20) 0%, transparent 65%)",
          }}
        />

        {/* Header: logo mark + wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, zIndex: 1 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "linear-gradient(135deg,#facc15,#f97316,#ef4444)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontStyle: "italic",
              fontSize: 32,
              color: "black",
            }}
          >
            L
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 900,
              fontStyle: "italic",
              color: "#facc15",
              letterSpacing: -1,
            }}
          >
            LAMBOAPP
          </div>
        </div>

        {/* Hook — big claim, then subtext */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 78,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1040,
              color: "white",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Stop yolo&rsquo;ing SPY puts.</span>
            <span style={{ color: "#fb923c" }}>Start acquiring SMBs.</span>
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.75)",
              maxWidth: 980,
              lineHeight: 1.35,
            }}
          >
            AI screens ~100 businesses for sale daily across 30+ brokers.
            Every deal ships with a fit score, a thesis, and a red-flag list.
          </div>
        </div>

        {/* Footer — kaomoji tone + URL, keeps the ratio balanced */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 24,
            color: "rgba(255,255,255,0.55)",
            zIndex: 1,
          }}
        >
          <div>🏎️  ·  💎🙌  ·  When lambo?</div>
          <div style={{ fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
            www.lamboapp.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
