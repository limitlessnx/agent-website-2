import Link from "next/link";
import { Activity, Gauge, LineChart, ShieldCheck, Target, Users } from "@/components/admin/ServerIcons";
import { getUnifiedLifecycleSnapshots, type LifecycleAttention } from "@/lib/lifecycle-intelligence";

export const dynamic = "force-dynamic";

function attentionClass(attention: LifecycleAttention) {
  if (attention === "critical" || attention === "high") return "admin-status warning";
  if (attention === "watch") return "admin-status live";
  return "admin-status";
}

function stageLabel(stage: string) {
  return stage.replaceAll("_", " ");
}

export default async function LifecycleIntelligencePage() {
  const snapshots = await getUnifiedLifecycleSnapshots(30);
  const critical = snapshots.filter((item) => item.attention === "critical").length;
  const atRisk = snapshots.filter((item) => item.stage === "risk").length;
  const expansion = snapshots.filter((item) => item.stage === "expansion").length;
  const value = snapshots.filter((item) => item.stage === "value").length;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Lifecycle intelligence</p>
          <h1>Customer Lifecycle</h1>
          <p>Phase 11 combines account state, usage, health, support, retention and expansion into one organization-level operating view.</p>
        </div>
        <span className={critical ? "admin-status warning" : "admin-status live"}>{critical ? `${critical} critical account${critical === 1 ? "" : "s"}` : "No critical lifecycle accounts"}</span>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Users size={15} /> Organizations</p><strong>{snapshots.length}</strong><span>Unified lifecycle records</span></article>
        <article className="admin-metric-card"><p><ShieldCheck size={15} /> At risk</p><strong>{atRisk}</strong><span>Need customer-success review</span></article>
        <article className="admin-metric-card"><p><Target size={15} /> Expansion</p><strong>{expansion}</strong><span>Measured growth opportunities</span></article>
        <article className="admin-metric-card"><p><LineChart size={15} /> Value stage</p><strong>{value}</strong><span>Showing measurable operational value</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Lifecycle queue</h2><p>Highest-attention organizations appear first. The recommended next action is advisory and does not mutate customer accounts automatically.</p></div>
          <Activity size={18} />
        </div>

        <div className="admin-list">
          {snapshots.map((item) => (
            <article className="admin-list-row" key={item.organizationId} style={{ alignItems: "start", gap: 18 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{item.organizationName}</strong>
                  <span className={attentionClass(item.attention)}>{item.attention} attention</span>
                  <span className="admin-status">{stageLabel(item.stage)}</span>
                  <span className="admin-status">{item.organizationStatus}</span>
                </div>
                <span>Health {item.healthScore}/100 · Retention risk {item.retentionRiskScore}/100 · Opportunity {item.opportunityScore}/100</span>
                <span className="admin-muted">30d: {item.conversations.toLocaleString()} conversations · {item.leadsCaptured.toLocaleString()} leads · {item.successfulActions.toLocaleString()} successful actions · {item.activeAgents} active agent{item.activeAgents === 1 ? "" : "s"}</span>
                <span className="admin-muted">{item.connectedIntegrations} connected integration{item.connectedIntegrations === 1 ? "" : "s"} · {item.unresolvedSupportCases} unresolved support case{item.unresolvedSupportCases === 1 ? "" : "s"}</span>
                {item.reasons.length ? <div style={{ marginTop: 10 }}>{item.reasons.map((reason) => <span className="admin-muted" key={reason}>• {reason}</span>)}</div> : null}
                <span style={{ marginTop: 10 }}><strong>Next action:</strong> {item.recommendedNextAction}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 132 }}>
                <Link className="admin-button secondary" href={`/dashboard/clients?organizationId=${encodeURIComponent(item.organizationId)}`}>Workspace</Link>
                <Link className="admin-button secondary" href="/dashboard/health">Health</Link>
                <Link className="admin-button secondary" href="/dashboard/value">Usage</Link>
                <Link className="admin-button secondary" href="/dashboard/retention">Retention</Link>
              </div>
            </article>
          ))}
          {!snapshots.length ? <p className="admin-empty">No organizations are available for lifecycle analysis.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Lifecycle model</h2><p>One account can move forward, stall, enter risk, recover, expand, or churn. Phase 11 makes that state explicit instead of forcing admins to mentally join six dashboards.</p></div><Gauge size={18} /></div>
        <div className="admin-list">
          <div className="admin-list-row compact"><div><strong>Setup → Adoption → Value</strong><span>Tracks the path from configured workspace to repeatable measurable usage.</span></div></div>
          <div className="admin-list-row compact"><div><strong>Value → Expansion</strong><span>Only when usage evidence supports another agent, channel, workflow or capacity review.</span></div></div>
          <div className="admin-list-row compact"><div><strong>Any stage → Risk → Recovery / Churn</strong><span>Cancellation intent, support pressure, integration failures, suspension and falling usage override optimistic growth signals.</span></div></div>
          <div className="admin-list-row compact"><div><strong>No autonomous commercial actions</strong><span>Leo and the dashboard can recommend a next move; discounts, plan changes, reactivation and outreach still require policy or human approval.</span></div></div>
        </div>
      </section>
    </main>
  );
}
