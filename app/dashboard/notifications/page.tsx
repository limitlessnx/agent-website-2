import Link from "next/link";
import { Bell, Building2, Users, Workflow } from "@/components/admin/ServerIcons";
import LeoProactiveSignals from "@/components/admin/LeoProactiveSignals";
import { getLeads } from "@/lib/limitless-data";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";
import { reconcileLeoProactiveSignals } from "@/lib/leo-proactive-signal-store";
import { listAdminDashboardNotifications, syncLifecycleDashboardNotifications } from "@/lib/dashboard-notifications";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  await syncLifecycleDashboardNotifications().catch(() => undefined);
  const [leads, clients, snapshot, lifecycleNotifications] = await Promise.all([
    getLeads(100).catch(() => []),
    listClientOnboardingProfiles(100).catch(() => []),
    scanLeoProactiveSignals({ limit: 50 }).catch(() => ({ generatedAt: new Date().toISOString(), total: 0, critical: 0, high: 0, medium: 0, low: 0, signals: [] })),
    listAdminDashboardNotifications(100).catch(() => []),
  ]);
  const proactiveSignals = await reconcileLeoProactiveSignals(snapshot).catch(() => []);
  const newLeads = leads.filter((lead) => String(lead.status || "").toLowerCase() === "new");
  const pendingClients = clients.filter((client) => !["live", "paused"].includes(client.status));
  const workflowSignals = proactiveSignals.filter((item) => item.category === "workflow");
  const newSignals = proactiveSignals.filter((item) => item.lifecycle === "new").length;
  const acknowledgedSignals = proactiveSignals.filter((item) => item.lifecycle === "acknowledged").length;
  const activeLifecycleNotifications = lifecycleNotifications.filter((item) => !item.resolvedAt);

  return (
    <div className="admin-page">
      <div className="admin-page-header"><div><p className="admin-kicker">Fluxknight admin only</p><h1>Admin notifications</h1><p>Prioritized platform and owned-workspace signals detected from current operational evidence. Signal state persists so Leo can distinguish new, ongoing, acknowledged, and resolved conditions.</p></div></div>
      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Bell size={15} /> Lifecycle alerts</p><strong>{activeLifecycleNotifications.length}</strong><span>Dashboard-first customer and admin conditions</span></article>
        <article className="admin-metric-card"><p><Building2 size={15} /> Owned organization alerts</p><strong>{newLeads.length}</strong><span>Limitless Realty new leads</span></article>
        <article className="admin-metric-card"><p><Users size={15} /> Client platform alerts</p><strong>{pendingClients.length}</strong><span>Onboarding or configuration</span></article>
        <article className="admin-metric-card"><p><Workflow size={15} /> Proactive signals</p><strong>{proactiveSignals.length}</strong><span>{newSignals} new · {acknowledgedSignals} acknowledged</span></article>
      </div>

      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Lifecycle notification feed</h2><p>Durable dashboard notifications generated from customer health, retention and expansion intelligence. Routine notices stay in-product rather than becoming email by default.</p></div></div><div className="admin-list">
        {lifecycleNotifications.slice(0, 50).map((item) => <Link key={item.id} href={item.actionHref || "/dashboard/lifecycle"} className="admin-list-row"><div><strong>{item.title}</strong><span>{item.message}</span></div><em>{item.severity}{item.resolvedAt ? " · resolved" : ""}</em></Link>)}
        {!lifecycleNotifications.length ? <p className="admin-empty">No lifecycle dashboard notifications yet.</p> : null}
      </div></section>

      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Leo detected</h2><p>Signals are deduplicated by source and persist across scans. Acknowledgment records that the issue has been seen without pretending the underlying condition is resolved.</p></div></div>
        <LeoProactiveSignals initialSignals={proactiveSignals} />
      </section>

      <section className="admin-panel"><div className="admin-panel-header"><div><h2>Existing attention queue</h2><p>New leads and client onboarding records that remain available for manual review.</p></div></div><div className="admin-list">
        {pendingClients.map((client) => <Link key={client.id} href="/dashboard/clients" className="admin-list-row"><div><strong>Client workspace needs attention</strong><span>{client.business_name || client.business_email || "Unnamed organization"}</span></div><em>{client.status.replaceAll("_", " ")}</em></Link>)}
        {newLeads.slice(0, 20).map((lead, index) => <Link key={lead.id || index} href="/dashboard/limitless/leads" className="admin-list-row"><div><strong>New Limitless Realty lead</strong><span>{lead.name || lead.phone || "Lead record"}</span></div><em>Owned organization</em></Link>)}
        {!pendingClients.length && !newLeads.length ? <p className="admin-empty">No new admin notifications.</p> : null}
      </div></section>
    </div>
  );
}
