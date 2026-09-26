import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getPortalCapabilities, requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type Viewing = { id:string; viewing_datetime:string; status:string; notes?:string|null; lead_id?:string|null };

export const dynamic = "force-dynamic";
export const metadata = { title: "Appointments | Fluxknight" };

export default async function AppointmentsPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["appointments.view","appointments.manage"]); } catch { redirect("/portal"); }
  const capabilities = await getPortalCapabilities(session);
  if (!capabilities.appointments) redirect("/portal");
  const appointments = await supabaseServerRequest<Viewing[]>(
    `viewings?organization_id=eq.${encodeURIComponent(session.organizationId)}&select=id,viewing_datetime,status,notes,lead_id&order=viewing_datetime.desc&limit=50`,
  ).catch(() => []);

  return <main className="portal-page">
    <section className="portal-command-hero"><div><p className="portal-kicker">Appointments</p><h1>Scheduled appointments</h1><p>Appointments created by your installed Appointment System.</p></div></section>
    <section className="portal-card"><div className="portal-list">{appointments.map((item)=><div className="portal-list-row" key={item.id}><div><strong>{new Date(item.viewing_datetime).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"})}</strong><span>{item.status}{item.notes ? ` · ${item.notes}` : ""}</span></div></div>)}{!appointments.length?<p className="portal-empty">No appointments scheduled yet.</p>:null}</div></section>
  </main>;
}
