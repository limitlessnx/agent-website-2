import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { createAdminClient } from "@/lib/supabase/admin";
import BookingLifecycleForm from "../BookingLifecycleForm";

export const dynamic = "force-dynamic";
type Appointment = { id:string; title:string; status:string; start_at:string|null; end_at:string|null; customer_name:string|null; customer_email:string|null; customer_phone:string|null; location:string|null; notes:string|null };
type Meta = { shoot_type:string; catalogue_item_id:string|null; deposit_status:string; delivery_status:string; assigned_photographer_id:string|null; client_notes:string|null };
type Package = { name:string };
type Member = { id:string; userId:string; email:string|null; role:string; status:string };
function localInput(value: string | null) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }
export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["appointments.view", "appointments.manage"]); } catch { redirect("/portal"); }
  const profile = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  if (profile?.industry !== "photography-studio") redirect("/portal/appointments");
  const { id } = await params; const admin = createAdminClient();
  const [{ data: appointment }, { data: meta }, { data: memberRows }] = await Promise.all([
    admin.from("appointments").select("id,title,status,start_at,end_at,customer_name,customer_email,customer_phone,location,notes").eq("organization_id", session.organizationId).eq("id", id).maybeSingle(),
    admin.from("photography_booking_metadata").select("shoot_type,catalogue_item_id,deposit_status,delivery_status,assigned_photographer_id,client_notes").eq("organization_id", session.organizationId).eq("appointment_id", id).maybeSingle(),
    admin.from("organization_memberships").select("id,user_id,status,membership_roles(roles(slug))").eq("organization_id", session.organizationId).eq("status", "active").order("created_at", { ascending: true }),
  ]);
  if (!appointment) notFound();
  const metadata = (meta || { shoot_type: "other", catalogue_item_id: null, deposit_status: "not_required", delivery_status: "not_started", assigned_photographer_id: null, client_notes: null }) as Meta;
  const { data: packageRow } = metadata.catalogue_item_id ? await admin.from("photography_catalogue_items").select("name").eq("organization_id", session.organizationId).eq("id", metadata.catalogue_item_id).maybeSingle() : { data: null };
  const members: Member[] = await Promise.all(((memberRows || []) as Array<{id:string;user_id:string;status:string;membership_roles?:Array<{roles?:{slug?:string}|Array<{slug?:string}>}>}>).map(async (member) => { const user = await admin.auth.admin.getUserById(member.user_id); const roleRelation = member.membership_roles?.[0]?.roles; const role = Array.isArray(roleRelation) ? roleRelation[0]?.slug : roleRelation?.slug; return { id: member.id, userId: member.user_id, email: user.data.user?.email || null, role: role || "team-member", status: member.status }; }));
  const assignedMember = members.find((member) => member.userId === metadata.assigned_photographer_id);
  const item = appointment as Appointment;
  return <main className="portal-page exposure-page"><section className="exposure-page-title"><div><p className="portal-kicker">Xposure Studios · Booking</p><h1>{item.title || "Studio session"}</h1><p>{item.customer_name || "Client pending"}{item.customer_email ? ` · ${item.customer_email}` : ""}{item.customer_phone ? ` · ${item.customer_phone}` : ""}</p></div><Link className="portal-button secondary" href="/portal/appointments">Back to bookings</Link></section><section className="portal-business-metrics"><article className="portal-business-metric"><span>Package</span><strong>{(packageRow as Package | null)?.name || "Custom session"}</strong><small>{metadata.shoot_type.replaceAll("_", " ")}</small></article><article className="portal-business-metric"><span>Booking status</span><strong>{item.status.replaceAll("_", " ")}</strong><small>{item.start_at ? new Date(item.start_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Time pending"}</small></article><article className="portal-business-metric"><span>Photographer</span><strong>{assignedMember?.email || "Unassigned"}</strong><small>{assignedMember?.role || "Needs assignment"}</small></article><article className="portal-business-metric"><span>Delivery</span><strong>{metadata.delivery_status.replaceAll("_", " ")}</strong><small>Deposit: {metadata.deposit_status.replaceAll("_", " ")}</small></article></section><section className="exposure-panel"><div className="portal-card-head"><div><h2>Booking lifecycle</h2><p>Reschedule, cancel, assign a photographer and update fulfilment status.</p></div></div><BookingLifecycleForm bookingId={item.id} members={members} initial={{ status: item.status, startAt: localInput(item.start_at), endAt: localInput(item.end_at), location: item.location || "", notes: metadata.client_notes || item.notes || "", depositStatus: metadata.deposit_status, deliveryStatus: metadata.delivery_status, assignedPhotographerId: metadata.assigned_photographer_id || "", shootType: metadata.shoot_type }} /></section></main>;
}
