import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { createAdminClient } from "@/lib/supabase/admin";
import NewBookingForm from "../NewBookingForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New Booking | Fluxknight" };
type CustomerRow = { id: string; full_name: string | null; company_name: string | null };
type PackageRow = { id: string; name: string; duration_minutes: number | null };
type MemberRow = { id: string; user_id: string; status: string; membership_roles?: Array<{ roles?: { slug?: string } | Array<{ slug?: string }> }> };
export default async function NewBookingPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["appointments.manage"]); } catch { redirect("/portal/appointments"); }
  const profile = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  if (profile?.industry !== "photography-studio") redirect("/portal");
  const admin = createAdminClient();
  const [{ data: customerRows }, { data: packageRows }, { data: memberRows }] = await Promise.all([
    admin.from("crm_customers").select("id,full_name,company_name").eq("organization_id", session.organizationId).in("status", ["active", "inactive"]).order("full_name", { ascending: true }).limit(500),
    admin.from("photography_catalogue_items").select("id,name,duration_minutes").eq("organization_id", session.organizationId).eq("status", "active").order("name", { ascending: true }),
    admin.from("organization_memberships").select("id,user_id,status,membership_roles(roles(slug))").eq("organization_id", session.organizationId).eq("status", "active").order("created_at", { ascending: true }),
  ]);
  const customers = ((customerRows || []) as CustomerRow[]).map((customer) => ({ id: String(customer.id), name: String(customer.full_name || customer.company_name || "Unnamed client") }));
  const packages = ((packageRows || []) as PackageRow[]).map((item) => ({ id: String(item.id), name: String(item.name), duration_minutes: item.duration_minutes }));
  const members = await Promise.all(((memberRows || []) as MemberRow[]).map(async (member) => { const user = await admin.auth.admin.getUserById(member.user_id); const relation = member.membership_roles?.[0]?.roles; const role = Array.isArray(relation) ? relation[0]?.slug : relation?.slug; return { id: String(member.id), userId: String(member.user_id), email: user.data.user?.email || null, role: role || "team-member" }; }));
  return <main className="portal-page exposure-page"><section className="exposure-page-title"><div><p className="portal-kicker">Xposure Studios · Bookings & calendar</p><h1>New studio booking</h1><p>Save a booking request for review or explicitly confirm the session when the details are ready.</p></div></section><section className="exposure-panel"><div className="portal-card-head"><div><h2>Booking details</h2><p>The booking remains linked to the organization, client, appointment system, and optional catalogue package.</p></div></div>{customers.length ? <NewBookingForm customers={customers} packages={packages} members={members} /> : <p className="exposure-empty">Add a studio client before creating a booking.</p>}</section></main>;
}
