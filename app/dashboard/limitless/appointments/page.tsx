import Link from "next/link";
import { requireAdminSystemScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Appointment = {
  id: string;
  title: string | null;
  start_at: string | null;
  status: string | null;
  customer_name: string | null;
  location: string | null;
};

export default async function LimitlessAppointmentsPage() {
  const scope = await requireAdminSystemScope("limitless-realty");
  const admin = createAdminClient();
  const { data } = await admin
    .from("appointments")
    .select("id,title,start_at,status,customer_name,location")
    .eq("organization_id", scope.organizationId)
    .order("start_at", { ascending: true })
    .limit(100);
  const appointments = (data || []) as Appointment[];
  return <div className="admin-page">
    <div className="admin-page-header">
      <div><p className="admin-kicker">Limitless Realty</p><h1>Viewings</h1><p>Review scheduled property viewings and the customer records connected to them.</p></div>
      <div className="admin-page-actions"><Link className="admin-button secondary" href="/dashboard">Back to dashboard</Link><Link className="admin-button" href="/dashboard/limitless/leads">Open leads</Link></div>
    </div>
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Upcoming viewings</h2><p>{appointments.length} appointment record{appointments.length === 1 ? "" : "s"} in the Limitless Realty workspace.</p></div></div>
      <div className="admin-list">
        {appointments.map((appointment) => <div className="admin-list-row" key={appointment.id}>
          <div><strong>{appointment.title || "Property viewing"}</strong><span>{appointment.start_at ? new Date(appointment.start_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Time pending"}{appointment.customer_name ? ` · ${appointment.customer_name}` : ""}{appointment.location ? ` · ${appointment.location}` : ""}</span></div>
          <em className="admin-status live">{String(appointment.status || "pending").replaceAll("_", " ")}</em>
        </div>)}
        {!appointments.length ? <p className="admin-empty">No viewing records have been scheduled yet.</p> : null}
      </div>
    </section>
  </div>;
}
