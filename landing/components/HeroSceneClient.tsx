"use client";

import dynamic from "next/dynamic";

// Client-side dynamic import so Three.js only loads in the browser.
// Server Components can't use `ssr: false` on next/dynamic.
const HeroScene = dynamic(() => import("@/components/HeroScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#05060f]" />,
});

export default function HeroSceneClient() {
  return <HeroScene />;
}
