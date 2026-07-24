import { AlertTriangle, CheckCircle2, Clock3, PauseCircle, PlayCircle, Workflow } from "lucide-react";
import MetricCard from "@/components/admin/MetricCard";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";

function formatDate(value?: string) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

  const recentRuns = summary.runs.slice(0, 12);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Orchestrator</p>
          <h1>Workflow Registry</h1>
          <p>Register, identify, and monitor every automation from one canonical control layer.</p>
        </div>
      </div>

      {"error" in summary && summary.error ? (
        <section className="admin-panel">
          <div className="admin-list-row attention-danger">
            <div>
              <strong>Registry schema is not ready</strong>
              <span>{summary.error}</span>
            </div>
            <em>setup required</em>
          </div>
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
          <div>
            <h2>Registered Workflows</h2>
            <p>Each workflow has a stable key, provider, endpoint, version, and operating status.</p>
          </div>
          <span className={summary.configured ? "admin-status live" : "admin-status warning"}>
            {summary.configured ? "Supabase connected" : "Supabase missing"}
          </span>
        </div>
        <div className="admin-list">
          {summary.workflows.map((workflow) => (
            <div key={workflow.id} className="admin-list-row">
              <div>
                <strong>{workflow.name}</strong>
                <span>
                  {workflow.organization_id} / {workflow.project_id} / {workflow.workflow_key} · {workflow.provider} v{workflow.current_version}
                </span>
                <span>
                  Last run: {formatDate(workflow.last_run_at)} · Endpoint: {workflow.endpoint_url ? "configured" : "missing"}
                </span>
              </div>
              <em className={workflow.status === "active" ? "good" : workflow.status === "error" ? "bad" : "muted"}>
                {workflow.status}
              </em>
            </div>
          ))}
          {!summary.workflows.length ? (
            <div className="admin-list-row compact">
              <div>
                <strong>No workflows registered yet</strong>
                <span>Run the Supabase schema, then register workflows through POST /api/workflows.</span>
              </div>
              <em>empty</em>
            </div>
          ) : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Recent Runs</h2>
            <p>Execution history reported through the Fluxknight workflow contract.</p>
          </div>
        </div>
        <div className="admin-list">
          {recentRuns.map((run) => (
            <div key={run.id} className="admin-list-row">
              <div>
                <strong>{run.workflow_key}</strong>
                <span>
                  {run.project_id} · attempt {run.attempt} · {run.duration_ms ? `${run.duration_ms} ms` : "duration pending"}
                </span>
                <span>{run.error_message || formatDate(run.created_at)}</span>
              </div>
              <em className={run.status === "succeeded" ? "good" : ["failed", "timed_out"].includes(run.status) ? "bad" : "muted"}>
                {run.status === "succeeded" ? <CheckCircle2 size={14} /> : <Clock3 size={14} />} {run.status}
              </em>
            </div>
          ))}
          {!recentRuns.length ? <p className="admin-empty">No workflow runs have been recorded.</p> : null}
        </div>
      </section>
    </div>
  );
}
