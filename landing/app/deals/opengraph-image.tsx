import { ImageResponse } from "next/og";

// Deals index OG/Twitter card. Next.js file-based metadata convention:
// this file becomes the automatic og:image for /deals, overriding the
// root landing-page OG so shares of the deals index carry deals-specific
// framing instead of the top-of-funnel hook.
//
// Layered absolute-position gradient divs, not a stacked `background`
// string — satori silently returns an empty image when radial gradients
// are stacked in one CSS shorthand on Vercel edge. Same lesson as the
// root opengraph-image.tsx.
export const runtime = "edge";
export const alt =
  "LamboApp Deal Flow — cash-flowing SMB listings, updated hourly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
        {/* Layered glows — same pattern as root OG. */}
        <div
          style={{
            position: "absolute",
            top: -240,
            left: -240,
            width: 720,
            height: 720,
            background:
              "radial-gradient(circle, rgba(250,204,21,0.35) 0%, transparent 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -260,
            right: -220,
            width: 760,
            height: 760,
            background:
              "radial-gradient(circle, rgba(239,68,68,0.30) 0%, transparent 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 200,
            right: 100,
            width: 380,
            height: 380,
            background:
              "radial-gradient(circle, rgba(249,115,22,0.20) 0%, transparent 65%)",
          }}
        />

        {/* Header: logo mark + wordmark + section pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            zIndex: 1,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background:
                "linear-gradient(135deg,#facc15,#f97316,#ef4444)",
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginLeft: 12,
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid rgba(250,204,21,0.3)",
              backgroundColor: "rgba(250,204,21,0.06)",
              color: "rgba(254,240,138,0.9)",
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: "#eab308",
              }}
            />
            DEAL FLOW · LIVE
          </div>
        </div>

        {/* Hook — bold two-line claim, then subtext */}
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
              fontSize: 82,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -2,
              maxWidth: 1040,
              color: "white",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Every SMB listing scored.</span>
            <span style={{ color: "#fb923c" }}>Every scam flagged.</span>
          </div>
          <div
            style={{
              fontSize: 28,
              color: "rgba(255,255,255,0.75)",
              maxWidth: 980,
              lineHeight: 1.35,
            }}
          >
            Live search across ~100 new listings/day from 30+ brokers.
            Filter by industry, revenue, SDE multiple, and fit score.
            Free to browse.
          </div>
        </div>

        {/* Footer — WSB tone + deep URL */}
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
          <div
            style={{
              fontWeight: 600,
              color: "rgba(255,255,255,0.75)",
            }}
          >
            www.lamboapp.com/deals
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
