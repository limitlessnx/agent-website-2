import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getPortalCapabilities, requirePortalPermission } from "@/lib/portal-access";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { getIndustryExperience } from "@/lib/industryExperience";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { createAdminClient } from "@/lib/supabase/admin";

type Appointment = { id:string; title:string; start_at?:string|null; end_at?:string|null; status:string; customer_name?:string|null; customer_email?:string|null; organizer_email?:string|null; location?:string|null; external_event_id?:string|null };
type BookingMetadata = { appointment_id:string; shoot_type:string; catalogue_item_id:string|null; deposit_status:string; delivery_status:string };
export const dynamic = "force-dynamic";
export const metadata = { title: "Appointments | Fluxknight" };

export default async function AppointmentsPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["appointments.view","appointments.manage"]); } catch { redirect("/portal"); }
  const [capabilities, profile] = await Promise.all([getPortalCapabilities(session), getClientOnboardingProfile(session.organizationId).catch(() => null)]);
  const experience = getIndustryExperience(profile?.industry);
  const photography = profile?.industry === "photography-studio";
  if (!capabilities.appointments || !experience.features.appointments) redirect("/portal");
  const appointments = await supabaseServerRequest<Appointment[]>(`appointments?organization_id=eq.${encodeURIComponent(session.organizationId)}&select=id,title,start_at,end_at,status,customer_name,customer_email,organizer_email,location,external_event_id&order=start_at.desc.nullslast,created_at.desc&limit=75`).catch(() => []);
  const admin = createAdminClient();
  const { data: metadataRows } = photography ? await admin.from("photography_booking_metadata").select("appointment_id,shoot_type,catalogue_item_id,deposit_status,delivery_status").eq("organization_id", session.organizationId).in("appointment_id", appointments.map((item) => item.id)) : { data: [] };
  const metadataByAppointment = new Map<string, BookingMetadata>(((metadataRows || []) as BookingMetadata[]).map((item) => [item.appointment_id, item]));
  const packageIds = ((metadataRows || []) as BookingMetadata[]).map((item) => item.catalogue_item_id).filter((id): id is string => Boolean(id));
  const { data: packageRows } = photography && packageIds.length ? await admin.from("photography_catalogue_items").select("id,name").eq("organization_id", session.organizationId).in("id", packageIds) : { data: [] };
  const packageNames = new Map<string, string>(((packageRows || []) as Array<{id:string;name:string}>).map((item) => [item.id, item.name]));
  const grouped = appointments.reduce<Record<string, Appointment[]>>((groups, item) => { const key = item.start_at ? new Date(item.start_at).toLocaleDateString("en-NG", { weekday: "short", month: "short", day: "numeric" }) : "Date pending"; (groups[key] ||= []).push(item); return groups; }, {});
  return <main className="portal-page">
    <section className="portal-command-hero"><div><p className="portal-kicker">{photography ? "Bookings & calendar" : experience.appointmentLabel}</p><h1>{photography ? "Bookings & calendar" : experience.appointmentLabel}</h1><p>{photography ? "Manage studio shoots, package details and client fulfilment from one booking view." : "Calendar-backed bookings created by your installed Appointment System."}</p></div>{photography ? <Link className="portal-button" href="/portal/appointments/new">New booking</Link> : null}</section>
    {photography ? <section className="exposure-calendar-panel">{Object.entries(grouped).map(([day, items]) => <div className="exposure-calendar-day" key={day}><header><span>{day}</span><small>{items.length} session{items.length === 1 ? "" : "s"}</small></header>{items.map((item) => { const meta = metadataByAppointment.get(item.id); return <Link className="exposure-calendar-booking" href={`/portal/appointments/${item.id}`} key={item.id}><time>{item.start_at ? new Date(item.start_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "—"}</time><div><strong>{item.title || "Studio session"}</strong><span>{item.customer_name || "Client pending"}{item.location ? ` · ${item.location}` : ""}</span>{meta?.catalogue_item_id ? <small>Package: {packageNames.get(meta.catalogue_item_id) || "Catalogue package"}</small> : null}<small>{meta ? `Deposit ${meta.deposit_status.replaceAll("_", " ")} · Delivery ${meta.delivery_status.replaceAll("_", " ")}` : (item.customer_email || (item.external_event_id ? "Calendar linked" : "Booking details pending"))}</small></div><em className={item.status.toLowerCase().includes("confirm") ? "confirmed" : item.status.toLowerCase().includes("progress") ? "in-progress" : "pending"}>{item.status.replaceAll("_", " ")}</em></Link>; })}</div>)}{!appointments.length ? <p className="portal-empty">No studio bookings recorded yet.</p> : null}</section> : <section className="portal-card"><div className="portal-list">{appointments.map((item) => <div className="portal-list-row" key={item.id}><div><strong>{item.title || "Appointment"}</strong><span>{item.start_at ? new Date(item.start_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Time pending"} · {item.status.replaceAll("_", " ")}{item.customer_name ? ` · ${item.customer_name}` : ""}{item.customer_email ? ` · ${item.customer_email}` : ""}</span></div><em>{item.external_event_id ? "Calendar linked" : item.status === "email_required" ? "Email needed" : "Pending"}</em></div>)}{!appointments.length ? <p className="portal-empty">No appointments recorded yet.</p> : null}</div></section>}
  </main>;
}
