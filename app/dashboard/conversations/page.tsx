import { AlertTriangle, Bot, CheckCircle2, Clock3, MessageSquareText, PhoneCall, UserCheck } from "@/components/admin/ServerIcons";
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
    getLeads(200).catch(() => []),
    getCampaignReports(30).catch(() => []),
    getN8nStatus().catch(() => ({ configured: false, activeWorkflows: 0, workflows: [], error: "Automation engine is temporarily unavailable" })),
    getSupabaseReadiness().catch(() => ({ configured: false, ready: false, tables: [] })),
  ]);

  const activeLeads = leads.filter((lead) => !["closed", "converted", "cold"].includes(leadStatus(lead)));
  const attentionLeads = activeLeads.filter(isAttentionLead).slice(0, 5);
  const inboxLeads = activeLeads.slice(0, 12);
  const selectedLead = inboxLeads[0] || null;
  const recentCampaigns = campaigns.slice(0, 5);
  const failedCampaigns = campaigns.filter((campaign) => Number(campaign.failed || 0) > 0).slice(0, 5);
  const platformHealthy = supabase.ready && !n8n.error;
  const handoffCount = attentionLeads.length + failedCampaigns.length;

  return (
    <main className="admin-page dashboard-v2-page conversations-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Conversations</p>
          <h1>Conversation Center</h1>
          <p>Monitor AI-led conversations, follow-up pressure, delivery issues and human handoff from one operating workspace.</p>
        </div>
        <span className={handoffCount ? "admin-status warning" : "admin-status live"}>{handoffCount ? `${handoffCount} need attention` : "Inbox stable"}</span>
      </header>

      <div className="admin-metric-grid">
        <section className="admin-panel compact"><p>Active conversations</p><strong>{activeLeads.length}</strong><span className="admin-muted">CRM records still open</span></section>
        <section className="admin-panel compact"><p>Need attention</p><strong>{attentionLeads.length}</strong><span className="admin-muted">Follow-up or handoff signals</span></section>
        <section className="admin-panel compact"><p>Recent outbound</p><strong>{recentCampaigns.length}</strong><span className="admin-muted">Campaign conversation pushes</span></section>
        <section className="admin-panel compact"><p>Automation state</p><strong>{platformHealthy ? "Live" : "Check"}</strong><span className="admin-muted">Supabase + workflow health</span></section>
      </div>

      <section className="admin-panel conversation-workspace" aria-label="Conversation workspace">
        <aside className="conversation-pane">
          <div className="conversation-pane-head">
            <div><h2>Inbox</h2><p>Open conversations ordered by current CRM activity.</p></div>
            <MessageSquareText size={17} />
          </div>
          <div className="admin-list conversation-list">
            {inboxLeads.map((lead, index) => (
              <a href="/dashboard/limitless/leads" className={`admin-list-row compact conversation-row ${index === 0 ? "is-selected" : ""}`} key={lead.id}>
                <div><strong>{leadLabel(lead)}</strong><span>{leadMeta(lead)}</span></div>
                <em className={isAttentionLead(lead) ? "bad" : "muted"}>{lead.score || leadStatus(lead)}</em>
              </a>
            ))}
            {!inboxLeads.length ? <p className="admin-empty">No active conversations are visible yet.</p> : null}
          </div>
        </aside>

        <section className="conversation-pane">
          <div className="conversation-pane-head">
            <div>
              <h2>{selectedLead ? leadLabel(selectedLead) : "Conversation"}</h2>
              <p>{selectedLead ? leadMeta(selectedLead) : "Select an active conversation to inspect its context."}</p>
            </div>
            {selectedLead ? <span className={isAttentionLead(selectedLead) ? "admin-status warning" : "admin-status live"}>{leadStatus(selectedLead)}</span> : null}
          </div>

          {selectedLead ? (
            <>
              <div className="conversation-thread" aria-label="Conversation summary">
                <div className="conversation-bubble">
                  Current CRM context is available for this lead. Open the lead record for the complete message history and actions.
                </div>
                <div className="conversation-bubble ai">
                  AI workflow state is {platformHealthy ? "available" : "partially unavailable"}. Handoff and follow-up remain governed by the existing CRM workflow.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <a className="admin-button primary-button" href="/dashboard/limitless/leads"><UserCheck size={14} /> Open lead record</a>
                <a className="admin-button secondary-button" href="/dashboard/limitless/followups"><Clock3 size={14} /> Follow-ups</a>
              </div>
            </>
          ) : (
            <div className="admin-empty-state"><div><MessageSquareText size={20} /><p>No active conversation selected.</p></div></div>
          )}
        </section>

        <aside className="conversation-pane">
          <div className="conversation-pane-head">
            <div><h2>Context</h2><p>Handoff pressure, delivery state and next operating signal.</p></div>
            <PhoneCall size={17} />
          </div>

          <div className="conversation-context-card">
            <span className="admin-kicker">AI / HUMAN</span>
            <strong>{selectedLead && isAttentionLead(selectedLead) ? "Human review suggested" : "AI can continue"}</strong>
            <span className="admin-muted">{selectedLead ? `Status: ${leadStatus(selectedLead)} · Score: ${selectedLead.score || "unavailable"}` : "No selected lead"}</span>
          </div>
          <div className="conversation-context-card">
            <span className="admin-kicker">DELIVERY</span>
            <strong>{failedCampaigns.length ? `${failedCampaigns.length} outbound issue${failedCampaigns.length === 1 ? "" : "s"}` : "No recent delivery failure"}</strong>
            <span className="admin-muted">{recentCampaigns.length} recent outbound campaign{recentCampaigns.length === 1 ? "" : "s"} visible.</span>
          </div>
          <div className="conversation-context-card">
            <span className="admin-kicker">SYSTEM</span>
            <strong>{platformHealthy ? "Connected" : "Needs review"}</strong>
            <span className="admin-muted">Supabase and workflow health are used as the current operational signal.</span>
          </div>
        </aside>
      </section>

      <section className="admin-panel conversations-hero-panel">
        <div className="admin-panel-header">
          <div><h2>Needs your attention</h2><p>Conversation and delivery signals that should be reviewed before they become missed opportunities.</p></div>
          <AlertTriangle size={18} />
        </div>
        <div className="admin-list">
          {attentionLeads.map((lead) => (
            <a href="/dashboard/limitless/leads" className="admin-list-row compact attention-danger" key={lead.id}>
              <div><strong>{leadLabel(lead)}</strong><span>{leadMeta(lead)}</span></div>
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
            <div className="admin-list-row compact"><div><strong>No urgent conversation issues</strong><span>The visible inbox does not show handoff or delivery problems.</span></div><CheckCircle2 size={17} /></div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Recent outbound activity</h2><p>Latest campaign pushes connected to the conversation layer.</p></div><Bot size={18} /></div>
        <div className="admin-list">
          {recentCampaigns.map((campaign) => (
            <a href="/dashboard/limitless/campaigns" className="admin-list-row compact" key={campaign.id}>
              <div><strong>{campaign.campaign_topic}</strong><span>{campaign.accepted} sent · {campaign.failed} failed · {campaign.skipped} skipped</span></div>
              <em>{campaign.attempted}</em>
            </a>
          ))}
          {!recentCampaigns.length ? <p className="admin-empty">No recent outbound activity returned yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
