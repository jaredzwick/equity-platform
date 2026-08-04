import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LamboApp — Acquire cash-flowing SMBs (not meme stocks)";
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
          padding: "80px",
          background:
            "radial-gradient(circle at 20% 20%, rgba(250,204,21,0.35) 0%, transparent 55%), radial-gradient(circle at 80% 90%, rgba(239,68,68,0.35) 0%, transparent 60%), #0a0a0a",
          color: "white",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "linear-gradient(135deg,#facc15,#f97316,#ef4444)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontStyle: "italic",
              fontSize: 28,
              color: "black",
            }}
          >
            L
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 900,
              fontStyle: "italic",
              background: "linear-gradient(90deg,#fde047,#fb923c,#ef4444)",
              backgroundClip: "text",
              color: "transparent",
              letterSpacing: -1,
            }}
          >
            LAMBOAPP
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1040,
            }}
          >
            Stop yolo&rsquo;ing SPY puts.{" "}
            <span
              style={{
                background: "linear-gradient(90deg,#fde047,#fb923c,#ef4444)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              Start acquiring cash-flowing SMBs.
            </span>
          </div>
          <div style={{ fontSize: 26, color: "rgba(255,255,255,0.7)", maxWidth: 960 }}>
            AI screens ~100 businesses for sale daily across 30+ brokers. Every deal
            gets a fit score, a thesis, and a red-flag list.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 20,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          <div>🏎️ · 💎🙌 · When lambo?</div>
          <div>www.lamboapp.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
