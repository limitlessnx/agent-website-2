import Link from "next/link";
import { Activity, AlertTriangle, BarChart2, Bot, MessageSquareText, Users, Workflow } from "@/components/admin/ServerIcons";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { emptyOrganizationOperationalSnapshot, getOrganizationOperationalSnapshot } from "@/lib/admin-organization-data";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";

export const dynamic = "force-dynamic";

export default async function TenantAnalyticsPage() {
  const scope = await resolveAdminOrganizationScope();

  if (scope.kind !== "tenant") {
    return (
      <main className="admin-page">
        <header className="admin-page-header">
          <div>
            <p className="admin-kicker">Tenant module</p>
            <h1>Tenant Analytics</h1>
            <p>This surface is reserved for an active tenant organization.</p>
          </div>
          <span className="admin-status">Tenant required</span>
        </header>
        <section className="admin-panel">
          <div className="admin-list-row compact">
            <div><strong>Select a tenant organization</strong><span>Use Tenant Organizations in the sidebar, then return to Analytics.</span></div>
            <Link className="admin-button secondary-button" href="/dashboard/clients">Tenant registry</Link>
          </div>
        </section>
      </main>
    );
  }

  const [snapshot, workflows] = await Promise.all([
    getOrganizationOperationalSnapshot(scope).catch(() => emptyOrganizationOperationalSnapshot(scope.name)),
    getWorkflowRegistrySummary(scope).catch(() => ({ configured: false, workflows: [], runs: [], active: 0, paused: 0, failures: 0, successRate: 0 })),
  ]);

  const completedRuns = workflows.runs.filter((run) => ["succeeded", "failed", "timed_out"].includes(run.status)).length;
  const failedRuns = workflows.runs.filter((run) => ["failed", "timed_out"].includes(run.status)).length;

  return (
    <main className="admin-page dashboard-v2-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">{scope.name} · Tenant workspace</p>
          <h1>Analytics</h1>
          <p>Operational evidence for this tenant only. Metrics stay empty when the underlying records do not exist.</p>
        </div>
        <span className={snapshot.attentionCount || failedRuns ? "admin-status warning" : "admin-status live"}>
          {snapshot.attentionCount || failedRuns ? "Review signals" : "Workspace stable"}
        </span>
      </header>

      <div className="admin-metric-grid">
        {snapshot.metrics.map((metric) => {
          const Icon = metric.icon === "leads" ? Users : metric.icon === "conversations" ? MessageSquareText : metric.icon === "followups" ? Activity : BarChart2;
          return <article className="admin-metric-card" key={metric.label}><p><Icon size={15} /> {metric.label}</p><strong>{metric.value}</strong><span>{metric.detail}</span></article>;
        })}
      </div>

      <div className="admin-grid two">
        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>AI workforce</h2><p>Agents visible inside {scope.name}.</p></div><Bot size={18} /></div>
          <div className="admin-list">
            {snapshot.agents.map((agent) => <Link href={agent.href} className="admin-list-row compact" key={agent.name}><div><strong>{agent.name}</strong><span>{agent.role} · {agent.channel}</span><span>{agent.note}</span></div><em>{agent.status}</em></Link>)}
            {!snapshot.agents.length ? <p className="admin-empty">No tenant agents are visible yet.</p> : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="admin-panel-header"><div><h2>Automation delivery</h2><p>Workflow activity scoped to this tenant.</p></div><Workflow size={18} /></div>
          <div className="admin-list">
            <div className="admin-list-row compact"><div><strong>{workflows.active} active workflows</strong><span>{workflows.workflows.length} registered for this tenant.</span></div></div>
            <div className="admin-list-row compact"><div><strong>{workflows.successRate}% success rate</strong><span>{completedRuns} completed recent runs.</span></div></div>
            <div className="admin-list-row compact"><div><strong>{failedRuns} failed or timed-out runs</strong><span>Provider failures remain isolated from the rest of the tenant workspace.</span></div></div>
          </div>
        </section>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Needs attention</h2><p>Only persisted signals belonging to {scope.name}.</p></div><AlertTriangle size={18} /></div>
        <div className="admin-list">
          {snapshot.notices.map((notice, index) => <Link href={notice.href} className="admin-list-row compact" key={notice.title + index}><div><strong>{notice.title}</strong><span>{notice.detail}</span></div><em>{notice.type}</em></Link>)}
          {!snapshot.notices.length ? <p className="admin-empty">No tenant-specific alerts are currently stored.</p> : null}
        </div>
      </section>
    </main>
  );
}
