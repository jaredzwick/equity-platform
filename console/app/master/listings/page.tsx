import { listSellerListings } from "@/lib/lamboapp-admin";
import ListingsTable from "./ListingsTable";

export const dynamic = "force-dynamic";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const onlyDrafts = filter === "drafts";

  let listings: Awaited<ReturnType<typeof listSellerListings>> = [];
  let error: string | null = null;
  try {
    listings = await listSellerListings({ limit: 100, onlyDrafts });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const paid = listings.filter((l) => l.paid_amount_cents && l.paid_amount_cents > 0).length;
  const draftCount = listings.filter((l) => !l.paid_amount_cents).length;
  const totalCents = listings.reduce((s, l) => s + (l.paid_amount_cents ?? 0), 0);

  return (
    <div className="space-y-6 px-6 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--color-fg)]">
            LamboApp seller listings
          </h1>
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">
            Moderation surface for the $7 /sell flow. Publishes are immediate — takedowns
            are retroactive.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <Metric label="Paid" value={String(paid)} tone="ok" />
          <Metric label="Drafts" value={String(draftCount)} tone={draftCount > 20 ? "warn" : "muted"} />
          <Metric label="Revenue (page)" value={`$${(totalCents / 100).toFixed(2)}`} />
        </div>
      </header>

      <div className="flex gap-1 text-sm">
        <FilterTab href="/master/listings" label="All (100 recent)" active={!onlyDrafts} />
        <FilterTab href="/master/listings?filter=drafts" label="Drafts only" active={onlyDrafts} />
      </div>

      {error ? (
        <div className="rounded border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-200">
          <div className="font-semibold">Failed to load listings</div>
          <div className="mt-1 font-mono text-xs">{error}</div>
          <div className="mt-2 text-xs text-red-200/70">
            Check that <code>ADMIN_LAMBOAPP_TOKEN</code> and <code>PYPES_API_URL</code> are
            set in console env, and that the pypes deploy is up.
          </div>
        </div>
      ) : listings.length === 0 ? (
        <div className="rounded border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-[color:var(--color-muted)]">
          No {onlyDrafts ? "drafts" : "listings"} yet.
        </div>
      ) : (
        <ListingsTable listings={listings} />
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "muted" }) {
  const color =
    tone === "ok"
      ? "text-green-400"
      : tone === "warn"
        ? "text-yellow-400"
        : "text-[color:var(--color-fg)]";
  return (
    <div className="flex flex-col">
      <span className="text-xs text-[color:var(--color-muted)]">{label}</span>
      <span className={"font-mono text-lg font-semibold " + color}>{value}</span>
    </div>
  );
}

function FilterTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={
        "rounded px-3 py-1.5 " +
        (active
          ? "bg-white/10 text-[color:var(--color-fg)]"
          : "text-[color:var(--color-muted)] hover:bg-white/5 hover:text-[color:var(--color-fg)]")
      }
    >
      {label}
    </a>
  );
}
