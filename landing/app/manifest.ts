import type { MetadataRoute } from "next";

// PWA manifest — makes the site installable + gives Android's browser the
// right theme colors and icons for "Add to Home Screen". Also picked up by
// some search engines as a signal that the site is a real app, not a scraper.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LamboApp — Acquire cash-flowing SMBs",
    short_name: "LamboApp",
    description:
      "Businesses for sale, read by Claude, ranked by fit. ~100 listings a day from 30+ brokers.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    orientation: "portrait",
    categories: ["business", "finance", "productivity"],
    icons: [
      {
        // Next.js file-based /icon.svg served at root — reuse as PWA icon.
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        // Reuses the apple-icon route above; PWA prompts on Android use
        // this as the maskable install icon.
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
