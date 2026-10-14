import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  // Allow isolating the build output directory via env — the pre-push hook
  // sets NEXT_DIST_DIR to a tempdir to avoid colliding with whatever is
  // concurrently writing to the main .next (dev server, in-cluster
  // containers bind-mounting the project dir, etc). Unset falls back to
  // the Next default (.next).
  distDir: process.env.NEXT_DIST_DIR || ".next",
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
