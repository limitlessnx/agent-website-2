import Link from "next/link";
import { Activity, Gauge, LineChart, ShieldCheck, Target, Users } from "@/components/admin/ServerIcons";
import { getLifecycleAnalyticsSnapshot } from "@/lib/lifecycle-analytics";

export const dynamic = "force-dynamic";

function rate(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function stageLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function LifecycleControlCenterPage() {
  const analytics = await getLifecycleAnalyticsSnapshot(30);

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Lifecycle analytics</p>
          <h1>Customer Control Center</h1>
          <p>Phase 12 turns lifecycle signals into one operating view for adoption, value, risk, support pressure and expansion readiness.</p>
        </div>
        <span className={analytics.atRiskOrganizations ? "admin-status warning" : "admin-status live"}>
          {analytics.atRiskOrganizations ? `${analytics.atRiskOrganizations} organizations need attention` : "No high-risk organizations detected"}
        </span>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Users size={15} /> Active organizations</p><strong>{analytics.activeOrganizations}</strong><span>{analytics.organizations} total organizations</span></article>
        <article className="admin-metric-card"><p><Gauge size={15} /> Activation proxy</p><strong>{rate(analytics.activationProxyRate)}</strong><span>Active lifecycle accounts beyond setup</span></article>
        <article className="admin-metric-card"><p><LineChart size={15} /> Measured value</p><strong>{rate(analytics.measuredValueRate)}</strong><span>Active accounts with recorded operational value</span></article>
        <article className="admin-metric-card"><p><ShieldCheck size={15} /> Average health</p><strong>{analytics.averageHealthScore ?? "—"}</strong><span>Average organization health score</span></article>
        <article className="admin-metric-card"><p><Activity size={15} /> Risk rate</p><strong>{rate(analytics.riskRate)}</strong><span>{analytics.atRiskOrganizations} organizations at elevated risk</span></article>
        <article className="admin-metric-card"><p><Target size={15} /> Expansion ready</p><strong>{rate(analytics.expansionReadinessRate)}</strong><span>{analytics.expansionReadyOrganizations} organizations with growth signal and no high risk</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>30-day operating value</h2><p>Measured activity only. No optimistic multiplication by imaginary ROI coefficients.</p></div><LineChart size={18} /></div>
        <div className="admin-metric-grid">
          <article className="admin-metric-card"><p>Conversations</p><strong>{analytics.totalConversations30d.toLocaleString()}</strong><span>Recorded customer conversations</span></article>
          <article className="admin-metric-card"><p>Leads captured</p><strong>{analytics.totalLeads30d.toLocaleString()}</strong><span>Organization-scoped lead activity</span></article>
          <article className="admin-metric-card"><p>Successful actions</p><strong>{analytics.totalSuccessfulActions30d.toLocaleString()}</strong><span>Completed runtime actions</span></article>
          <article className="admin-metric-card"><p>Open support</p><strong>{analytics.totalUnresolvedSupportCases.toLocaleString()}</strong><span>Unresolved cases across organizations</span></article>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Lifecycle distribution</h2><p>Where organizations currently sit across the operating lifecycle.</p></div><Gauge size={18} /></div>
        <div className="admin-list">
          {Object.entries(analytics.lifecycleDistribution).map(([stage, count]) => (
            <div className="admin-list-row compact" key={stage}><div><strong>{stageLabel(stage)}</strong><span>{count} organization{count === 1 ? "" : "s"}</span></div><span className="admin-status">{analytics.organizations ? Math.round((count / analytics.organizations) * 100) : 0}%</span></div>
          ))}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Priority intervention queue</h2><p>High and critical accounts come before expansion. The software has finally learned not to upsell during a fire.</p></div><ShieldCheck size={18} /></div>
        <div className="admin-list">
          {analytics.priorityQueue.map((item) => (
            <article className="admin-list-row" key={item.organizationId} style={{ alignItems: "start", gap: 18 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{item.organizationName}</strong>
                  <span className="admin-status warning">{item.attention}</span>
                  <span className="admin-status">{stageLabel(item.stage)}</span>
                </div>
                <span>Health {item.healthScore}/100 · Retention risk {item.retentionRiskScore}/100 · {item.unresolvedSupportCases} unresolved support case{item.unresolvedSupportCases === 1 ? "" : "s"}</span>
                <span className="admin-muted">Next action: {item.recommendedNextAction}</span>
              </div>
              <Link className="admin-button secondary" href={`/dashboard/clients?organizationId=${encodeURIComponent(item.organizationId)}`}>Open workspace</Link>
            </article>
          ))}
          {!analytics.priorityQueue.length ? <p className="admin-empty">No high or critical lifecycle interventions are currently queued.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Expansion queue</h2><p>Only organizations with growth evidence and without high-risk lifecycle state appear here.</p></div><Target size={18} /></div>
        <div className="admin-list">
          {analytics.expansionQueue.map((item) => (
            <article className="admin-list-row" key={item.organizationId} style={{ alignItems: "start", gap: 18 }}>
              <div style={{ flex: 1 }}><strong>{item.organizationName}</strong><span>Opportunity score {item.opportunityScore}/100 · Health {item.healthScore}/100</span><span className="admin-muted">{item.recommendedNextAction}</span></div>
              <Link className="admin-button secondary" href="/dashboard/expansion">Review growth</Link>
            </article>
          ))}
          {!analytics.expansionQueue.length ? <p className="admin-empty">No expansion-ready organizations currently clear the Phase 12 guardrails.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Measurement boundaries</h2><p>Metrics we deliberately refuse to fake until the underlying events exist.</p></div><Activity size={18} /></div>
        <div className="admin-list">{analytics.dataNotes.map((note) => <div className="admin-list-row compact" key={note}><div><span>{note}</span></div></div>)}</div>
      </section>
    </main>
  );
}
