import AgentManagementCenter from "@/components/admin/AgentManagementCenter";
import { getAgentManagementSummary } from "@/lib/agent-management";
import styles from "./AgentsWorkforce.module.css";

export const dynamic = "force-dynamic";

function updatedLabel(value?: string) {
  if (!value) return "No recent update";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Update time unavailable";
  return `Updated ${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
}

export default async function AgentManagementPage() {
  let summary;
  let error = "";

  try {
    summary = await getAgentManagementSummary();
  } catch (caught) {
    summary = { configured: true, agents: [], projects: [], workflows: [], links: [] };
    error = caught instanceof Error ? caught.message : "Agent management could not load.";
  }

  const active = summary.agents.filter((agent) => agent.status === "active").length;
  const attention = summary.agents.filter((agent) => ["paused", "error", "disabled"].includes(String(agent.status).toLowerCase())).length;
  const drafts = summary.agents.filter((agent) => agent.status === "draft").length;
  const handoffReady = summary.agents.filter((agent) => agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length).length;
  const liveGroups = summary.projects
    .map((project) => {
      const agents = summary.agents.filter((agent) => agent.project_id === project.id && agent.status !== "draft");
      const linkedWorkflowIds = new Set(
        summary.links.filter((link) => agents.some((agent) => agent.id === link.agent_id)).map((link) => link.workflow_id),
      );
      return { project, agents, active: agents.filter((agent) => agent.status === "active").length, workflows: linkedWorkflowIds.size };
    })
    .filter((group) => group.agents.length > 0);

  return (
    <main className={`admin-page ${styles.page}`}>
      <header className={`admin-page-header ${styles.hero}`}>
        <div>
          <p className="admin-kicker">AI Workforce</p>
          <h1>Agents</h1>
          <p>See who is active, what each agent is responsible for and which members of the workforce need attention.</p>
        </div>
        <div className={styles.heroStatus}>
          <strong>{active}</strong>
          <span>active agents</span>
        </div>
      </header>

      {error ? <section className={styles.errorPanel}><strong>Agent data needs attention</strong><span>{error}</span></section> : null}

      <section className={styles.summary} aria-label="AI workforce summary">
        <div><span>Active</span><strong>{active}</strong></div>
        <div><span>Needs attention</span><strong>{attention}</strong></div>
        <div><span>Drafts</span><strong>{drafts}</strong></div>
        <div><span>Human handoff ready</span><strong>{handoffReady}</strong></div>
      </section>

      <section className={styles.workforcePanel}>
        <header className={styles.panelHeader}>
          <div>
            <p className="admin-kicker">Operating workforce</p>
            <h2>Live agent groups</h2>
            <p>Operational status, connected channels, workflow coverage and the latest configuration update.</p>
          </div>
          <span>{liveGroups.length} group{liveGroups.length === 1 ? "" : "s"}</span>
        </header>

        <div className={styles.groupList}>
          {liveGroups.length ? liveGroups.map(({ project, agents, active: activeAgents, workflows }) => (
            <section key={project.id} className={styles.group}>
              <div className={styles.groupHeader}>
                <div><strong>{project.name}</strong><span>{agents.length} agent{agents.length === 1 ? "" : "s"} · {workflows} linked workflow{workflows === 1 ? "" : "s"}</span></div>
                <span className={styles.groupState}>{activeAgents}/{agents.length} active</span>
              </div>
              <div className={styles.agentList}>
                {agents.map((agent) => {
                  const connected = summary.links.filter((link) => link.agent_id === agent.id).length;
                  const channels = Array.isArray(agent.communication_channels) ? agent.communication_channels.map(String).filter(Boolean) : [];
                  return (
                    <div className={styles.agentRow} key={agent.id}>
                      <div className={styles.agentIdentity}>
                        <strong>{agent.name}</strong>
                        <span>{agent.description || agent.agent_type || "Custom AI agent"}</span>
                      </div>
                      <div className={styles.agentMeta}><span>{channels.length ? channels.join(" · ") : "No channels connected"}</span><span>{connected} workflow{connected === 1 ? "" : "s"}</span></div>
                      <div className={styles.agentMeta}><span>{updatedLabel(agent.updated_at)}</span><span>{agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length ? "Handoff ready" : "No handoff route"}</span></div>
                      <em className={styles.agentStatus} data-status={String(agent.status).toLowerCase()}>{agent.status}</em>
                    </div>
                  );
                })}
              </div>
            </section>
          )) : <div className="admin-empty-state"><strong>No live agents yet</strong><span>Published agents will appear here once they leave draft state.</span></div>}
        </div>
      </section>

      <AgentManagementCenter summary={summary} />
    </main>
  );
}
