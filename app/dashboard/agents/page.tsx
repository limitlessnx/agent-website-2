import { Bot, Network, ShieldCheck, Workflow } from "lucide-react";
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
  const organizations = new Set(summary.agents.map((agent) => agent.organization_id).filter(Boolean));
  const groups = summary.projects.map((project) => {
    const agents = summary.agents.filter((agent) => agent.project_id === project.id);
    const linkedWorkflowIds = new Set(
      summary.links.filter((link) => agents.some((agent) => agent.id === link.agent_id)).map((link) => link.workflow_id),
    );
    return { project, agents, active: agents.filter((agent) => agent.status === "active").length, workflows: linkedWorkflowIds.size };
  });

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">AI Workforce Registry</p>
          <h1>Agent Registry</h1>
          <p>Organization-scoped AI employees grouped by purpose, channels, knowledge, escalation and workflow ownership.</p>
        </div>
      </header>

      {error ? <section className="admin-panel"><div className="admin-list-row attention-danger"><div><strong>Agent schema needs attention</strong><span>{error}</span></div><em>action</em></div></section> : null}

      <div className="admin-metric-grid">
        <MetricCard icon={Bot} tone="violet" label="Registered agents" value={summary.agents.length} detail={`${active} active`} trend="workforce" />
        <MetricCard icon={Network} tone="cyan" label="Organizations" value={organizations.size} detail={`${summary.projects.length} projects`} trend="tenancy" />
        <MetricCard icon={Workflow} tone="emerald" label="Workflow links" value={summary.links.length} detail={`${summary.workflows.length} workflows available`} trend="orchestration" />
        <MetricCard icon={ShieldCheck} tone="amber" label="Governed agents" value={summary.agents.filter((agent) => agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length).length} detail="Central model + handoff controls" trend="governance" />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Organization Agent Groups</h2><p>Workspace and project boundaries for the AI workforce.</p></div><span className={summary.configured ? "admin-status live" : "admin-status warning"}>{summary.configured ? "Registry connected" : "Registry pending"}</span></div>
        <div className="admin-list">
          {groups.map(({ project, agents, active: activeAgents, workflows }) => (
            <article key={project.id} className="admin-panel compact">
              <div className="admin-panel-header">
                <div><h2>{project.name}</h2><p>{project.organization_id} · {agents.length} agent(s) · {workflows} linked workflow(s)</p></div>
                <span className={activeAgents ? "admin-status live" : "admin-status warning"}>{activeAgents}/{agents.length} active</span>
              </div>
              <div className="admin-list">
                {agents.map((agent) => (
                  <div className="admin-list-row compact" key={agent.id}>
                    <div>
                      <strong>{agent.name}</strong>
                      <span>{agent.agent_type || "custom agent"} · model centrally assigned · {Array.isArray(agent.communication_channels) ? agent.communication_channels.join(", ") || "no channels" : "no channels"}</span>
                    </div>
                    <em className={agent.status === "active" ? "good" : agent.status === "error" ? "bad" : "muted"}>{agent.status}</em>
                  </div>
                ))}
                {!agents.length ? <p className="admin-empty">No agents provisioned for this project.</p> : null}
              </div>
            </article>
          ))}
          {!groups.length ? <div className="admin-list-row compact"><div><strong>No organization projects found</strong><span>Complete onboarding provisioning to create the first grouped agent workspace.</span></div><em>empty</em></div> : null}
        </div>
      </section>

      <AgentManagementCenter summary={summary} />
    </main>
  );
}
