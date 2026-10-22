import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { createAdminClient } from "@/lib/supabase/admin";
import CampaignComposer from "./CampaignComposer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns | Fluxknight" };

export default async function CampaignsPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["conversations.view", "conversations.reply"]); } catch { redirect("/portal"); }
  const admin = createAdminClient();
  const { data: profile } = await admin.from("client_onboarding_profiles").select("industry").eq("organization_id", session.organizationId).maybeSingle();
  if (profile?.industry !== "photography-studio") redirect("/portal");
  const { data: customers } = await admin.from("crm_customers").select("id,full_name,phone,email").eq("organization_id", session.organizationId).order("full_name", { ascending: true }).limit(500);
  return <main className="portal-page exposure-page"><section className="exposure-page-title"><div><p className="portal-kicker">Xposure Studios</p><h1>Campaigns</h1><p>Send approved Meta WhatsApp templates to eligible studio clients without leaving the workspace.</p></div><span className="exposure-route-note">Meta template route</span></section><CampaignComposer customers={(customers || []).map((customer) => ({ id: String(customer.id), full_name: String(customer.full_name || "Unnamed client"), phone: customer.phone ? String(customer.phone) : null, email: customer.email ? String(customer.email) : null }))} /></main>;
}
