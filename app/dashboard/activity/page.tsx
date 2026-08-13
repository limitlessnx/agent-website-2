import { Activity, Bot, Building2, Database, Megaphone, Workflow } from "@/components/admin/ServerIcons";
import { getCampaignReports, getLeads, getN8nStatus, getProperties, getSupabaseReadiness } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";

export default async function UnifiedActivityPage() {
  const [leads, properties, campaigns, n8n, supabase] = await Promise.all([
    getLeads(200),
    getProperties(200),
    getCampaignReports(50),
    getN8nStatus(),
    getSupabaseReadiness(),
  ]);

  const recentCampaigns = campaigns.slice(0, 12);
  const missingMedia = properties.filter((property) => !property.drive_photos_link).slice(0, 8);
  const activeLeads = leads.filter((lead) => !["closed", "converted", "cold"].includes(String(lead.status || "").toLowerCase())).slice(0, 8);

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Governance</p>
          <h1>Unified Activity Center</h1>
          <p>One operational timeline for organization data, Maia campaigns, agent infrastructure and workflow health.</p>
        </div>
        <span className={supabase.ready && !n8n.error ? "admin-status live" : "admin-status warning"}>
          {supabase.ready && !n8n.error ? "Platform operational" : "Review required"}
        </span>
      </header>

      <div className="admin-grid four">
        <section className="admin-panel compact"><p>Active CRM records</p><strong>{activeLeads.length}</strong><span className="admin-muted">Visible activity sample</span></section>
        <section className="admin-panel compact"><p>Recent campaigns</p><strong>{recentCampaigns.length}</strong><span className="admin-muted">Delivery reports</span></section>
        <section className="admin-panel compact"><p>Workflow inventory</p><strong>{n8n.workflows.length}</strong><span className="admin-muted">{n8n.activeWorkflows} active</span></section>
        <section className="admin-panel compact"><p>Media actions</p><strong>{missingMedia.length}</strong><span className="admin-muted">Visible missing records</span></section>
      </div>

      <div className="admin-grid two">
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Campaign Activity</h2><p>Recent Maia outbound operations.</p></div><Megaphone size={18} /></div>
          <div className="admin-list">
            {recentCampaigns.map((campaign) => (
              <a href="/dashboard/limitless/campaigns" className="admin-list-row compact" key={campaign.id}>
                <div><strong>{campaign.campaign_topic}</strong><span>{campaign.accepted} sent · {campaign.failed} failed · {campaign.skipped} skipped</span></div>
                <em>{campaign.attempted}</em>
              </a>
            ))}
            {!recentCampaigns.length ? <p className="admin-empty">No campaign activity is visible yet.</p> : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Workflow Activity</h2><p>Grouped automation operational state.</p></div><Workflow size={18} /></div>
          <div className="admin-list">
            {n8n.workflows.slice(0, 12).map((workflow) => (
              <a href="/dashboard/workflows" className="admin-list-row compact" key={workflow.id}>
                <div><strong>{workflow.name}</strong><span>{workflow.id}</span></div>
                <em className={workflow.active ? "good" : "muted"}>{workflow.active ? "active" : "off"}</em>
              </a>
            ))}
            {!n8n.workflows.length ? <p className="admin-empty">No workflow activity returned from the automation engine.</p> : null}
          </div>
        </section>
      </div>

      <div className="admin-grid two">
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>CRM Activity</h2><p>Active Limitless Realty leads.</p></div><Bot size={18} /></div>
          <div className="admin-list">
            {activeLeads.map((lead) => (
              <a href="/dashboard/limitless/leads" className="admin-list-row compact" key={lead.id}>
                <div><strong>{lead.name || "Unnamed lead"}</strong><span>{[lead.phone, lead.location_preference, lead.budget].filter(Boolean).join(" · ")}</span></div>
                <em>{lead.score || lead.status || "active"}</em>
              </a>
            ))}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Data Quality Activity</h2><p>Records requiring organization action.</p></div><Database size={18} /></div>
          <div className="admin-list">
            {missingMedia.map((property) => (
              <a href="/dashboard/limitless/media" className="admin-list-row compact" key={property.id}>
                <div><strong>{property.title}</strong><span>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "Location not saved"}</span></div>
                <em>media</em>
              </a>
            ))}
            {!missingMedia.length ? (
              <div className="admin-list-row compact"><div><strong>Property media healthy</strong><span>No missing image links found in the visible catalog.</span></div><Building2 size={17} /></div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
