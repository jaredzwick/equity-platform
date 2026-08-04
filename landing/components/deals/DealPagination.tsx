"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

// DealPagination — compact numbered pager. First, last, current + one
// neighbor each side; ellipsis for gaps. URL-driven so refresh + share
// keep position. Pagination is FREE for everyone (matches Flippa) —
// nothing to gate here.
export function DealPagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const goto = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return;
    const next = new URLSearchParams(params.toString());
    if (p === 1) next.delete("page");
    else next.set("page", String(p));
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/deals?${qs}` : "/deals", { scroll: true });
    });
  };

  const pages = buildPageList(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-center gap-1 py-4 ${
        pending ? "opacity-70" : ""
      }`}
    >
      <PagerButton
        label="← Prev"
        onClick={() => goto(page - 1)}
        disabled={page <= 1}
      />
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-white/40">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => goto(p)}
            aria-current={p === page ? "page" : undefined}
            className={`min-w-[32px] rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              p === page
                ? "bg-yellow-400 text-black"
                : "border border-white/10 bg-white/5 text-white/80 hover:border-white/30 hover:text-white"
            }`}
          >
            {p}
          </button>
        ),
      )}
      <PagerButton
        label="Next →"
        onClick={() => goto(page + 1)}
        disabled={page >= totalPages}
      />
    </nav>
  );
}

function PagerButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
        disabled
          ? "cursor-not-allowed text-white/20"
          : "text-white/70 hover:border-white/30 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// buildPageList: [1, "…", 4, 5, 6, "…", 12] style output. Always shows
// first, last, current, and immediate neighbors. Collapses gaps > 1.
function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}
