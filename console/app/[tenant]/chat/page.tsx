import { resolveTenant } from "@/lib/tenants";
import { notFound } from "next/navigation";
import ChatUI from "./ChatUI";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ tenant: string }> };

export default async function ChatPage({ params }: Props) {
  const { tenant: slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  return <ChatUI tenantSlug={slug} tenantName={tenant.name} />;
}
