import type { NextConfig } from "next";

const config: NextConfig = {
  // Allow embedding Grafana panels via iframe. Grafana URL comes from env.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-src 'self' http://localhost:3000 http://prom-stack-grafana.monitoring.svc.cluster.local *.grafana.net;" },
        ],
      },
    ];
  },
  // The console runs server-side k8s API calls; @kubernetes/client-node
  // is server-only.
  serverExternalPackages: ["@kubernetes/client-node"],
  // Logo studio POSTs base64 PNGs to a Server Action — gpt-image-1 outputs
  // can be 2–4 MB. Bump above the 1 MB default. Cap at 10 MB to keep abuse
  // within reason.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default config;
