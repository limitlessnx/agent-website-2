import Link from "next/link";
import { Bell, Building2, Users, Workflow } from "@/components/admin/ServerIcons";
import { getLeads } from "@/lib/limitless-data";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const [leads, clients, proactive] = await Promise.all([
    getLeads(100).catch(() => []),
    listClientOnboardingProfiles(100).catch(() => []),
    scanLeoProactiveSignals({ limit: 50 }).catch(() => ({ generatedAt: new Date().toISOString(), total: 0, critical: 0, high: 0, medium: 0, low: 0, signals: [] })),
  ]);
  const newLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "new");
  const pendingClients = clients.filter((client) => !["live", "paused"].includes(client.status));
  const workflowSignals = proactive.signals.filter((item) => item.category === "workflow");

  return (
    <div className="admin-page">
      <div className="admin-page-header"><div><p className="admin-kicker">Fluxknight admin only</p><h1>Admin notifications</h1><p>Prioritized platform and owned-workspace signals detected from current operational evidence. Client dashboard notifications remain isolated inside each client organization.</p></div></div>
      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Bell size={15} /> Proactive signals</p><strong>{proactive.total}</strong><span>{proactive.critical} critical · {proactive.high} high priority</span></article>
        <article className="admin-metric-card"><p><Building2 size={15} /> Owned organization alerts</p><strong>{newLeads.length}</strong><span>Limitless Realty new leads</span></article>
        <article className="admin-metric-card"><p><Users size={15} /> Client platform alerts</p><strong>{pendingClients.length}</strong><span>Onboarding or configuration</span></article>
        <article className="admin-metric-card"><p><Workflow size={15} /> Workflow alerts</p><strong>{workflowSignals.length}</strong><span>{workflowSignals.length ? "Recent failures or error states detected" : "No current workflow failure signal"}</span></article>
      </div>

      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Leo detected</h2><p>Signals are ranked by operational impact. Recommendations do not execute changes.</p></div></div><div className="admin-list">
        {proactive.signals.map((item) => <Link key={item.id} href={item.href} className="admin-list-row"><div><strong>{item.title}</strong><span>{item.summary} {item.recommendation}</span></div><em>{item.severity}</em></Link>)}
        {!proactive.signals.length ? <p className="admin-empty">No proactive operational signal currently requires attention.</p> : null}
      </div></section>

      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Existing attention queue</h2><p>New leads and client onboarding records that remain available for manual review.</p></div></div><div className="admin-list">
        {pendingClients.map((client) => <Link key={client.id} href="/dashboard/clients" className="admin-list-row"><div><strong>Client workspace needs attention</strong><span>{client.business_name || client.business_email || "Unnamed organization"}</span></div><em>{client.status.replaceAll("_", " ")}</em></Link>)}
        {newLeads.slice(0, 20).map((lead, index) => <Link key={lead.id || index} href="/dashboard/limitless/leads" className="admin-list-row"><div><strong>New Limitless Realty lead</strong><span>{lead.name || lead.phone || "Lead record"}</span></div><em>Owned organization</em></Link>)}
        {!pendingClients.length && !newLeads.length ? <p className="admin-empty">No new admin notifications.</p> : null}
      </div></section>
    </div>
  );
}
