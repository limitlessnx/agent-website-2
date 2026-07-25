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
  const gencouv = summary.agents.filter((agent) => {
    const project = summary.projects.find((item) => item.id === agent.project_id);
    return /gencouv/i.test(`${agent.name} ${project?.name || ""}`);
  }).length;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Phase 3</p>
          <h1>Agent Management</h1>
          <p>Configure AI employees, prompts, models, channels, knowledge, escalation and workflow ownership from one control layer.</p>
        </div>
      </div>

      {error ? <section className="admin-panel"><div className="admin-list-row attention-danger"><div><strong>Agent schema is not ready</strong><span>{error}</span></div><em>migration required</em></div></section> : null}

      <div className="admin-metric-grid">
        <MetricCard icon={Bot} tone="violet" label="Registered agents" value={summary.agents.length} detail={`${active} active`} trend="workforce" />
        <MetricCard icon={Network} tone="cyan" label="Projects" value={summary.projects.length} detail="Tenant-aware" trend="projects" />
        <MetricCard icon={Workflow} tone="emerald" label="Connected workflows" value={summary.workflows.length} detail={`${summary.links.length} links`} trend="orchestration" />
        <MetricCard icon={ShieldCheck} tone="amber" label="Gencouv agents" value={gencouv} detail="Ecosystem provisioned" trend="Gencouv" />
      </div>

      <AgentManagementCenter summary={summary} />
    </div>
  );
}