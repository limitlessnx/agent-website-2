import Link from "next/link";
import { Bell, Building2, Users, Workflow } from "lucide-react";
import { getLeads } from "@/lib/limitless-data";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const [leads, clients] = await Promise.all([
    getLeads(100).catch(() => []),
    listClientOnboardingProfiles(100).catch(() => []),
  ]);
  const newLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "new");
  const pendingClients = clients.filter((client) => !["live", "paused"].includes(client.status));

  return (
    <div className="admin-page">
      <div className="admin-page-header"><div><p className="admin-kicker">Fluxknight admin only</p><h1>Admin notifications</h1><p>Platform events and owned-organization alerts. Client dashboard notifications remain isolated inside each client organization.</p></div></div>
      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Bell size={15} /> Attention queue</p><strong>{newLeads.length + pendingClients.length}</strong><span>Current actionable signals</span></article>
        <article className="admin-metric-card"><p><Building2 size={15} /> Owned organization alerts</p><strong>{newLeads.length}</strong><span>Limitless Realty new leads</span></article>
        <article className="admin-metric-card"><p><Users size={15} /> Client platform alerts</p><strong>{pendingClients.length}</strong><span>Onboarding or configuration</span></article>
        <article className="admin-metric-card"><p><Workflow size={15} /> Workflow alerts</p><strong>0</strong><span>No recorded failures</span></article>
      </div>
      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Needs attention</h2><p>Open the source workspace to take action.</p></div></div><div className="admin-list">
        {pendingClients.map((client) => <Link key={client.id} href="/dashboard/clients" className="admin-list-row"><div><strong>Client workspace needs attention</strong><span>{client.business_name || client.business_email || "Unnamed organization"}</span></div><em>{client.status.replaceAll("_", " ")}</em></Link>)}
        {newLeads.slice(0, 20).map((lead, index) => <Link key={lead.id || index} href="/dashboard/limitless/leads" className="admin-list-row"><div><strong>New Limitless Realty lead</strong><span>{lead.name || lead.email || lead.phone || "Lead record"}</span></div><em>Owned organization</em></Link>)}
        {!pendingClients.length && !newLeads.length ? <p className="admin-empty">No new admin notifications.</p> : null}
      </div></section>
    </div>
  );
}
