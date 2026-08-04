// Shared display formatters for the deals browse UI. All safe on the
// client (no server-only import). Every fn returns "" or a placeholder
// when the value is missing / zero so the caller can conditionally
// render (`{price && <span>{price}</span>}`) instead of showing "$0"
// for un-populated fields.

// fmtMoney: $2.5M / $500K / $999. Returns "" when v <= 0 (missing).
export function fmtMoney(v: number | undefined | null): string {
  if (v == null || v <= 0) return "";
  if (v >= 1_000_000) {
    return v === Math.floor(v / 1_000_000) * 1_000_000
      ? `$${(v / 1_000_000).toFixed(0)}M`
      : `$${(v / 1_000_000).toFixed(1)}M`;
  }
  if (v >= 1_000) {
    return v === Math.floor(v / 1_000) * 1_000
      ? `$${(v / 1_000).toFixed(0)}K`
      : `$${(v / 1_000).toFixed(1)}K`;
  }
  return `$${v.toFixed(0)}`;
}

// fmtMultiple: "3.2x" or "" when missing.
export function fmtMultiple(v: number | undefined | null): string {
  if (v == null || v <= 0) return "";
  return `${v.toFixed(1)}x`;
}

// fmtFitScore: "8.4" or "" when un-enriched.
export function fmtFitScore(v: number | undefined | null): string {
  if (v == null || v <= 0) return "";
  return v.toFixed(1);
}

// fmtCount: "1.2k" / "234" for large-number displays (result totals).
export function fmtCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

// daysSince: rough "New" / "3d ago" indicator. Unix seconds in.
export function daysSince(unixSeconds: number): number {
  if (!unixSeconds) return Infinity;
  const nowSec = Date.now() / 1000;
  return Math.max(0, Math.floor((nowSec - unixSeconds) / 86400));
}
