import { Activity, AlertTriangle, CheckCircle2, Workflow } from "@/components/admin/ServerIcons";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { emptyOrganizationOperationalSnapshot, getOrganizationOperationalSnapshot } from "@/lib/admin-organization-data";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";
import { getOrchestrationOperationsSnapshot } from "@/lib/orchestration-observability";

export const dynamic = "force-dynamic";

export default async function UnifiedActivityPage() {
  const scope = await resolveAdminOrganizationScope();
  const [snapshot, workflowSummary, orchestration] = await Promise.all([
    getOrganizationOperationalSnapshot(scope).catch(() => emptyOrganizationOperationalSnapshot(scope.name)),
    getWorkflowRegistrySummary(scope).catch(() => ({ configured: false, workflows: [], runs: [], active: 0, paused: 0, failures: 0, successRate: 0 })),
    scope.organizationId.startsWith("unavailable:")
      ? Promise.resolve({ failures: [], summary: { failedEvents: 0, retryable: 0, escalated: 0, retried: 0 } })
      : getOrchestrationOperationsSnapshot(scope.organizationId).catch(() => ({ failures: [], summary: { failedEvents: 0, retryable: 0, escalated: 0, retried: 0 } })),
  ]);

  const feed = [
    ...snapshot.activity,
    ...workflowSummary.workflows.slice(0, 6).map((workflow) => ({
      id: `workflow-${workflow.id}`,
      href: "/dashboard/workflows",
      title: workflow.name,
      meta: workflow.description || workflow.workflow_key,
      label: workflow.status,
      tone: workflow.status === "active" ? ("automation" as const) : workflow.status === "error" ? ("warning" as const) : ("muted" as const),
    })),
  ].slice(0, 14);

  const attentionCount = snapshot.attentionCount + workflowSummary.failures + orchestration.summary.failedEvents;

  return (
    <main className="admin-page activity-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">{scope.name}</p>
          <h1>Activity Center</h1>
          <p>Organization-scoped customer movement, AI activity and automation evidence. Nothing from another workspace is mixed into this feed.</p>
        </div>
        <span className={attentionCount ? "admin-status warning" : "admin-status live"}>{attentionCount ? "Review required" : "Activity healthy"}</span>
      </header>

      <div className="admin-metric-grid activity-metrics">
        {snapshot.metrics.map((metric) => (
          <section className="admin-panel compact" key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><span className="admin-muted">{metric.detail}</span></section>
        ))}
      </div>

      <section className="admin-panel activity-command-panel">
        <div className="admin-panel-header"><div><h2>Operations Feed</h2><p>Recent evidence for {scope.name} only.</p></div><Activity size={18} /></div>
        <div className="admin-list activity-feed">
          {feed.map((item) => (
            <a href={item.href} className={`admin-list-row compact activity-feed-row ${item.tone}`} key={item.id}>
              <div><strong>{item.title}</strong><span>{item.meta}</span></div><em>{item.label}</em>
            </a>
          ))}
          {!feed.length ? <p className="admin-empty">No activity has been stored for {scope.name} yet.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Orchestration Failures</h2><p>Failed system-to-system hops for {scope.name}, with retry and escalation evidence.</p></div><AlertTriangle size={18} /></div>
        <div className="admin-metric-grid">
          <article className="admin-metric-card"><p>Failed events</p><strong>{orchestration.summary.failedEvents}</strong><span>Current failed orchestration events</span></article>
          <article className="admin-metric-card"><p>Retryable</p><strong>{orchestration.summary.retryable}</strong><span>Transient failures eligible for controlled retry</span></article>
          <article className="admin-metric-card"><p>Escalated</p><strong>{orchestration.summary.escalated}</strong><span>Failures with support escalation</span></article>
          <article className="admin-metric-card"><p>Retried</p><strong>{orchestration.summary.retried}</strong><span>Failures with recorded retry attempts</span></article>
        </div>
        <div className="admin-list">
          {orchestration.failures.slice(0, 20).map((item) => (
            <div className="admin-list-row" key={item.eventId}>
              <div>
                <strong>{item.eventType} · {item.failedHop || item.targetSystem || "unresolved target"}</strong>
                <span>{item.failureCategory} · retry {item.retryCount} · correlation {item.correlationId}</span>
                <span>{item.error || "No safe error detail was recorded."}</span>
              </div>
              <em className={item.retryable ? "warning" : "bad"}>{item.supportConversationId ? "escalated" : item.retryable ? "retryable" : "review"}</em>
            </div>
          ))}
          {!orchestration.failures.length ? <p className="admin-empty">No failed system orchestration events are recorded for {scope.name}.</p> : null}
        </div>
      </section>

      <div className="admin-grid two activity-grid">
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Needs Review</h2><p>Organization-specific signals requiring attention.</p></div><AlertTriangle size={18} /></div>
          <div className="admin-list">
            {snapshot.notices.map((notice, index) => (
              <a href={notice.href} className="admin-list-row compact attention-warning" key={notice.title + index}>
                <div><strong>{notice.title}</strong><span>{notice.detail}</span></div><em>{notice.type}</em>
              </a>
            ))}
            {!snapshot.notices.length ? <div className="admin-list-row compact"><div><strong>No obvious review queue</strong><span>Stored {scope.name} signals look clean.</span></div><CheckCircle2 size={17} /></div> : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Automation Activity</h2><p>Workflow registry filtered to the active organization.</p></div><Workflow size={18} /></div>
          <div className="admin-list">
            {workflowSummary.workflows.slice(0, 8).map((workflow) => (
              <a href="/dashboard/workflows" className="admin-list-row compact" key={workflow.id}>
                <div><strong>{workflow.name}</strong><span>{workflow.workflow_key}</span></div>
                <em className={workflow.status === "active" ? "good" : workflow.status === "error" ? "bad" : "muted"}>{workflow.status}</em>
              </a>
            ))}
            {!workflowSummary.workflows.length ? <p className="admin-empty">No workflows are registered for {scope.name}.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
