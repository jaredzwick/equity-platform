import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  // Pin the tracing root to this app. Without it, Next.js walks up
  // to /Users/jared/package-lock.json and traces files from ~/ —
  // causing MODULE_NOT_FOUND at runtime for iron-session's transitive
  // vendor chunks (iron-webcrypto). Producing 500s on every route
  // that touches the session.
  outputFileTracingRoot: path.join(__dirname),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default config;
