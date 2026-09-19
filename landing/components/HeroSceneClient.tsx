"use client";

import dynamic from "next/dynamic";

// Client-side dynamic import so Three.js only loads in the browser.
// Server Components can't use `ssr: false` on next/dynamic. The loading
// state paints the same radial-gradient the eventual scene converges to,
// so first paint reads as "background + subtle glow" instead of a flat
// black square that later swaps in. Kills the ~2s CLS surfaced in the
// sprint 2 audit.
const HeroScene = dynamic(() => import("@/components/HeroScene"), {
  ssr: false,
  loading: () => <HeroSceneSkeleton />,
});

function HeroSceneSkeleton() {
  return (
    <div
      className="absolute inset-0 bg-[#05060f]"
      aria-hidden
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top left, rgba(250,204,21,0.10), transparent 55%)," +
          "radial-gradient(ellipse at bottom right, rgba(239,68,68,0.08), transparent 55%)",
      }}
    />
  );
}

export default function HeroSceneClient() {
  return <HeroScene />;
}
