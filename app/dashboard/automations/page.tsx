import { automationProjects, getN8nStatus } from "@/lib/limitless-data";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";
import WorkflowRegistryClient from "./WorkflowRegistryClient";

export default async function AutomationsPage() {
  const [n8n, registry] = await Promise.all([getN8nStatus(), getWorkflowRegistrySummary()]);

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

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>n8n discovery</h2>
          <p>{n8n.configured ? `${n8n.activeWorkflows} active workflows found in n8n.` : "Add n8n environment variables to enable live workflow discovery."}</p>
        </div>
        <div className="admin-list">
          {n8n.workflows.slice(0, 20).map((workflow) => (
            <div key={workflow.id} className="admin-list-row">
              <div>
                <strong>{workflow.name}</strong>
                <span>External ID: {workflow.id}</span>
              </div>
              <em>{workflow.active ? "active" : "inactive"}</em>
            </div>
          ))}
          {!n8n.workflows.length ? <p>No n8n workflows discovered yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
