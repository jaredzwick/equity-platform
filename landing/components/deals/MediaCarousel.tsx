"use client";

import { useState } from "react";

export type MediaItem = {
  type: string;
  source: string;
  url: string;
  caption?: string;
  attribution?: string;
  display_order?: number;
  width?: number;
  height?: number;
};

// MediaCarousel — hero visual block above the fold on /deal/[slug].
// Picks the lowest display_order as the hero, renders thumbnails
// underneath so the broker photo + area shots + screenshot are all
// one tap away. Falls back to a single-pane layout when only one
// image exists.
//
// Images are plain <img> (not next/image) because every URL points
// at media.lamboapp.com which the mirror worker already resized to
// a sane max dimension. Routing through next/image would require
// adding a remotePatterns entry and running the Next image optimizer
// over already-optimized content.
export function MediaCarousel({ media }: { media: MediaItem[] }) {
  const ordered = [...media].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  const [activeIdx, setActiveIdx] = useState(0);
  if (ordered.length === 0) return null;
  const active = ordered[activeIdx] ?? ordered[0];

  return (
    <section className="mt-8">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <img
          src={active.url}
          alt={active.caption || active.type}
          loading="eager"
          className="aspect-[16/9] w-full object-cover"
        />
        {(active.caption || active.attribution) && (
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 py-3 text-xs">
            <span className="text-white/85">{active.caption}</span>
            {active.attribution && (
              <span className="text-white/50">{active.attribution}</span>
            )}
          </div>
        )}
      </div>
      {ordered.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {ordered.map((m, i) => (
            <button
              key={`${m.url}-${i}`}
              type="button"
              onClick={() => setActiveIdx(i)}
              aria-label={`Show ${m.type}${m.caption ? `: ${m.caption}` : ""}`}
              aria-pressed={i === activeIdx}
              className={`shrink-0 overflow-hidden rounded-lg border transition ${
                i === activeIdx
                  ? "border-yellow-400/60"
                  : "border-white/10 hover:border-white/30"
              }`}
            >
              <img
                src={m.url}
                alt=""
                loading="lazy"
                className="h-16 w-24 object-cover opacity-90"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
