import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tenant: string }> };

// Per-tenant email deliverability. Each tenant has its own Postgres +
// Resend account; env var pattern: EMAIL_DB_URL_<TENANT_SLUG_UPPER>.
// Master aggregates across all tenants.

export default async function EmailPage({ params }: Props) {
  const { tenant: slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const envKey = slug === MASTER_SLUG ? null : `EMAIL_DB_URL_${slug.toUpperCase()}`;
  const url = envKey ? process.env[envKey] : null;
  const connected = !!url;

  return (
    <div className="max-w-6xl">
      {!connected && (
        <div className="p-4 border border-amber-900 rounded bg-amber-950/40 text-sm">
          <div className="font-semibold text-amber-400 mb-1">Not connected</div>
          <div className="text-neutral-400">
            {slug === MASTER_SLUG
              ? "Master email view aggregates from every tenant. Wire per-tenant DBs first."
              : `Set ${envKey}=postgres://... to enable this page for ${tenant.name}.`}
          </div>
          <div className="mt-3 text-xs text-neutral-500">
            The Postgres table should be <code className="text-neutral-300">email_events</code>{" "}
            with columns: event_type, email_id, to, from, subject, template_id, created_at.
            Ingest via a <code className="text-neutral-300">/api/webhooks/resend</code> route (future).
          </div>
        </div>
      )}
    </div>
  );
}
