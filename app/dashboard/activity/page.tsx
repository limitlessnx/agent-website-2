import { Activity, AlertTriangle, Bot, Building2, CheckCircle2, Clock3, Database, Megaphone, MessageSquareText, Workflow } from "@/components/admin/ServerIcons";
import { getCampaignReports, getLeads, getN8nStatus, getProperties, getSupabaseReadiness } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";

type LeadRecord = Awaited<ReturnType<typeof getLeads>>[number];
type CampaignRecord = Awaited<ReturnType<typeof getCampaignReports>>[number];

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function leadName(lead: LeadRecord) {
  return text(lead.name, "Unnamed lead");
}

function leadStatus(lead: LeadRecord) {
  return text(lead.status, "active").toLowerCase();
}

function campaignRisk(campaign: CampaignRecord) {
  return Number(campaign.failed || 0) > 0 || Number(campaign.skipped || 0) > Number(campaign.accepted || 0);
}

export default async function UnifiedActivityPage() {
  const [leads, properties, campaigns, n8n, supabase] = await Promise.all([
    getLeads(200),
    getProperties(200),
    getCampaignReports(50),
    getN8nStatus(),
    getSupabaseReadiness(),
  ]);

  const recentCampaigns = campaigns.slice(0, 8);
  const riskyCampaigns = campaigns.filter(campaignRisk).slice(0, 5);
  const missingMedia = properties.filter((property) => !property.drive_photos_link).slice(0, 8);
  const activeLeads = leads.filter((lead) => !["closed", "converted", "cold"].includes(leadStatus(lead))).slice(0, 8);
  const attentionCount = riskyCampaigns.length + missingMedia.length;
  const platformHealthy = supabase.ready && !n8n.error;

  const feed = [
    ...activeLeads.slice(0, 4).map((lead) => ({
      id: `lead-${lead.id}`,
      href: "/dashboard/limitless/leads",
      title: leadName(lead),
      meta: [lead.phone, lead.location_preference, lead.budget].map((item) => text(item)).filter(Boolean).join(" · ") || "CRM conversation updated",
      label: lead.score || leadStatus(lead),
      tone: "conversation",
    })),
    ...recentCampaigns.slice(0, 4).map((campaign) => ({
      id: `campaign-${campaign.id}`,
      href: "/dashboard/limitless/campaigns",
      title: campaign.campaign_topic,
      meta: `${campaign.accepted} sent · ${campaign.failed} failed · ${campaign.skipped} skipped`,
      label: campaign.attempted,
      tone: campaignRisk(campaign) ? "warning" : "automation",
    })),
    ...n8n.workflows.slice(0, 4).map((workflow) => ({
      id: `workflow-${workflow.id}`,
      href: "/dashboard/workflows",
      title: workflow.name,
      meta: workflow.id,
      label: workflow.active ? "active" : "off",
      tone: workflow.active ? "automation" : "muted",
    })),
  ].slice(0, 10);

  return (
    <main className="admin-page activity-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Activity</p>
          <h1>Activity Center</h1>
          <p>One operating feed for customer movement, AI actions, workflow state and data quality.</p>
        </div>
        <span className={attentionCount || !platformHealthy ? "admin-status warning" : "admin-status live"}>
          {attentionCount || !platformHealthy ? "Review required" : "Activity healthy"}
        </span>
      </header>

      <div className="admin-metric-grid activity-metrics">
        <section className="admin-panel compact"><p>Active conversations</p><strong>{activeLeads.length}</strong><span className="admin-muted">Visible CRM movement</span></section>
        <section className="admin-panel compact"><p>Recent campaigns</p><strong>{recentCampaigns.length}</strong><span className="admin-muted">Outbound actions</span></section>
        <section className="admin-panel compact"><p>Workflow inventory</p><strong>{n8n.workflows.length}</strong><span className="admin-muted">{n8n.activeWorkflows} active</span></section>
        <section className="admin-panel compact"><p>Attention items</p><strong>{attentionCount}</strong><span className="admin-muted">Delivery + data checks</span></section>
      </div>

      <section className="admin-panel activity-command-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Operations Feed</h2>
            <p>Recent movement across AI, CRM and automation. Less tab-hopping, fewer places for problems to hide.</p>
          </div>
          <Activity size={18} />
        </div>
        <div className="activity-feed">
          {feed.map((item) => (
            <a href={item.href} className={`activity-feed-row ${item.tone}`} key={item.id}>
              <span className="activity-feed-icon">{item.tone === "conversation" ? <MessageSquareText size={15} /> : item.tone === "warning" ? <AlertTriangle size={15} /> : item.tone === "automation" ? <Workflow size={15} /> : <Clock3 size={15} />}</span>
              <span><strong>{item.title}</strong><small>{item.meta}</small></span>
              <em>{item.label}</em>
            </a>
          ))}
          {!feed.length ? <p className="admin-empty">No visible activity returned yet.</p> : null}
        </div>
      </section>

      <div className="admin-grid two activity-grid">
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Needs Review</h2><p>Delivery failures and catalog records that need cleanup.</p></div><AlertTriangle size={18} /></div>
          <div className="admin-list">
            {riskyCampaigns.map((campaign) => (
              <a href="/dashboard/limitless/campaigns" className="admin-list-row compact" key={campaign.id}>
                <div><strong>{campaign.campaign_topic}</strong><span>{campaign.accepted} sent · {campaign.failed} failed · {campaign.skipped} skipped</span></div>
                <em>campaign</em>
              </a>
            ))}
            {missingMedia.map((property) => (
              <a href="/dashboard/limitless/media" className="admin-list-row compact" key={property.id}>
                <div><strong>{property.title}</strong><span>{[property.location_area, property.location_city].filter(Boolean).join(", ") || "Location not saved"}</span></div>
                <em>media</em>
              </a>
            ))}
            {!riskyCampaigns.length && !missingMedia.length ? (
              <div className="admin-list-row compact"><div><strong>No obvious review queue</strong><span>Visible campaign delivery and media records look clean.</span></div><CheckCircle2 size={17} /></div>
            ) : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>System Activity</h2><p>Workflow and data-service operating state.</p></div><Database size={18} /></div>
          <div className="activity-system-grid">
            <article><Workflow size={18} /><strong>{n8n.activeWorkflows}</strong><span>active workflows</span></article>
            <article><Database size={18} /><strong>{supabase.ready ? "Ready" : "Check"}</strong><span>database state</span></article>
            <article><Bot size={18} /><strong>{activeLeads.length}</strong><span>crm signals</span></article>
            <article><Megaphone size={18} /><strong>{recentCampaigns.length}</strong><span>campaign logs</span></article>
          </div>
          <div className="admin-list">
            {n8n.workflows.slice(0, 8).map((workflow) => (
              <a href="/dashboard/workflows" className="admin-list-row compact" key={workflow.id}>
                <div><strong>{workflow.name}</strong><span>{workflow.id}</span></div>
                <em className={workflow.active ? "good" : "muted"}>{workflow.active ? "active" : "off"}</em>
              </a>
            ))}
            {!n8n.workflows.length ? <p className="admin-empty">No workflow activity returned from the automation engine.</p> : null}
          </div>
        </section>
      </div>

      <style jsx>{`
        .activity-page{max-width:1500px;margin:0 auto}.activity-command-panel{background:linear-gradient(135deg,var(--fk-brand-soft),transparent 52%),var(--fk-surface)!important}.activity-feed{display:grid;gap:10px}.activity-feed-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px;border:1px solid var(--fk-border);border-radius:14px;background:var(--fk-surface-raised);color:var(--fk-text);text-decoration:none}.activity-feed-row:hover{border-color:var(--fk-border-strong);background:var(--fk-surface-hover)}.activity-feed-row strong,.activity-feed-row small{display:block}.activity-feed-row small{margin-top:4px;color:var(--fk-text-muted);font-size:12px}.activity-feed-row em{color:var(--fk-text-secondary);font-size:11px;font-style:normal;font-weight:800;text-transform:uppercase}.activity-feed-icon{width:32px;height:32px;display:grid;place-items:center;border-radius:11px;background:var(--fk-brand-soft);color:var(--fk-brand-hover)}.activity-feed-row.warning .activity-feed-icon{background:color-mix(in srgb,var(--fk-warning) 18%,var(--fk-surface));color:var(--fk-warning)}.activity-feed-row.conversation .activity-feed-icon{background:color-mix(in srgb,var(--fk-info) 15%,var(--fk-surface));color:var(--fk-info)}.activity-system-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}.activity-system-grid article{border:1px solid var(--fk-border);border-radius:14px;background:var(--fk-surface-raised);padding:13px}.activity-system-grid svg{color:var(--fk-brand-hover)}.activity-system-grid strong{display:block;margin-top:10px;color:var(--fk-text);font-size:22px;line-height:1}.activity-system-grid span{display:block;margin-top:5px;color:var(--fk-text-muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em}@media(max-width:760px){.activity-system-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.activity-feed-row{grid-template-columns:auto minmax(0,1fr)}.activity-feed-row em{grid-column:2}}
      `}</style>
    </main>
  );
}
