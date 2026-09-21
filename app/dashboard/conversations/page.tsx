import { AlertTriangle, Bot, Clock3, MessageSquareText, PhoneCall, UserCheck } from "@/components/admin/ServerIcons";
import { getCampaignReports, getLeads, getN8nStatus, getSupabaseReadiness } from "@/lib/limitless-data";

export const dynamic = "force-dynamic";

type LeadRecord = Awaited<ReturnType<typeof getLeads>>[number];

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function leadLabel(lead: LeadRecord) {
  return text(lead.name, "Unnamed lead");
}

function leadMeta(lead: LeadRecord) {
  return [lead.phone, lead.location_preference, lead.budget].map((item) => text(item)).filter(Boolean).join(" · ") || "No contact context saved";
}

function leadStatus(lead: LeadRecord) {
  return text(lead.status, "active").toLowerCase();
}

function isAttentionLead(lead: LeadRecord) {
  const status = leadStatus(lead);
  const score = Number(lead.score || 0);
  return ["new", "hot", "qualified", "follow_up", "inspection", "pending"].some((item) => status.includes(item)) || score >= 70;
}

export default async function ConversationsPage() {
  const [leads, campaigns, n8n, supabase] = await Promise.all([
    getLeads(200),
    getCampaignReports(30),
    getN8nStatus(),
    getSupabaseReadiness(),
  ]);

  const activeLeads = leads.filter((lead) => !["closed", "converted", "cold"].includes(leadStatus(lead)));
  const attentionLeads = activeLeads.filter(isAttentionLead).slice(0, 5);
  const inboxLeads = activeLeads.slice(0, 10);
  const recentCampaigns = campaigns.slice(0, 5);
  const failedCampaigns = campaigns.filter((campaign) => Number(campaign.failed || 0) > 0).slice(0, 5);
  const platformHealthy = supabase.ready && !n8n.error;
  const handoffCount = attentionLeads.length + failedCampaigns.length;

  return (
    <main className="admin-page conversations-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Conversations</p>
          <h1>Conversation Center</h1>
          <p>Track AI-led conversations, follow-ups and human handoffs before opportunities quietly evaporate like sensible project scope.</p>
        </div>
        <span className={handoffCount ? "admin-status warning" : "admin-status live"}>{handoffCount ? `${handoffCount} need attention` : "Inbox stable"}</span>
      </header>

      <div className="admin-metric-grid">
        <section className="admin-panel compact"><p>Active conversations</p><strong>{activeLeads.length}</strong><span className="admin-muted">CRM records still open</span></section>
        <section className="admin-panel compact"><p>Need attention</p><strong>{attentionLeads.length}</strong><span className="admin-muted">Follow-up or handoff signals</span></section>
        <section className="admin-panel compact"><p>Recent outbound</p><strong>{recentCampaigns.length}</strong><span className="admin-muted">Campaign conversation pushes</span></section>
        <section className="admin-panel compact"><p>Automation state</p><strong>{platformHealthy ? "Live" : "Check"}</strong><span className="admin-muted">Supabase + workflow health</span></section>
      </div>

      <section className="admin-panel conversations-hero-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Needs your attention</h2>
            <p>Highest-friction conversations and delivery issues that should not be left for the algorithmic gods.</p>
          </div>
          <AlertTriangle size={18} />
        </div>
        <div className="admin-list">
          {attentionLeads.map((lead, index) => (
            <a href="/dashboard/limitless/leads" className="admin-list-row compact attention-danger" key={lead.id}>
              <div><strong>{index + 1}. {leadLabel(lead)}</strong><span>{leadMeta(lead)}</span></div>
              <em>{lead.score || leadStatus(lead)}</em>
            </a>
          ))}
          {failedCampaigns.map((campaign) => (
            <a href="/dashboard/limitless/campaigns" className="admin-list-row compact attention-warning" key={campaign.id}>
              <div><strong>{campaign.campaign_topic}</strong><span>{campaign.failed} failed · {campaign.accepted} sent · {campaign.skipped} skipped</span></div>
              <em>delivery</em>
            </a>
          ))}
          {!attentionLeads.length && !failedCampaigns.length ? (
            <div className="admin-list-row compact"><div><strong>No urgent conversation issues</strong><span>The visible inbox does not show handoff or delivery problems.</span></div><UserCheck size={17} /></div>
          ) : null}
        </div>
      </section>

      <div className="admin-grid two conversation-grid">
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Conversation Inbox</h2><p>Open customer conversations grouped by lead signal.</p></div><MessageSquareText size={18} /></div>
          <div className="admin-list conversation-list">
            {inboxLeads.map((lead) => (
              <a href="/dashboard/limitless/leads" className="admin-list-row compact conversation-row" key={lead.id}>
                <div>
                  <strong>{leadLabel(lead)}</strong>
                  <span>{leadMeta(lead)}</span>
                </div>
                <em>{lead.score || leadStatus(lead)}</em>
              </a>
            ))}
            {!inboxLeads.length ? <p className="admin-empty">No active conversations are visible yet.</p> : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>AI + Human Handoff</h2><p>Where AI should continue, and where a human should step in.</p></div><PhoneCall size={18} /></div>
          <div className="admin-grid three conversation-handoff-grid">
            <article className="admin-panel compact"><Bot size={18} /><strong>{Math.max(activeLeads.length - attentionLeads.length, 0)}</strong><span>AI can continue</span></article>
            <article className="admin-panel compact"><UserCheck size={18} /><strong>{attentionLeads.length}</strong><span>Human review suggested</span></article>
            <article className="admin-panel compact"><Clock3 size={18} /><strong>{failedCampaigns.length}</strong><span>Delivery checks</span></article>
          </div>
          <div className="admin-list">
            {recentCampaigns.map((campaign) => (
              <a href="/dashboard/limitless/campaigns" className="admin-list-row compact" key={campaign.id}>
                <div><strong>{campaign.campaign_topic}</strong><span>{campaign.accepted} sent · {campaign.failed} failed · {campaign.skipped} skipped</span></div>
                <em>{campaign.attempted}</em>
              </a>
            ))}
            {!recentCampaigns.length ? <p className="admin-empty">No recent campaign conversations returned yet.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
