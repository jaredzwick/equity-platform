// DealMap — static OSM embed centered on the deal's geocoded coords.
// Uses openstreetmap.org/export/embed.html so we don't need a Mapbox
// token or Google Maps JS SDK; the iframe is cacheable and the layer
// is CC-BY-SA. For SMB deals this is the "see the area" cue; for
// online businesses we never render it (no lat/lng on the row).
export function DealMap({
  lat,
  lng,
  address,
}: {
  lat: number;
  lng: number;
  address?: string;
}) {
  // ~0.015 degrees ≈ 1.6 km each side — tight enough to recognize the
  // block, wide enough to show nearby cross-streets.
  const span = 0.015;
  const bbox = [lng - span, lat - span, lng + span, lat + span].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox,
  )}&layer=mapnik&marker=${lat},${lng}`;
  const detailHref = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <iframe
        src={src}
        title={address ? `Map of ${address}` : "Deal location map"}
        loading="lazy"
        className="h-72 w-full border-0"
        referrerPolicy="no-referrer"
      />
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-white/60">
        <span>📍 {address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</span>
        <a
          href={detailHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-yellow-200"
        >
          Open in OpenStreetMap ↗
        </a>
      </div>
    </section>
  );
}
