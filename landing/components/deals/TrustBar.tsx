// TrustBar — thin top strip under the breadcrumb that tells the
// visitor where the listing originally came from and when we last
// pulled it. Positions us honestly as an aggregator, not the seller.
export function TrustBar({
  source,
  sourceUrl,
  publishedAt,
}: {
  source: string;
  sourceUrl?: string;
  publishedAt?: number;
}) {
  const dateLabel = publishedAt
    ? new Date(publishedAt * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/50">
      <span>
        Ingested from <span className="text-white/80">{source}</span>
      </span>
      {dateLabel && (
        <>
          <span className="text-white/20">·</span>
          <span>{dateLabel}</span>
        </>
      )}
      {sourceUrl && (
        <>
          <span className="text-white/20">·</span>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener nofollow noreferrer"
            className="underline underline-offset-4 hover:text-yellow-200"
          >
            View original listing ↗
          </a>
        </>
      )}
    </div>
  );
}
