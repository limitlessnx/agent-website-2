import { Bot, Network, ShieldCheck, Workflow } from "@/components/admin/ServerIcons";
import AgentManagementCenter from "@/components/admin/AgentManagementCenter";
import MetricCard from "@/components/admin/MetricCard";
import { getAgentManagementSummary } from "@/lib/agent-management";

export const dynamic = "force-dynamic";

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
  const drafts = summary.agents.filter((agent) => agent.status === "draft").length;
  const organizations = new Set(summary.agents.map((agent) => agent.organization_id).filter(Boolean));
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
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">AI Workforce</p>
          <h1>Agents</h1>
          <p>Manage active agents and continue editing drafts from one workspace.</p>
        </div>
      </header>

      {error ? <section className="admin-panel"><div className="admin-list-row attention-danger"><div><strong>Agent data needs attention</strong><span>{error}</span></div><em>action</em></div></section> : null}

      <div className="admin-metric-grid">
        <MetricCard icon={Bot} tone="violet" label="Active agents" value={active} detail={`${drafts} draft${drafts === 1 ? "" : "s"} in builder`} trend="workforce" />
        <MetricCard icon={Network} tone="cyan" label="Workspaces" value={organizations.size} detail={`${summary.projects.length} agent groups`} trend="tenancy" />
        <MetricCard icon={Workflow} tone="emerald" label="Workflow links" value={summary.links.length} detail={`${summary.workflows.length} workflows available`} trend="orchestration" />
        <MetricCard icon={ShieldCheck} tone="amber" label="Human handoff" value={summary.agents.filter((agent) => agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length).length} detail="Agents with escalation routing" trend="governance" />
      </div>

      {liveGroups.length ? (
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Live Agent Groups</h2><p>Only active, paused, disabled or error-state agents appear here. Drafts remain in the editor below.</p></div><span className="admin-status live">Connected</span></div>
          <div className="admin-list">
            {liveGroups.map(({ project, agents, active: activeAgents, workflows }) => (
              <article key={project.id} className="admin-panel compact">
                <div className="admin-panel-header">
                  <div><h2>{project.name}</h2><p>{agents.length} agent{agents.length === 1 ? "" : "s"} · {workflows} linked workflow{workflows === 1 ? "" : "s"}</p></div>
                  <span className={activeAgents ? "admin-status live" : "admin-status warning"}>{activeAgents}/{agents.length} active</span>
                </div>
                <div className="admin-list">
                  {agents.map((agent) => (
                    <div className="admin-list-row compact" key={agent.id}>
                      <div>
                        <strong>{agent.name}</strong>
                        <span>{agent.agent_type || "custom agent"} · {Array.isArray(agent.communication_channels) ? agent.communication_channels.join(", ") || "no channels" : "no channels"}</span>
                      </div>
                      <em className={agent.status === "active" ? "good" : agent.status === "error" ? "bad" : "muted"}>{agent.status}</em>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <AgentManagementCenter summary={summary} />
    </main>
  );
}
