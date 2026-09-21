import { AlertTriangle, CheckCircle2, Clock3, PauseCircle, Play, Settings2, Workflow, Zap } from "@/components/admin/ServerIcons";
import MetricCard from "@/components/admin/MetricCard";
import { getWorkflowRegistrySummary, type WorkflowRecord, type WorkflowRun } from "@/lib/workflow-registry";

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatDuration(value?: number | null) {
  if (!value) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
}

function workflowTone(status: WorkflowRecord["status"]) {
  if (status === "active") return "live";
  if (status === "error" || status === "disabled") return "warning";
  return "";
}

function runTone(status: WorkflowRun["status"]) {
  if (status === "succeeded") return "good";
  if (["failed", "timed_out", "cancelled"].includes(status)) return "bad";
  return "muted";
}

export default async function AutomationsPage() {
  let summary;

  try {
    summary = await getWorkflowRegistrySummary();
  } catch (error) {
    summary = {
      configured: false,
      workflows: [],
      runs: [],
      active: 0,
      paused: 0,
      failures: 0,
      successRate: 0,
      error: error instanceof Error ? error.message : "Automation data is unavailable.",
    };
  }

  const failedRuns = summary.runs.filter((run) => ["failed", "timed_out", "cancelled"].includes(run.status)).slice(0, 6);
  const runningRuns = summary.runs.filter((run) => ["queued", "running"].includes(run.status)).length;
  const recentRuns = summary.runs.slice(0, 10);
  const activeWorkflows = summary.workflows.filter((workflow) => workflow.status === "active");
  const pausedWorkflows = summary.workflows.filter((workflow) => workflow.status === "paused");
  const attentionWorkflows = summary.workflows.filter((workflow) => ["error", "disabled"].includes(workflow.status));
  const providers = new Set(summary.workflows.map((workflow) => workflow.provider).filter(Boolean));
  const healthLabel = !summary.configured || ("error" in summary && summary.error)
    ? "Setup required"
    : summary.failures || attentionWorkflows.length
      ? "Needs attention"
      : "Healthy";

  return (
    <main className="admin-page dashboard-v2-page automations-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">AI Workforce</p>
          <h1>Automations</h1>
          <p>See what is running, what is paused, and what needs attention across your business automation layer.</p>
        </div>
        <span className={summary.failures || attentionWorkflows.length || !summary.configured ? "admin-status warning" : "admin-status live"}>{healthLabel}</span>
      </header>

      <div className="admin-metric-grid">
        <MetricCard icon={Play} tone="emerald" label="Active automations" value={summary.active} detail="Currently available to run" trend="live" />
        <MetricCard icon={CheckCircle2} tone="cyan" label="Success rate" value={`${summary.successRate}%`} detail="Recent completed runs" trend="delivery" />
        <MetricCard icon={Clock3} tone="amber" label="In progress" value={runningRuns} detail="Queued or running now" trend="queue" />
        <MetricCard icon={AlertTriangle} tone="violet" label="Needs attention" value={failedRuns.length + attentionWorkflows.length} detail="Failed runs or unhealthy automations" trend="review" />
      </div>

      {"error" in summary && summary.error ? (
        <section className="admin-panel">
          <div className="admin-list-row attention-danger">
            <div><strong>Automation setup needs attention</strong><span>{summary.error}</span></div>
            <em>Review setup</em>
          </div>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Automation overview</h2>
            <p>A quick view of coverage before you inspect individual automations.</p>
          </div>
          <Workflow size={18} />
        </div>
        <div className="admin-grid four">
          <article className="admin-panel compact"><strong>{summary.workflows.length}</strong><p>total automations</p></article>
          <article className="admin-panel compact"><strong>{pausedWorkflows.length}</strong><p>paused automations</p></article>
          <article className="admin-panel compact"><strong>{providers.size}</strong><p>connected providers</p></article>
          <article className="admin-panel compact"><strong>{recentRuns.length}</strong><p>recent run records</p></article>
        </div>
      </section>

      <div className="admin-grid two">
        <section className="admin-panel">
          <div className="admin-panel-header">
            <div><h2>Automation library</h2><p>Current workflows, ownership, trigger type and operating state.</p></div>
            <Zap size={18} />
          </div>
          <div className="admin-list">
            {summary.workflows.slice(0, 16).map((workflow) => (
              <div className="admin-list-row" key={workflow.id}>
                <div>
                  <strong>{workflow.name}</strong>
                  <span>{workflow.description || `${workflow.project_id} · ${workflow.trigger_type || "trigger"} · ${workflow.provider}`}</span>
                  <span>{workflow.environment || "production"} · last run {formatDate(workflow.last_run_at)}</span>
                </div>
                <em className={workflowTone(workflow.status)}>{workflow.status}</em>
              </div>
            ))}
            {!summary.workflows.length ? <p className="admin-empty">No registered automations are visible yet.</p> : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header">
            <div><h2>Needs attention</h2><p>Failures and unhealthy automation states worth reviewing first.</p></div>
            <AlertTriangle size={18} />
          </div>
          <div className="admin-list">
            {attentionWorkflows.map((workflow) => (
              <div className="admin-list-row" key={`workflow-${workflow.id}`}>
                <div>
                  <strong>{workflow.name}</strong>
                  <span>{workflow.project_id} · {workflow.provider}</span>
                  <span>Last error {formatDate(workflow.last_error_at)}</span>
                </div>
                <em className="bad">{workflow.status}</em>
              </div>
            ))}
            {failedRuns.map((run) => (
              <div className="admin-list-row" key={`run-${run.id}`}>
                <div>
                  <strong>{run.workflow_key || "Automation run"}</strong>
                  <span>{run.error_message || "The automation did not complete successfully."}</span>
                  <span>{formatDate(run.completed_at || run.created_at)}</span>
                </div>
                <em className="bad">{run.status}</em>
              </div>
            ))}
            {!attentionWorkflows.length && !failedRuns.length ? (
              <div className="admin-list-row compact">
                <div><strong>No automation issues</strong><span>Recent automation activity does not show failures or unhealthy workflow states.</span></div>
                <em className="good">Healthy</em>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Recent automation activity</h2><p>Latest runs across your registered workflows.</p></div>
          <Clock3 size={18} />
        </div>
        <div className="admin-list">
          {recentRuns.map((run) => (
            <div className="admin-list-row" key={run.id}>
              <div>
                <strong>{run.workflow_key}</strong>
                <span>{run.project_id || "Platform"} · attempt {run.attempt} · {formatDuration(run.duration_ms)}</span>
                <span>{formatDate(run.completed_at || run.started_at || run.created_at)}</span>
              </div>
              <em className={runTone(run.status)}>{run.status}</em>
            </div>
          ))}
          {!recentRuns.length ? <p className="admin-empty">No recent automation runs are visible yet.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Operating states</h2><p>Current automation availability without exposing unnecessary implementation detail.</p></div>
          <Settings2 size={18} />
        </div>
        <div className="admin-grid three">
          <article className="admin-panel compact"><Play size={18} /><strong>{activeWorkflows.length}</strong><p>active and available</p></article>
          <article className="admin-panel compact"><PauseCircle size={18} /><strong>{pausedWorkflows.length}</strong><p>paused intentionally</p></article>
          <article className="admin-panel compact"><AlertTriangle size={18} /><strong>{attentionWorkflows.length}</strong><p>disabled or error state</p></article>
        </div>
      </section>
    </main>
  );
}
