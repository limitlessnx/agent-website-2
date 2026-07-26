import { AlertTriangle, CheckCircle2, Clock3, PauseCircle, PlayCircle, Workflow } from "lucide-react";
import MetricCard from "@/components/admin/MetricCard";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function WorkflowRegistryPage() {
  let summary;

  try {
    summary = await getWorkflowRegistrySummary();
  } catch (error) {
    summary = {
      configured: true,
      workflows: [],
      runs: [],
      active: 0,
      paused: 0,
      failures: 0,
      successRate: 0,
      error: error instanceof Error ? error.message : "Unable to load workflow registry.",
    };
  }

  const recentRuns = summary.runs.slice(0, 20);
  const groups = summary.workflows.reduce<Record<string, typeof summary.workflows>>((accumulator, workflow) => {
    const key = `${workflow.organization_id || "platform"}::${workflow.project_id || "unassigned"}`;
    accumulator[key] = [...(accumulator[key] || []), workflow];
    return accumulator;
  }, {});

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">AI Operations Registry</p>
          <h1>Workflow Registry</h1>
          <p>Organization-scoped workflow inventory grouped by workspace, project, provider and execution state.</p>
        </div>
      </header>

      {"error" in summary && summary.error ? (
        <section className="admin-panel">
          <div className="admin-list-row attention-danger"><div><strong>Registry schema needs attention</strong><span>{summary.error}</span></div><em>action</em></div>
        </section>
      ) : null}

      <div className="admin-metric-grid">
        <MetricCard icon={Workflow} tone="cyan" label="Registered workflows" value={summary.workflows.length} detail={`${summary.active} active`} trend="registry" />
        <MetricCard icon={PlayCircle} tone="emerald" label="Success rate" value={`${summary.successRate}%`} detail={`${summary.runs.length} recent runs`} trend="execution" />
        <MetricCard icon={PauseCircle} tone="amber" label="Paused workflows" value={summary.paused} detail="Manual safety control" trend="status" />
        <MetricCard icon={AlertTriangle} tone="violet" label="Failed runs" value={summary.failures} detail="Recent execution window" trend="errors" />
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Organization Workflow Groups</h2><p>Each group represents an organization and project boundary.</p></div>
          <span className={summary.configured ? "admin-status live" : "admin-status warning"}>{summary.configured ? "Registry connected" : "Registry pending"}</span>
        </div>
        <div className="admin-list">
          {Object.entries(groups).map(([key, workflows]) => {
            const [organization, project] = key.split("::");
            const active = workflows.filter((workflow) => workflow.status === "active").length;
            return (
              <article key={key} className="admin-panel compact">
                <div className="admin-panel-header">
                  <div><h2>{organization}</h2><p>Project: {project} · {workflows.length} workflow(s) · {active} active</p></div>
                  <em className="admin-status live">{active}/{workflows.length}</em>
                </div>
                <div className="admin-list">
                  {workflows.map((workflow) => (
                    <div key={workflow.id} className="admin-list-row compact">
                      <div>
                        <strong>{workflow.name}</strong>
                        <span>{workflow.workflow_key} · {workflow.provider} v{workflow.current_version}</span>
                        <span>Last run: {formatDate(workflow.last_run_at)} · Endpoint {workflow.endpoint_url ? "configured" : "missing"}</span>
                      </div>
                      <em className={workflow.status === "active" ? "good" : workflow.status === "error" ? "bad" : "muted"}>{workflow.status}</em>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
          {!summary.workflows.length ? (
            <div className="admin-list-row compact"><div><strong>No workflows registered</strong><span>Register organization workflows through the canonical workflow contract.</span></div><em>empty</em></div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Unified Execution Activity</h2><p>Recent runs across all organization workspaces.</p></div></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Workflow</th><th>Project</th><th>Status</th><th>Attempt</th><th>Duration</th><th>Time / Error</th></tr></thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr key={run.id}>
                  <td>{run.workflow_key}</td>
                  <td>{run.project_id}</td>
                  <td><span className={run.status === "succeeded" ? "good" : ["failed", "timed_out"].includes(run.status) ? "bad" : "muted"}>{run.status === "succeeded" ? <CheckCircle2 size={13} /> : <Clock3 size={13} />} {run.status}</span></td>
                  <td>{run.attempt}</td>
                  <td>{run.duration_ms ? `${run.duration_ms.toLocaleString("en-NG")} ms` : "Pending"}</td>
                  <td>{run.error_message || formatDate(run.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recentRuns.length ? <p className="admin-empty">No workflow runs have been recorded.</p> : null}
        </div>
      </section>
    </main>
  );
}
