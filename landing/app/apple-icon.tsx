import { ImageResponse } from "next/og";

// Apple touch icon — iOS home-screen bookmark icon. Auto-injects
// <link rel="apple-touch-icon" ...> via Next.js file convention.
// 180x180 is Apple's current recommended size.
export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg,#facc15,#f97316,#ef4444)",
          fontSize: 128,
          fontWeight: 900,
          fontStyle: "italic",
          color: "black",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        L
      </div>
    ),
    { ...size },
  );
}
