"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { DealFiltersState, DealsSort } from "@/lib/deals-shared";
import {
  INDUSTRY_CHIPS,
  LOCATION_CHIPS,
  PRICE_BUCKET_CHIPS,
  activePriceBucketSlug,
} from "@/lib/deals-shared";
import { fmtMoney } from "@/lib/format";

// DealFilters — marketplace search + filter surface for /deals.
//
// Structure:
//   1. Hero search bar (always visible, prominent). Commits `q` on
//      Enter or blur — no debounce, per eng-review guidance: the pypes
//      endpoint has a 60/min IP limiter with burst=20 and every fetch
//      is cache: "no-store", so keystroke-rate URL pushes would trip
//      the limiter and drop us into an ErrorPanel.
//   2. Compact filter row: sort · industries · locations · origin · price.
//      On desktop everything is inline; on mobile a "Filters (N)" pill
//      opens a bottom sheet holding the same controls.
//   3. Active-filter chip strip: derived from `initial`; each chip
//      removes ITS filter; "Text me matches" pill on the right routes
//      unauth visitors to /signup with the current filter set preserved.
//
// URL is the source of truth. Every mutation goes through `push`,
// which mutates the URLSearchParams + resets page to 1. Server RSC
// re-fetches on every push (dynamic = "force-dynamic").

export function DealFilters({
  initial,
  isAuth,
}: {
  initial: DealFiltersState;
  isAuth: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedFilters(initial));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const push = useCallback(
    (mutate: (usp: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      next.delete("page");
      const qs = next.toString();
      startTransition(() => {
        router.push(qs ? `/deals?${qs}` : "/deals", { scroll: false });
      });
    },
    [params, router],
  );

  // Body-scroll lock while the mobile drawer is open. Cleared when the
  // pending transition resolves so the drawer doesn't "click through"
  // to a stale page (eng-review concern).
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (drawerOpen && !pending) {
      // filter changes have applied and the RSC has re-rendered; user
      // can now close manually. We don't auto-close because they may
      // want to stack multiple filters in one drawer session.
    }
  }, [drawerOpen, pending]);

  const toggleList = (key: string) => (value: string) => {
    push((usp) => {
      const cur = (usp.get(key) ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const idx = cur.indexOf(value);
      const next = idx >= 0 ? cur.filter((_, i) => i !== idx) : [...cur, value];
      if (next.length === 0) usp.delete(key);
      else usp.set(key, next.join(","));
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

  const setBucket = (slug: string | undefined) => {
    push((usp) => {
      usp.delete("asking_min");
      usp.delete("asking_max");
      if (!slug) return;
      const b = PRICE_BUCKET_CHIPS.find((x) => x.slug === slug);
      if (!b) return;
      if (b.min !== undefined) usp.set("asking_min", String(b.min));
      if (b.max !== undefined) usp.set("asking_max", String(b.max));
    });
  };

  const clearAll = () => {
    startTransition(() => {
      router.push("/deals", { scroll: false });
    });
  };

  const clearOne = (key: string, value?: string) => {
    push((usp) => {
      if (value === undefined) {
        usp.delete(key);
        return;
      }
      const cur = (usp.get(key) ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const next = cur.filter((v) => v !== value);
      if (next.length === 0) usp.delete(key);
      else usp.set(key, next.join(","));
    });
  };

  const clearBucket = () => {
    push((usp) => {
      usp.delete("asking_min");
      usp.delete("asking_max");
    });
  };

  const activeIndustries = new Set(initial.industries ?? []);
  const activeLocations = new Set(initial.locations ?? []);
  const activeOrigins = new Set(initial.origins ?? []);
  const activeBucket = activePriceBucketSlug(
    initial.asking_min,
    initial.asking_max,
  );
  const hasAnyFilter = anyFilterActive(initial);
  const activeCount = countActiveFilters(initial);

  // "Text me matches" preserves the current filter set through the
  // /signup flow via ?redirect_to=/deals?<current query>.
  const alertHref = useMemo(() => {
    const qs = params.toString();
    return qs
      ? `/signup?redirect_to=${encodeURIComponent(`/deals?${qs}`)}`
      : "/signup";
  }, [params]);

  return (
    <div className={pending ? "opacity-80 transition-opacity" : ""}>
      {/* Hero search bar */}
      <HeroSearch
        initialValue={initial.q}
        onCommit={setStr("q")}
        onClear={() => setStr("q")("")}
      />

      {/* Desktop filter rail */}
      <div className="mt-4 hidden gap-3 md:flex md:flex-wrap md:items-center">
        <SortSelect
          value={initial.sort ?? "fit"}
          onChange={(v) => push((usp) => usp.set("sort", v))}
        />
        <OriginToggle
          active={activeOrigins}
          onToggle={(o) => toggleList("origins")(o)}
        />
        <div className="ml-auto flex items-center gap-2">
          {hasAnyFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-semibold uppercase tracking-wider text-white/50 transition-colors hover:text-white"
            >
              Clear all
            </button>
          )}
          {!isAuth && hasAnyFilter && (
            <a
              href={alertHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/60 bg-yellow-400/10 px-3 py-1.5 text-xs font-semibold text-yellow-200 transition-colors hover:bg-yellow-400/20"
            >
              <span aria-hidden>✉</span>
              Text me matches
            </a>
          )}
        </div>
      </div>

      {/* Mobile: sort + Filters pill */}
      <div className="mt-4 flex items-center gap-2 md:hidden">
        <SortSelect
          value={initial.sort ?? "fit"}
          onChange={(v) => push((usp) => usp.set("sort", v))}
        />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white/90"
        >
          <FilterIcon />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-400 px-1.5 text-[10px] font-bold text-black">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Desktop filter surface */}
      <div className="mt-4 hidden space-y-5 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur md:block">
        <FilterSection label="Industry">
          <ChipRow>
            {INDUSTRY_CHIPS.map((chip) => (
              <Chip
                key={chip.value}
                active={activeIndustries.has(chip.value)}
                onClick={() => toggleList("industries")(chip.value)}
              >
                {chip.label}
              </Chip>
            ))}
          </ChipRow>
        </FilterSection>

        <FilterSection label="Location">
          <ChipRow>
            {LOCATION_CHIPS.map((chip) => (
              <Chip
                key={chip.value}
                active={activeLocations.has(chip.value)}
                onClick={() => toggleList("locations")(chip.value)}
              >
                {chip.label}
              </Chip>
            ))}
          </ChipRow>
          <AddLocationInput
            onAdd={(loc) => {
              if (!activeLocations.has(loc)) toggleList("locations")(loc);
            }}
          />
        </FilterSection>

        <FilterSection label="Asking price">
          <ChipRow>
            {PRICE_BUCKET_CHIPS.map((b) => (
              <Chip
                key={b.slug}
                active={activeBucket === b.slug}
                onClick={() =>
                  setBucket(activeBucket === b.slug ? undefined : b.slug)
                }
              >
                {b.label}
              </Chip>
            ))}
          </ChipRow>
        </FilterSection>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            className="text-xs font-semibold uppercase tracking-wider text-white/50 transition-colors hover:text-white"
          >
            {showAdvanced ? "− Less" : "+ Advanced filters"}
          </button>
          {showAdvanced && <AdvancedGrid initial={initial} onCommit={setNum} />}
        </div>
      </div>

      {/* Active-filter chip strip — appears below the filter surface,
          above the results. Shown on all breakpoints when anything is
          active. */}
      {hasAnyFilter && (
        <ActiveFilterStrip
          initial={initial}
          onRemoveOne={clearOne}
          onClearBucket={clearBucket}
          onClearAll={clearAll}
        />
      )}

      {/* Mobile drawer */}
      {drawerOpen && (
        <MobileDrawer
          onClose={() => setDrawerOpen(false)}
          activeCount={activeCount}
        >
          <FilterSection label="Industry">
            <ChipRow>
              {INDUSTRY_CHIPS.map((chip) => (
                <Chip
                  key={chip.value}
                  active={activeIndustries.has(chip.value)}
                  onClick={() => toggleList("industries")(chip.value)}
                >
                  {chip.label}
                </Chip>
              ))}
            </ChipRow>
          </FilterSection>

          <FilterSection label="Location">
            <ChipRow>
              {LOCATION_CHIPS.map((chip) => (
                <Chip
                  key={chip.value}
                  active={activeLocations.has(chip.value)}
                  onClick={() => toggleList("locations")(chip.value)}
                >
                  {chip.label}
                </Chip>
              ))}
            </ChipRow>
            <AddLocationInput
              onAdd={(loc) => {
                if (!activeLocations.has(loc)) toggleList("locations")(loc);
              }}
            />
          </FilterSection>

          <FilterSection label="Origin">
            <OriginToggle
              active={activeOrigins}
              onToggle={(o) => toggleList("origins")(o)}
            />
          </FilterSection>

          <FilterSection label="Asking price">
            <ChipRow>
              {PRICE_BUCKET_CHIPS.map((b) => (
                <Chip
                  key={b.slug}
                  active={activeBucket === b.slug}
                  onClick={() =>
                    setBucket(activeBucket === b.slug ? undefined : b.slug)
                  }
                >
                  {b.label}
                </Chip>
              ))}
            </ChipRow>
          </FilterSection>

          <FilterSection label="Advanced">
            <AdvancedGrid initial={initial} onCommit={setNum} />
          </FilterSection>
        </MobileDrawer>
      )}
    </div>
  );
}

// ---------- Sub-components ----------

function HeroSearch({
  initialValue,
  onCommit,
  onClear,
}: {
  initialValue?: string;
  onCommit: (v: string) => void;
  onClear: () => void;
}) {
  // Uncontrolled input so the value survives router re-renders without
  // flashing. Commit on Enter and on blur. Keeping `key` on initialValue
  // means a URL-driven reset (Clear all) actually clears the input.
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-white/40"
      >
        <SearchIcon />
      </span>
      <input
        ref={ref}
        key={initialValue ?? ""}
        type="search"
        defaultValue={initialValue ?? ""}
        placeholder="Search deals — try 'SaaS Texas', 'laundromat', 'HVAC'…"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit((e.target as HTMLInputElement).value);
          }
          if (e.key === "Escape") {
            (e.target as HTMLInputElement).value = "";
            onClear();
          }
        }}
        onBlur={(e) => {
          if ((e.target.value ?? "") !== (initialValue ?? ""))
            onCommit(e.target.value);
        }}
        aria-label="Search deals"
        className="h-14 w-full rounded-2xl border border-white/15 bg-black/40 pl-14 pr-14 text-base text-white placeholder:text-white/40 backdrop-blur transition-colors focus:border-yellow-400/60 focus:outline-none md:text-lg"
      />
      {initialValue && (
        <button
          type="button"
          onClick={() => {
            if (ref.current) ref.current.value = "";
            onClear();
          }}
          aria-label="Clear search"
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        >
          <CloseIcon />
        </button>
      )}
    </div>
  );
}

function AddLocationInput({ onAdd }: { onAdd: (loc: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <input
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const v = val.trim();
          if (v) {
            onAdd(v);
            setVal("");
          }
        }
      }}
      placeholder="Add a state, city, or country and press Enter"
      className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-yellow-400/60 focus:outline-none"
    />
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

function OriginToggle({
  active,
  onToggle,
}: {
  active: Set<string>;
  onToggle: (o: string) => void;
}) {
  return (
    <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
      {(["online", "smb"] as const).map((o) => {
        const isActive = active.has(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
              isActive
                ? "bg-yellow-400 text-black"
                : "text-white/60 hover:text-white"
            }`}
          >
            {o === "online" ? "Online" : "SMB"}
          </button>
        );
      })}
    </div>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/50">
        {label}
      </div>
      {children}
    </div>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-yellow-400/60 bg-yellow-400/10 text-yellow-200"
          : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function AdvancedGrid({
  initial,
  onCommit,
}: {
  initial: DealFiltersState;
  onCommit: (key: string) => (v: string) => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
      <NumInput
        label="Asking $ min"
        defaultValue={initial.asking_min}
        onCommit={onCommit("asking_min")}
      />
      <NumInput
        label="Asking $ max"
        defaultValue={initial.asking_max}
        onCommit={onCommit("asking_max")}
      />
      <NumInput
        label="Revenue $ min"
        defaultValue={initial.revenue_min}
        onCommit={onCommit("revenue_min")}
      />
      <NumInput
        label="Revenue $ max"
        defaultValue={initial.revenue_max}
        onCommit={onCommit("revenue_max")}
      />
      <NumInput
        label="Profit $ min"
        defaultValue={initial.profit_min}
        onCommit={onCommit("profit_min")}
      />
      <NumInput
        label="Profit $ max"
        defaultValue={initial.profit_max}
        onCommit={onCommit("profit_max")}
      />
      <NumInput
        label="Max SDE ×"
        defaultValue={initial.sde_multiple_max}
        onCommit={onCommit("sde_multiple_max")}
        step="0.1"
      />
      <NumInput
        label="Min age (yrs)"
        defaultValue={initial.min_business_age_years}
        onCommit={onCommit("min_business_age_years")}
      />
    </div>
  );
}

function NumInput({
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
        key={defaultValue ?? ""}
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

function ActiveFilterStrip({
  initial,
  onRemoveOne,
  onClearBucket,
  onClearAll,
}: {
  initial: DealFiltersState;
  onRemoveOne: (key: string, value?: string) => void;
  onClearBucket: () => void;
  onClearAll: () => void;
}) {
  const chips: { label: string; onRemove: () => void }[] = [];

  if (initial.q) {
    chips.push({
      label: `Search: "${initial.q}"`,
      onRemove: () => onRemoveOne("q"),
    });
  }
  for (const ind of initial.industries ?? []) {
    const chip = INDUSTRY_CHIPS.find((c) => c.value === ind);
    chips.push({
      label: chip?.label ?? ind,
      onRemove: () => onRemoveOne("industries", ind),
    });
  }
  for (const loc of initial.locations ?? []) {
    const chip = LOCATION_CHIPS.find((c) => c.value === loc);
    chips.push({
      label: `📍 ${chip?.label ?? loc}`,
      onRemove: () => onRemoveOne("locations", loc),
    });
  }
  for (const o of initial.origins ?? []) {
    chips.push({
      label: o === "online" ? "Online" : "SMB",
      onRemove: () => onRemoveOne("origins", o),
    });
  }
  const bucketSlug = activePriceBucketSlug(initial.asking_min, initial.asking_max);
  if (bucketSlug) {
    const b = PRICE_BUCKET_CHIPS.find((x) => x.slug === bucketSlug);
    chips.push({
      label: `Asking ${b?.label ?? ""}`,
      onRemove: onClearBucket,
    });
  } else {
    if (initial.asking_min !== undefined) {
      chips.push({
        label: `Asking ≥ ${fmtMoney(initial.asking_min)}`,
        onRemove: () => onRemoveOne("asking_min"),
      });
    }
    if (initial.asking_max !== undefined) {
      chips.push({
        label: `Asking ≤ ${fmtMoney(initial.asking_max)}`,
        onRemove: () => onRemoveOne("asking_max"),
      });
    }
  }
  if (initial.revenue_min !== undefined)
    chips.push({
      label: `Revenue ≥ ${fmtMoney(initial.revenue_min)}`,
      onRemove: () => onRemoveOne("revenue_min"),
    });
  if (initial.revenue_max !== undefined)
    chips.push({
      label: `Revenue ≤ ${fmtMoney(initial.revenue_max)}`,
      onRemove: () => onRemoveOne("revenue_max"),
    });
  if (initial.profit_min !== undefined)
    chips.push({
      label: `Profit ≥ ${fmtMoney(initial.profit_min)}`,
      onRemove: () => onRemoveOne("profit_min"),
    });
  if (initial.profit_max !== undefined)
    chips.push({
      label: `Profit ≤ ${fmtMoney(initial.profit_max)}`,
      onRemove: () => onRemoveOne("profit_max"),
    });
  if (initial.sde_multiple_max !== undefined)
    chips.push({
      label: `SDE ≤ ${initial.sde_multiple_max}×`,
      onRemove: () => onRemoveOne("sde_multiple_max"),
    });
  if (initial.min_business_age_years !== undefined)
    chips.push({
      label: `Age ≥ ${initial.min_business_age_years}y`,
      onRemove: () => onRemoveOne("min_business_age_years"),
    });

  if (chips.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] py-1 pl-3 pr-1 text-xs text-white/90"
        >
          {c.label}
          <button
            type="button"
            onClick={c.onRemove}
            aria-label={`Remove filter ${c.label}`}
            className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 text-xs font-semibold uppercase tracking-wider text-white/50 transition-colors hover:text-white"
      >
        Clear all
      </button>
    </div>
  );
}

function MobileDrawer({
  onClose,
  activeCount,
  children,
}: {
  onClose: () => void;
  activeCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-neutral-950 px-5 pb-24 pt-5">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Filter deals</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-6">{children}</div>
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-neutral-950/95 px-5 py-3 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 px-4 py-3 text-sm font-bold text-black"
          >
            Show results{activeCount > 0 ? ` (${activeCount} active)` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" d="M6 6l12 12M18 6l-12 12" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  );
}

// ---------- helpers ----------

function hasAdvancedFilters(f: DealFiltersState): boolean {
  return (
    f.revenue_min !== undefined ||
    f.revenue_max !== undefined ||
    f.profit_min !== undefined ||
    f.profit_max !== undefined ||
    f.sde_multiple_max !== undefined ||
    f.min_business_age_years !== undefined
  );
}

function anyFilterActive(f: DealFiltersState): boolean {
  return (
    Boolean(f.q) ||
    (f.industries?.length ?? 0) > 0 ||
    (f.locations?.length ?? 0) > 0 ||
    (f.origins?.length ?? 0) > 0 ||
    f.asking_min !== undefined ||
    f.asking_max !== undefined ||
    f.revenue_min !== undefined ||
    f.revenue_max !== undefined ||
    f.profit_min !== undefined ||
    f.profit_max !== undefined ||
    f.sde_multiple_max !== undefined ||
    f.min_business_age_years !== undefined
  );
}

function countActiveFilters(f: DealFiltersState): number {
  let n = 0;
  if (f.q) n++;
  n += f.industries?.length ?? 0;
  n += f.locations?.length ?? 0;
  n += f.origins?.length ?? 0;
  const bucket = activePriceBucketSlug(f.asking_min, f.asking_max);
  if (bucket) n++;
  else {
    if (f.asking_min !== undefined) n++;
    if (f.asking_max !== undefined) n++;
  }
  if (f.revenue_min !== undefined) n++;
  if (f.revenue_max !== undefined) n++;
  if (f.profit_min !== undefined) n++;
  if (f.profit_max !== undefined) n++;
  if (f.sde_multiple_max !== undefined) n++;
  if (f.min_business_age_years !== undefined) n++;
  return n;
}
