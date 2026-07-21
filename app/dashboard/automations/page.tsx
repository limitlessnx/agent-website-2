import { automationProjects, getN8nStatus } from "@/lib/limitless-data";

export default async function AutomationsPage() {
  const n8n = await getN8nStatus();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Workspace</p>
          <h1>Automation Projects</h1>
          <p>Control Limitless Realty and future client systems from the same backend structure.</p>
        </div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>Projects</h2>
          <p>Each project can later get its own leads, workflows, prompts, and reports.</p>
        </div>
        <div className="admin-list">
          {automationProjects.map((project) => (
            <div key={project.id} className="admin-list-row">
              <div>
                <strong>{project.name}</strong>
                <span>{project.channel} - {project.description}</span>
              </div>
              <em>{project.workflows} workflows</em>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <h2>n8n Workflows</h2>
          <p>{n8n.configured ? `${n8n.activeWorkflows} active workflows found.` : "Add n8n env vars to enable live workflow status."}</p>
        </div>
        <div className="admin-list">
          {n8n.workflows.slice(0, 20).map((workflow) => (
            <div key={workflow.id} className="admin-list-row">
              <div>
                <strong>{workflow.name}</strong>
                <span>{workflow.id}</span>
              </div>
              <em>{workflow.active ? "active" : "inactive"}</em>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
