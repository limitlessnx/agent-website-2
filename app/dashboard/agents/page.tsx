import { Bot, Network, ShieldCheck, Workflow } from "@/components/admin/ServerIcons";
import AgentManagementCenter from "@/components/admin/AgentManagementCenter";
import MetricCard from "@/components/admin/MetricCard";
import { getAgentManagementSummary } from "@/lib/agent-management";

export const dynamic = "force-dynamic";

function countHandoffDestination(destination: unknown) {
  return Boolean(destination && typeof destination === "object" && Object.keys(destination).length);
}

function channelsFor(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
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

  const totalAgents = summary.agents.length;
  const active = summary.agents.filter((agent) => agent.status === "active").length;
  const drafts = summary.agents.filter((agent) => agent.status === "draft").length;
  const attention = summary.agents.filter((agent) => ["error", "disabled"].includes(agent.status || "")).length;
  const organizations = new Set(summary.agents.map((agent) => agent.organization_id).filter(Boolean));
  const handoffReady = summary.agents.filter((agent) => countHandoffDestination(agent.human_handoff_destination)).length;
  const channelSet = new Set(summary.agents.flatMap((agent) => channelsFor(agent.communication_channels)));
  const activeCoverage = totalAgents ? Math.round((active / totalAgents) * 100) : 0;
  const workflowCoverage = totalAgents ? Math.round((summary.links.length / totalAgents) * 100) : 0;

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
    <main className="admin-page dashboard-v2-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">AI Workforce</p>
          <h1>Agents</h1>
          <p>Manage your AI staff like working team members: role, channel, handoff, workflow access and readiness in one place.</p>
        </div>
        <span className={attention ? "admin-status warning" : "admin-status live"}>
          {attention ? `${attention} need review` : "Workforce stable"}
        </span>
      </header>

      {error ? (
        <section className="admin-panel">
          <div className="admin-list-row attention-danger">
            <div>
              <strong>Agent data needs attention</strong>
              <span>{error}</span>
            </div>
            <em>action</em>
          </div>
        </section>
      ) : null}

      <div className="admin-metric-grid">
        <MetricCard icon={Bot} tone="violet" label="Active agents" value={active} detail={`${drafts} draft${drafts === 1 ? "" : "s"} in builder`} trend="workforce" />
        <MetricCard icon={Network} tone="cyan" label="Workspaces" value={organizations.size} detail={`${summary.projects.length} agent group${summary.projects.length === 1 ? "" : "s"}`} trend="tenancy" />
        <MetricCard icon={Workflow} tone="emerald" label="Workflow links" value={summary.links.length} detail={`${summary.workflows.length} workflows available`} trend="orchestration" />
        <MetricCard icon={ShieldCheck} tone="amber" label="Human handoff" value={handoffReady} detail="Agents with escalation routing" trend="governance" />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Workforce Readiness</h2>
            <p>Quick operating view before you edit individual agents. Because apparently even AI employees need management.</p>
          </div>
          <span className="admin-status live">Command view</span>
        </div>
        <div className="admin-grid four">
          <article className="admin-panel compact">
            <strong>{activeCoverage}%</strong>
            <p>active workforce coverage</p>
          </article>
          <article className="admin-panel compact">
            <strong>{workflowCoverage}%</strong>
            <p>workflow-link density</p>
          </article>
          <article className="admin-panel compact">
            <strong>{channelSet.size}</strong>
            <p>customer channels covered</p>
          </article>
          <article className="admin-panel compact">
            <strong>{attention}</strong>
            <p>agents needing review</p>
          </article>
        </div>
      </section>

      {liveGroups.length ? (
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div>
              <h2>Live Agent Groups</h2>
              <p>Grouped by workspace so each business unit has a visible AI team, not a depressing spreadsheet pretending to be strategy.</p>
            </div>
            <span className="admin-status live">Connected</span>
          </div>
          <div className="admin-grid two">
            {liveGroups.map(({ project, agents, active: activeAgents, workflows }) => (
              <article key={project.id} className="admin-panel compact">
                <div className="admin-panel-header">
                  <div>
                    <h2>{project.name}</h2>
                    <p>{agents.length} agent{agents.length === 1 ? "" : "s"} · {workflows} linked workflow{workflows === 1 ? "" : "s"}</p>
                  </div>
                  <span className={activeAgents ? "admin-status live" : "admin-status warning"}>{activeAgents}/{agents.length} active</span>
                </div>
                <div className="admin-list">
                  {agents.map((agent) => {
                    const channelCount = channelsFor(agent.communication_channels).length;
                    const hasHandoff = countHandoffDestination(agent.human_handoff_destination);
                    return (
                      <div className="admin-list-row compact" key={agent.id}>
                        <div>
                          <strong>{agent.name}</strong>
                          <span>{agent.agent_type || "custom agent"} · {channelCount || "no"} channel{channelCount === 1 ? "" : "s"} · {hasHandoff ? "handoff ready" : "handoff missing"}</span>
                        </div>
                        <em className={agent.status === "active" ? "good" : agent.status === "error" ? "bad" : "muted"}>{agent.status}</em>
                      </div>
                    );
                  })}
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
