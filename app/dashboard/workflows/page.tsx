import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from "@/components/admin/ServerIcons";
import MetricCard from "@/components/admin/MetricCard";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AutomationHealthPage() {
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
      error: error instanceof Error ? error.message : "Automation health is unavailable.",
    };
  }

  const failedRuns = summary.runs.filter((run) => ["failed", "timed_out", "cancelled"].includes(run.status)).slice(0, 20);
  const pendingRuns = summary.runs.filter((run) => ["queued", "running"].includes(run.status)).length;
  const healthLabel = !summary.configured || ("error" in summary && summary.error)
    ? "Setup required"
    : summary.failures
      ? "Needs attention"
      : "Healthy";

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Fluxknight Operations</p>
          <h1>Automation Health</h1>
          <p>See whether business automations are working and resolve only the items that need attention.</p>
        </div>
        <span className={summary.failures || !summary.configured ? "admin-status warning" : "admin-status live"}>{healthLabel}</span>
      </header>

      <div className="admin-metric-grid">
        <MetricCard icon={ShieldCheck} tone="emerald" label="System status" value={healthLabel} detail="Business automation engine" trend="health" />
        <MetricCard icon={CheckCircle2} tone="cyan" label="Success rate" value={`${summary.successRate}%`} detail="Recent completed actions" trend="delivery" />
        <MetricCard icon={Clock3} tone="amber" label="In progress" value={pendingRuns} detail="Queued or currently running" trend="queue" />
        <MetricCard icon={AlertTriangle} tone="violet" label="Needs attention" value={failedRuns.length} detail="Failed or interrupted actions" trend="issues" />
      </div>

      {"error" in summary && summary.error ? (
        <section className="admin-panel">
          <div className="admin-list-row attention-danger"><div><strong>Automation setup needs attention</strong><span>{summary.error}</span></div><em>Review setup</em></div>
        </section>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Items needing attention</h2><p>Technical engine details stay hidden unless they are needed for troubleshooting.</p></div>
        </div>
        <div className="admin-list">
          {failedRuns.map((run) => (
            <div key={run.id} className="admin-list-row">
              <div>
                <strong>Automation action failed</strong>
                <span>{run.project_id || "Platform"} · {run.error_message || "The action did not complete successfully."}</span>
                <span>{formatDate(run.completed_at || run.created_at)}</span>
              </div>
              <em className="bad">Needs review</em>
            </div>
          ))}
          {!failedRuns.length ? (
            <div className="admin-list-row compact"><div><strong>No automation issues</strong><span>Recent business actions are completing normally.</span></div><em className="good">Healthy</em></div>
          ) : null}
        </div>
      </section>
    </main>
  );
}