"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { DealFiltersState, DealsSort } from "@/lib/deals-shared";
import { INDUSTRY_CHIPS } from "@/lib/deals-shared";

// DealFilters — client-side filter panel. Writes changes back to the
// URL so bookmarking + browser-back work naturally and the RSC re-fetches
// on nav. Follows Flippa's model: filters are FREE for everyone (unauth
// too) — that's the value prop that keeps PE buyers browsing.
//
// Layout: two rows.
//   Row 1 (always visible): sort + q + industries multi-select + origin toggle
//   Row 2 (More filters disclosure): asking / revenue / profit ranges,
//     SDE multiple cap, min business age, location.
export function DealFilters({
  initial,
}: {
  initial: DealFiltersState;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [showMore, setShowMore] = useState(hasAdvancedFilters(initial));

  // push mutates the URL params + resets page to 1 for any non-page change.
  const push = useCallback(
    (mutate: (usp: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete("page"); // any filter change → back to page 1
      const qs = next.toString();
      startTransition(() => {
        router.push(qs ? `/deals?${qs}` : "/deals", { scroll: false });
      });
    },
    [params, router],
  );

  const toggleIndustry = (industry: string) => {
    push((usp) => {
      const cur = (usp.get("industries") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const idx = cur.indexOf(industry);
      const next = idx >= 0 ? cur.filter((_, i) => i !== idx) : [...cur, industry];
      if (next.length === 0) usp.delete("industries");
      else usp.set("industries", next.join(","));
    });
  };

  const toggleOrigin = (origin: "online" | "smb") => {
    push((usp) => {
      const cur = (usp.get("origins") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const idx = cur.indexOf(origin);
      const next = idx >= 0 ? cur.filter((_, i) => i !== idx) : [...cur, origin];
      if (next.length === 0) usp.delete("origins");
      else usp.set("origins", next.join(","));
    });
  };

  const setNum = (key: string) => (val: string) => {
    push((usp) => {
      const trimmed = val.trim();
      if (!trimmed) usp.delete(key);
      else {
        const n = Number(trimmed);
        if (Number.isFinite(n) && n >= 0) usp.set(key, String(n));
      }
    });
  };

  const setStr = (key: string) => (val: string) => {
    push((usp) => {
      const trimmed = val.trim();
      if (!trimmed) usp.delete(key);
      else usp.set(key, trimmed);
    });
  };

  const clearAll = () => {
    startTransition(() => {
      router.push("/deals", { scroll: false });
    });
  };

  const activeIndustries = new Set(initial.industries ?? []);
  const activeOrigins = new Set(initial.origins ?? []);
  const hasAnyFilter = anyFilterActive(initial);

  return (
    <div
      className={`space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur ${
        pending ? "opacity-70" : ""
      }`}
    >
      {/* Row 1 — always visible */}
      <div className="flex flex-wrap items-center gap-3">
        <SortSelect
          value={initial.sort ?? "fit"}
          onChange={(v) => push((usp) => usp.set("sort", v))}
        />
        <input
          type="search"
          placeholder="Search name or thesis…"
          defaultValue={initial.q ?? ""}
          onKeyDown={(e) => {
            if (e.key === "Enter") setStr("q")((e.target as HTMLInputElement).value);
          }}
          onBlur={(e) => setStr("q")(e.target.value)}
          className="flex-1 min-w-[200px] rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-yellow-400/60 focus:outline-none"
        />
        <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          <OriginPill
            label="Online"
            active={activeOrigins.has("online")}
            onClick={() => toggleOrigin("online")}
          />
          <OriginPill
            label="SMB"
            active={activeOrigins.has("smb")}
            onClick={() => toggleOrigin("smb")}
          />
        </div>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold uppercase tracking-wider text-white/50 hover:text-white"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Industry chips */}
      <div className="flex flex-wrap gap-1.5">
        {INDUSTRY_CHIPS.map((chip) => {
          const active = activeIndustries.has(chip.value);
          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => toggleIndustry(chip.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-300"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:text-white"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* More filters disclosure */}
      <div>
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="text-xs font-semibold uppercase tracking-wider text-white/50 hover:text-white"
        >
          {showMore ? "− Less" : "+ More filters"}
        </button>
        {showMore && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <RangeInput
              label="Asking $ min"
              defaultValue={initial.asking_min}
              onCommit={setNum("asking_min")}
            />
            <RangeInput
              label="Asking $ max"
              defaultValue={initial.asking_max}
              onCommit={setNum("asking_max")}
            />
            <RangeInput
              label="Revenue $ min"
              defaultValue={initial.revenue_min}
              onCommit={setNum("revenue_min")}
            />
            <RangeInput
              label="Revenue $ max"
              defaultValue={initial.revenue_max}
              onCommit={setNum("revenue_max")}
            />
            <RangeInput
              label="Profit $ min"
              defaultValue={initial.profit_min}
              onCommit={setNum("profit_min")}
            />
            <RangeInput
              label="Profit $ max"
              defaultValue={initial.profit_max}
              onCommit={setNum("profit_max")}
            />
            <RangeInput
              label="Max SDE ×"
              defaultValue={initial.sde_multiple_max}
              onCommit={setNum("sde_multiple_max")}
              step="0.1"
            />
            <RangeInput
              label="Min age (yrs)"
              defaultValue={initial.min_business_age_years}
              onCommit={setNum("min_business_age_years")}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: DealsSort;
  onChange: (v: DealsSort) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-white/60">
      <span className="uppercase tracking-wider">Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DealsSort)}
        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-yellow-400/60 focus:outline-none"
      >
        <option value="fit">Best fit</option>
        <option value="newest">Newest</option>
        <option value="asking_asc">Asking $ low→high</option>
        <option value="asking_desc">Asking $ high→low</option>
        <option value="rev_desc">Revenue high→low</option>
      </select>
    </label>
  );
}

function OriginPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
        active
          ? "bg-yellow-400 text-black"
          : "text-white/60 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

function RangeInput({
  label,
  defaultValue,
  onCommit,
  step,
}: {
  label: string;
  defaultValue: number | undefined;
  onCommit: (v: string) => void;
  step?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-white/50">
      <span className="uppercase tracking-wider">{label}</span>
      <input
        type="number"
        min="0"
        step={step ?? "1"}
        defaultValue={defaultValue ?? ""}
        onKeyDown={(e) => {
          if (e.key === "Enter") onCommit((e.target as HTMLInputElement).value);
        }}
        onBlur={(e) => onCommit(e.target.value)}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-yellow-400/60 focus:outline-none"
      />
    </label>
  );
}

// hasAdvancedFilters: any range/geo filter set on load → expand "More" by default.
function hasAdvancedFilters(f: DealFiltersState): boolean {
  return (
    f.asking_min !== undefined ||
    f.asking_max !== undefined ||
    f.revenue_min !== undefined ||
    f.revenue_max !== undefined ||
    f.profit_min !== undefined ||
    f.profit_max !== undefined ||
    f.sde_multiple_max !== undefined ||
    f.min_business_age_years !== undefined ||
    (f.locations?.length ?? 0) > 0
  );
}

function anyFilterActive(f: DealFiltersState): boolean {
  return (
    Boolean(f.q) ||
    (f.industries?.length ?? 0) > 0 ||
    (f.origins?.length ?? 0) > 0 ||
    Boolean(f.sort) ||
    hasAdvancedFilters(f)
  );
}
