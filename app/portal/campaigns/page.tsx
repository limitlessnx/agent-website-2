import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { createAdminClient } from "@/lib/supabase/admin";
import CampaignComposer from "./CampaignComposer";
import CampaignStarterSetup from "./CampaignStarterSetup";
import XposureCampaignComposer from "./XposureCampaignComposer";
import { isHotelOrganization } from "@/lib/hotel-communication-policy";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns | Fluxknight" };

export default async function CampaignsPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["conversations.view", "conversations.reply"]); } catch { redirect("/portal"); }
  const admin = createAdminClient();
  const { data: profile } = await admin.from("client_onboarding_profiles").select("industry").eq("organization_id", session.organizationId).maybeSingle();
  const { data: organization } = await admin.from("organizations").select("metadata,status,slug").eq("id", session.organizationId).single();
  const hotel = isHotelOrganization(organization || {}) || isHotelOrganization({ metadata: { industry: profile?.industry } });
  if (!organization || organization.status !== "active") redirect("/portal");
  let canManageIntegrations = false;
  try { await requirePortalPermission(session, ["integrations.manage"]); canManageIntegrations = true; } catch { /* Setup is restricted to authorized managers. */ }
  let canManageContacts = false;
  if (!hotel) {
    try { await requirePortalPermission(session, ["customers.view"]); } catch { redirect("/portal"); }
    try { await requirePortalPermission(session, ["customers.manage"]); canManageContacts = true; } catch { /* Read-only audience access remains available. */ }
  }
  const { data: customers } = await admin.from("crm_customers").select("id,full_name,phone,email").eq("organization_id", session.organizationId).order("full_name", { ascending: true }).limit(500);
  if (!hotel) return <main className="portal-page exposure-page"><section className="exposure-page-title"><div><p className="portal-kicker">WhatsApp marketing</p><h1>Campaigns</h1><p>Your approved WhatsApp templates, consented contacts and phone imports in one place.</p></div></section>{canManageIntegrations && <CampaignStarterSetup hotel={false}/>}<XposureCampaignComposer canManageContacts={canManageContacts} customers={(customers || []).map(customer => ({ id: String(customer.id), full_name: String(customer.full_name || "Unnamed client"), phone: customer.phone ? String(customer.phone) : null, email: customer.email ? String(customer.email) : null }))} /></main>;
  return <main className="portal-page exposure-page"><section className="exposure-page-title"><div><p className="portal-kicker">Hotel guest relationships</p><h1>Campaigns</h1><p>Send approved WhatsApp offers to eligible guests. Consent, bookings and manager handover are checked before sending.</p></div><span className="exposure-route-note">Meta template route</span></section>{canManageIntegrations && <CampaignStarterSetup hotel={true}/>}<CampaignComposer hotel={hotel} customers={(customers || []).map((customer) => ({ id: String(customer.id), full_name: String(customer.full_name || "Unnamed client"), phone: customer.phone ? String(customer.phone) : null, email: customer.email ? String(customer.email) : null }))} /></main>;
}
