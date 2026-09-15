import { getAgentManagementSummary } from "@/lib/agent-management";
import { getCampaignReports, getLeads, getN8nStatus, getProperties, getSupabaseReadiness } from "@/lib/limitless-data";
import styles from "./ActivityTimeline.module.css";

export const dynamic = "force-dynamic";

type ActivityEvent = {
  id: string;
  kind: "agent" | "campaign" | "crm" | "data";
  title: string;
  detail: string;
  state: string;
  href: string;
  timestamp: string | null;
};

function dateLabel(value: string | null) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function marker(kind: ActivityEvent["kind"]) {
  return kind === "agent" ? "AI" : kind === "campaign" ? "CP" : kind === "crm" ? "CRM" : "DQ";
}

export default async function UnifiedActivityPage() {
  const [leads, properties, campaigns, n8n, supabase, agentSummary] = await Promise.all([
    getLeads(120),
    getProperties(120),
    getCampaignReports(30),
    getN8nStatus(),
    getSupabaseReadiness(),
    getAgentManagementSummary().catch(() => ({ configured: false, agents: [], projects: [], workflows: [], links: [] })),
  ]);

  const activeLeads = leads.filter((lead) => !["closed", "converted", "cold"].includes(String(lead.status || "").toLowerCase()));
  const missingMedia = properties.filter((property) => !property.drive_photos_link);
  const liveAgents = agentSummary.agents.filter((agent) => agent.status !== "draft");
  const agentAttention = liveAgents.filter((agent) => ["paused", "disabled", "error"].includes(String(agent.status).toLowerCase())).length;

  const events: ActivityEvent[] = [
    ...agentSummary.agents.slice(0, 20).map((agent) => ({
      id: `agent-${agent.id}`,
      kind: "agent" as const,
      title: `${agent.name} ${agent.status === "draft" ? "saved as draft" : "workforce status updated"}`,
      detail: `${agent.agent_type || "Custom agent"} · ${Array.isArray(agent.communication_channels) && agent.communication_channels.length ? agent.communication_channels.map(String).join(" · ") : "No channels connected"}`,
      state: String(agent.status || "unknown"),
      href: "/dashboard/agents",
      timestamp: agent.updated_at || agent.created_at || null,
    })),
    ...campaigns.slice(0, 20).map((campaign) => ({
      id: `campaign-${campaign.id}`,
      kind: "campaign" as const,
      title: campaign.campaign_topic,
      detail: `${campaign.accepted} sent · ${campaign.failed} failed · ${campaign.skipped} skipped`,
      state: campaign.failed > 0 ? "attention" : "completed",
      href: "/dashboard/limitless/campaigns",
      timestamp: campaign.created_at || null,
    })),
    ...leads.slice(0, 20).map((lead) => ({
      id: `lead-${lead.id}`,
      kind: "crm" as const,
      title: lead.name || "Unnamed lead",
      detail: [lead.phone, lead.location_preference, lead.budget].filter(Boolean).join(" · ") || "CRM record updated",
      state: lead.score || lead.status || "active",
      href: "/dashboard/limitless/leads",
      timestamp: lead.last_contacted_at || lead.last_follow_up_at || lead.created_at || null,
    })),
    ...missingMedia.slice(0, 12).map((property) => ({
      id: `property-${property.id}`,
      kind: "data" as const,
      title: `${property.title} needs media`,
      detail: [property.location_area, property.location_city].filter(Boolean).join(", ") || "Property media link is missing",
      state: "attention",
      href: "/dashboard/limitless/media",
      timestamp: property.created_at || null,
    })),
  ].sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <main className={`admin-page ${styles.page}`}>
      <header className={`admin-page-header ${styles.hero}`}>
        <div>
          <p className="admin-kicker">Operations</p>
          <h1>Activity</h1>
          <p>One operational timeline for AI workforce changes, customer activity, campaign delivery and records that need attention.</p>
        </div>
        <div className={styles.heroStatus}>
          <strong>{supabase.ready && !n8n.error ? "Operational" : "Review required"}</strong>
          <span>{agentAttention ? `${agentAttention} agent state${agentAttention === 1 ? "" : "s"} need attention` : "No agent alerts"}</span>
        </div>
      </header>

      <section className={styles.summary} aria-label="Activity summary">
        <div><span>Live agents</span><strong>{liveAgents.length}</strong></div>
        <div><span>Active CRM records</span><strong>{activeLeads.length}</strong></div>
        <div><span>Active workflows</span><strong>{n8n.activeWorkflows}</strong></div>
        <div><span>Data actions</span><strong>{missingMedia.length}</strong></div>
      </section>

      <section className={styles.layout}>
        <article className={styles.timelinePanel}>
          <header className={styles.panelHeader}>
            <div>
              <p className="admin-kicker">Operational timeline</p>
              <h2>Recent changes</h2>
              <p>Important AI, CRM, campaign and data-quality events ordered by the latest available timestamp.</p>
            </div>
            <span>{events.length} events</span>
          </header>
          <div className={styles.timeline}>
            {events.length ? events.slice(0, 40).map((event) => (
              <a href={event.href} key={event.id} className={styles.event}>
                <span className={styles.marker}>{marker(event.kind)}</span>
                <div className={styles.eventBody}><strong>{event.title}</strong><span>{event.detail}</span></div>
                <div className={styles.eventMeta}><span>{event.state}</span><small>{dateLabel(event.timestamp)}</small></div>
              </a>
            )) : <div className="admin-empty-state"><strong>No recent activity</strong><span>Meaningful operational changes will appear here as the platform runs.</span></div>}
          </div>
        </article>

        <aside className={styles.secondaryPanel}>
          <header className={styles.panelHeader}>
            <div>
              <p className="admin-kicker">Automation state</p>
              <h2>Workflow inventory</h2>
              <p>Current n8n workflow state remains visible without becoming a second activity dashboard.</p>
            </div>
            <span>{n8n.workflows.length} total</span>
          </header>
          <div className={styles.secondaryList}>
            {n8n.workflows.slice(0, 16).map((workflow) => (
              <a href="/dashboard/workflows" className={styles.secondaryRow} key={workflow.id}>
                <div><strong>{workflow.name}</strong><span>{workflow.id}</span></div>
                <em data-state={workflow.active ? "active" : "off"}>{workflow.active ? "active" : "off"}</em>
              </a>
            ))}
            {!n8n.workflows.length ? <div className="admin-empty-state"><strong>No workflow inventory</strong><span>The automation engine did not return any workflows.</span></div> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
