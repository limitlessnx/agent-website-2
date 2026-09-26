import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getPortalCapabilities, requirePortalPermission } from "@/lib/portal-access";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type Appointment = {
  id:string;
  title:string;
  start_at?:string|null;
  end_at?:string|null;
  status:string;
  customer_name?:string|null;
  customer_email?:string|null;
  organizer_email?:string|null;
  location?:string|null;
  external_event_id?:string|null;
};

export const dynamic = "force-dynamic";
export const metadata = { title: "Appointments | Fluxknight" };

export default async function AppointmentsPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");
  try { await requirePortalPermission(session, ["appointments.view","appointments.manage"]); } catch { redirect("/portal"); }
  const capabilities = await getPortalCapabilities(session);
  if (!capabilities.appointments) redirect("/portal");

  const appointments = await supabaseServerRequest<Appointment[]>(
    `appointments?organization_id=eq.${encodeURIComponent(session.organizationId)}&select=id,title,start_at,end_at,status,customer_name,customer_email,organizer_email,location,external_event_id&order=start_at.desc.nullslast,created_at.desc&limit=75`,
  ).catch(() => []);

  return <main className="portal-page">
    <section className="portal-command-hero"><div>
      <p className="portal-kicker">Appointments</p>
      <h1>Scheduled appointments</h1>
      <p>Calendar-backed bookings created by your installed Appointment System.</p>
    </div></section>

    <section className="portal-card">
      <div className="portal-list">
        {appointments.map((item)=><div className="portal-list-row" key={item.id}>
          <div>
            <strong>{item.title || "Appointment"}</strong>
            <span>
              {item.start_at ? new Date(item.start_at).toLocaleString("en-NG",{dateStyle:"medium",timeStyle:"short"}) : "Time pending"}
              {" · "}{item.status.replaceAll("_"," ")}
              {item.customer_name ? ` · ${item.customer_name}` : ""}
              {item.customer_email ? ` · ${item.customer_email}` : ""}
            </span>
          </div>
          <em>{item.external_event_id ? "Calendar linked" : item.status === "email_required" ? "Email needed" : "Pending"}</em>
        </div>)}
        {!appointments.length?<p className="portal-empty">No appointments recorded yet.</p>:null}
      </div>
    </section>
  </main>;
}
