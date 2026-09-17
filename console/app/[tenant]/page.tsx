import { resolveTenant, MASTER_SLUG } from "@/lib/tenants";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tenant: string }> };

// /[tenant] now redirects to /[tenant]/profile — the profile is the new
// business landing surface. The old Overview (apps + crons tables) still
// lives in git history and is reachable by direct URL if reintroduced.
export default async function TenantRoot({ params }: Props) {
  const { tenant: slug } = await params;
  if (slug === MASTER_SLUG) notFound();
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();
  redirect(`/${slug}/profile`);
}
