import { AlertTriangle, CheckCircle2, Clock3, PauseCircle, Play, Settings2, Workflow, Zap } from "@/components/admin/ServerIcons";
import MetricCard from "@/components/admin/MetricCard";
import { getWorkflowRegistrySummary, type WorkflowRecord, type WorkflowRun } from "@/lib/workflow-registry";

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDuration(value?: number | null) {
  if (value == null || !Number.isFinite(value) || value < 0) return "—";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
}

function workflowTone(status: WorkflowRecord["status"]) {
  if (status === "active") return "good";
  if (status === "error" || status === "disabled") return "bad";
  return "muted";
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

  const attentionRuns = summary.runs.filter((run) => ["failed", "timed_out", "cancelled"].includes(run.status));
  const visibleAttentionRuns = attentionRuns.slice(0, 6);
  const runningRuns = summary.runs.filter((run) => ["queued", "running"].includes(run.status)).length;
  const recentRuns = summary.runs.slice(0, 10);
  const activeWorkflows = summary.workflows.filter((workflow) => workflow.status === "active");
  const pausedWorkflows = summary.workflows.filter((workflow) => workflow.status === "paused");
  const attentionWorkflows = summary.workflows.filter((workflow) => ["error", "disabled"].includes(workflow.status));
  const providers = new Set(summary.workflows.map((workflow) => workflow.provider).filter(Boolean));
  const attentionKeys = new Set<string>([
    ...attentionWorkflows.map((workflow) => `workflow:${workflow.id}`),
    ...attentionRuns.map((run) => run.workflow_id ? `workflow:${run.workflow_id}` : `run:${run.id}`),
  ]);
  const attentionCount = attentionKeys.size;
  const setupError = "error" in summary && summary.error ? summary.error : null;
  const healthLabel = !summary.configured || setupError
    ? "Setup required"
    : attentionCount
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
        <span className={attentionCount || !summary.configured ? "admin-status warning" : "admin-status live"}>{healthLabel}</span>
      </header>

      <div className="admin-metric-grid">
        <MetricCard icon={Play} tone="emerald" label="Active automations" value={summary.active} detail="Currently available to run" trend="live" />
        <MetricCard icon={CheckCircle2} tone="cyan" label="Success rate" value={`${summary.successRate}%`} detail="Recent completed runs" trend="delivery" />
        <MetricCard icon={Clock3} tone="amber" label="In progress" value={runningRuns} detail="Queued or running now" trend="queue" />
        <MetricCard icon={AlertTriangle} tone="violet" label="Needs attention" value={attentionCount} detail="Unique automations with an issue" trend="review" />
      </div>

      {setupError ? (
        <section className="admin-panel">
          <div className="admin-list-row attention-danger">
            <div><strong>Automation setup needs attention</strong><span>{setupError}</span></div>
            <em className="bad">Review setup</em>
          </div>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Automation overview</h2>
            <p>A quick operating summary before you inspect individual automations.</p>
          </div>
          <Workflow size={18} />
        </div>
        <div className="admin-list">
          <div className="admin-list-row"><div><strong>{summary.workflows.length} registered automations</strong><span>Across {providers.size} connected provider{providers.size === 1 ? "" : "s"}.</span></div><em>{summary.workflows.length}</em></div>
          <div className="admin-list-row"><div><strong>{activeWorkflows.length} active</strong><span>Available to respond to their configured triggers.</span></div><em className="good">Active</em></div>
          <div className="admin-list-row"><div><strong>{pausedWorkflows.length} paused</strong><span>Intentionally unavailable until resumed.</span></div><em className="muted">Paused</em></div>
          <div className="admin-list-row"><div><strong>{attentionWorkflows.length} unhealthy states</strong><span>Disabled or error-state automations requiring review.</span></div><em className={attentionWorkflows.length ? "bad" : "good"}>{attentionWorkflows.length ? "Review" : "Clear"}</em></div>
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
            {visibleAttentionRuns.map((run) => (
              <div className="admin-list-row" key={`run-${run.id}`}>
                <div>
                  <strong>{run.workflow_key || "Automation run"}</strong>
                  <span>{run.error_message || "The automation did not complete successfully."}</span>
                  <span>{formatDate(run.completed_at || run.created_at)}</span>
                </div>
                <em className="bad">{run.status}</em>
              </div>
            ))}
            {!attentionWorkflows.length && !visibleAttentionRuns.length ? (
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
                <strong>{run.workflow_key || "Automation run"}</strong>
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
        <div className="admin-list">
          <div className="admin-list-row"><div><strong>Active</strong><span>Automations available to respond to configured triggers.</span></div><em className="good">{activeWorkflows.length}</em></div>
          <div className="admin-list-row"><div><strong>Paused</strong><span>Automations intentionally held from running.</span></div><em className="muted">{pausedWorkflows.length}</em></div>
          <div className="admin-list-row"><div><strong>Disabled or error</strong><span>Automations that should be reviewed before relying on them.</span></div><em className={attentionWorkflows.length ? "bad" : "good"}>{attentionWorkflows.length}</em></div>
        </div>
      </section>
    </main>
  );
}
