import { automationProjects, getN8nStatus } from "@/lib/limitless-data";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";
import N8nDiscoveryClient from "./N8nDiscoveryClient";
import WorkflowRegistryClient from "./WorkflowRegistryClient";

export default async function AutomationsPage() {
  const [n8n, registry] = await Promise.all([getN8nStatus(), getWorkflowRegistrySummary()]);
  const n8nBaseUrl = (process.env.N8N_BASE_URL || "").replace(/\/$/, "");
  const discoveredWorkflows = n8n.workflows.slice(0, 50).map((workflow) => ({
    ...workflow,
    editor_url: n8nBaseUrl ? `${n8nBaseUrl}/workflow/${workflow.id}` : undefined,
  }));

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Orchestration</p>
          <h1>Workflow Control Center</h1>
          <p>Register, map, monitor, pause, and retry the automations powering every FluxAgents client project.</p>
        </div>
      </div>

      <WorkflowRegistryClient
        initialWorkflows={registry.workflows}
        initialRuns={registry.runs}
        configured={registry.configured}
      />

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Projects</h2>
          <p>Each project can own separate leads, workflows, prompts, reports, and provider credentials.</p>
        </div>
        <div className="admin-list">
          {automationProjects.map((project) => (
            <div key={project.id} className="admin-list-row">
              <div>
                <strong>{project.name}</strong>
                <span>{project.channel} - {project.description}</span>
              </div>
              <em>{project.status}</em>
            </div>
          ))}
        </div>
      </section>

      <N8nDiscoveryClient
        workflows={discoveredWorkflows}
        registeredWorkflows={registry.workflows}
        configured={n8n.configured}
      />
    </div>
  );
}
