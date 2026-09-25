import { Activity, AlertTriangle, CheckCircle2, Workflow } from "@/components/admin/ServerIcons";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { emptyOrganizationOperationalSnapshot, getOrganizationOperationalSnapshot } from "@/lib/admin-organization-data";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";

export const dynamic = "force-dynamic";

export default async function UnifiedActivityPage() {
  const scope = await resolveAdminOrganizationScope();
  const [snapshot, workflowSummary] = await Promise.all([
    getOrganizationOperationalSnapshot(scope).catch(() => emptyOrganizationOperationalSnapshot(scope.name)),
    getWorkflowRegistrySummary(scope).catch(() => ({ configured: false, workflows: [], runs: [], active: 0, paused: 0, failures: 0, successRate: 0 })),
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

  const attentionCount = snapshot.attentionCount + workflowSummary.failures;

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
