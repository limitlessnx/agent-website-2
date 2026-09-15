import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";
import styles from "./AutomationOperations.module.css";

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function humanize(value?: string | null, fallback = "Unknown") {
  const normalized = String(value || "").trim();
  return normalized ? normalized.replace(/_/g, " ") : fallback;
}

function metadataText(metadata: Record<string, unknown> | undefined, keys: string[]) {
  if (!metadata) return "";
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
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

  const failedRuns = summary.runs.filter((run) => ["failed", "timed_out", "cancelled"].includes(run.status)).slice(0, 12);
  const pendingRuns = summary.runs.filter((run) => ["queued", "running"].includes(run.status));
  const recentRuns = summary.runs.slice(0, 14);
  const attentionWorkflows = summary.workflows.filter((workflow) => ["error", "paused"].includes(workflow.status));
  const healthLabel = !summary.configured || ("error" in summary && summary.error)
    ? "Setup required"
    : summary.failures || attentionWorkflows.some((workflow) => workflow.status === "error")
      ? "Needs attention"
      : "Healthy";

  const approvalRequired = summary.workflows.filter((workflow) => {
    const metadata = workflow.metadata || {};
    return Boolean(metadata.approval_required || metadata.requires_approval || metadata.human_approval);
  });

  return (
    <main className={`admin-page ${styles.page}`}>
      <header className={`admin-page-header ${styles.hero}`}>
        <div>
          <p className="admin-kicker">Automation operations</p>
          <h1>Automations</h1>
          <p>Monitor active workflows, execution health, failures and approval-sensitive automation from one operating surface.</p>
        </div>
        <div className={styles.heroState}>
          <strong>{summary.active}</strong>
          <span>{healthLabel === "Healthy" ? "active automations" : healthLabel}</span>
        </div>
      </header>

      <section className={styles.summary} aria-label="Automation operations summary">
        <div><span>Active</span><strong>{summary.active}</strong></div>
        <div><span>Success rate</span><strong>{summary.successRate}%</strong></div>
        <div><span>In progress</span><strong>{pendingRuns.length}</strong></div>
        <div><span>Needs attention</span><strong>{failedRuns.length + attentionWorkflows.length}</strong></div>
      </section>

      {"error" in summary && summary.error ? (
        <section className={`${styles.panel} ${styles.criticalPanel}`}>
          <div className={styles.issueRow}>
            <div><strong>Automation setup needs attention</strong><span>{summary.error}</span></div>
            <em>Review setup</em>
          </div>
        </section>
      ) : null}

      <section className={styles.mainGrid}>
        <article className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <p className="admin-kicker">Workflow inventory</p>
              <h2>Automation control</h2>
              <p>Status, trigger, provider and recent execution context without exposing unnecessary engine noise.</p>
            </div>
            <span>{summary.workflows.length} total</span>
          </header>

          <div className={styles.workflowList}>
            {summary.workflows.length ? summary.workflows.map((workflow) => {
              const schedule = metadataText(workflow.metadata, ["schedule", "cron", "cadence"]);
              const approval = Boolean(workflow.metadata?.approval_required || workflow.metadata?.requires_approval || workflow.metadata?.human_approval);
              return (
                <div key={workflow.id} className={styles.workflowRow}>
                  <div className={styles.workflowIdentity}>
                    <strong>{workflow.name}</strong>
                    <div className={styles.providerLine}>
                      <span>{humanize(workflow.provider, "provider")}</span>
                      <span>{humanize(workflow.trigger_type, "trigger")}</span>
                      <span>{humanize(workflow.environment, "environment")}</span>
                      {schedule ? <span>{schedule}</span> : null}
                      {approval ? <span>human approval</span> : null}
                    </div>
                    <span>{workflow.description || `Last run ${formatDate(workflow.last_run_at)}`}</span>
                  </div>
                  <div className={styles.workflowMeta}>
                    <span className={styles.statePill} data-state={workflow.status}>{humanize(workflow.status)}</span>
                    <small>{workflow.last_run_at ? formatDate(workflow.last_run_at) : "No run recorded"}</small>
                  </div>
                </div>
              );
            }) : (
              <div className={`admin-empty-state ${styles.empty}`}>
                <strong>No registered automations</strong>
                <span>Automation records will appear here once workflows are registered with Fluxknight.</span>
              </div>
            )}
          </div>

          <div className={styles.approvalNote}>
            <strong>{approvalRequired.length} approval-sensitive automation{approvalRequired.length === 1 ? "" : "s"}.</strong> Fluxknight should surface human approval only where the workflow explicitly declares it rather than pretending every automated action is dangerous.
          </div>
        </article>

        <aside className={styles.panel}>
          <header className={styles.panelHeader}>
            <div>
              <p className="admin-kicker">Execution stream</p>
              <h2>Recent runs</h2>
              <p>Latest workflow executions, with failed and queued work immediately visible.</p>
            </div>
            <span>{recentRuns.length} shown</span>
          </header>

          <div className={styles.runList}>
            {recentRuns.length ? recentRuns.map((run) => (
              <div key={run.id} className={styles.runRow}>
                <div>
                  <strong>{humanize(run.workflow_key, "Automation run")}</strong>
                  <span>{run.error_message || `${humanize(run.project_id, "Platform")} · attempt ${run.attempt}`}</span>
                </div>
                <div className={styles.runMeta}>
                  <span className={styles.statePill} data-state={run.status}>{humanize(run.status)}</span>
                  <small>{formatDate(run.completed_at || run.started_at || run.created_at)}</small>
                </div>
              </div>
            )) : (
              <div className={`admin-empty-state ${styles.empty}`}>
                <strong>No recent executions</strong>
                <span>Workflow runs will appear here once automation starts processing work.</span>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className={`${styles.panel} ${styles.issues}`}>
        <header className={styles.panelHeader}>
          <div>
            <p className="admin-kicker">Attention queue</p>
            <h2>Needs review</h2>
            <p>Only failed executions and workflows in paused or error state appear here.</p>
          </div>
          <span>{failedRuns.length + attentionWorkflows.length} items</span>
        </header>

        <div className={styles.issueList}>
          {failedRuns.map((run) => (
            <div key={run.id} className={styles.issueRow}>
              <div>
                <strong>{humanize(run.workflow_key, "Automation action")} failed</strong>
                <span>{run.error_message || "The automation did not complete successfully."}</span>
                <span>{formatDate(run.completed_at || run.created_at)}</span>
              </div>
              <em>Execution</em>
            </div>
          ))}

          {attentionWorkflows.map((workflow) => (
            <div key={`workflow-${workflow.id}`} className={styles.issueRow}>
              <div>
                <strong>{workflow.name}</strong>
                <span>{workflow.status === "error" ? "Workflow is reporting an error state." : "Workflow is paused and is not processing new work."}</span>
                <span>{workflow.last_error_at ? `Last error ${formatDate(workflow.last_error_at)}` : `Updated ${formatDate(workflow.updated_at)}`}</span>
              </div>
              <em>{humanize(workflow.status)}</em>
            </div>
          ))}

          {!failedRuns.length && !attentionWorkflows.length ? (
            <div className={`${styles.issueRow} ${styles.healthyRow}`}>
              <div><strong>No automation issues</strong><span>Recent workflow executions and registered automation states are healthy.</span></div>
              <em>Healthy</em>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
