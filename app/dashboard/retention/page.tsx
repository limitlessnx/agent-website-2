import Link from "next/link";
import { AlertTriangle, Gauge, LifeBuoy, LineChart, Target } from "@/components/admin/ServerIcons";
import { getRetentionSnapshots } from "@/lib/retention-intelligence";

export const dynamic = "force-dynamic";

function badge(level: "low" | "watch" | "high" | "critical") {
  if (level === "critical" || level === "high") return "admin-status warning";
  if (level === "watch") return "admin-status live";
  return "admin-status";
}

export default async function RetentionPage() {
  const snapshots = await getRetentionSnapshots();
  const atRisk = snapshots.filter((item) => ["high", "critical"].includes(item.riskLevel));
  const cancellationRequests = snapshots.filter((item) => item.stage === "cancellation_requested");
  const churned = snapshots.filter((item) => item.stage === "churned");
  const escalated = snapshots.filter((item) => item.signals.some((signal) => signal.key === "support-escalation"));

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Retention intelligence</p>
          <h1>Churn Prevention & Win-back</h1>
          <p>Phase 10 combines account intent, declining usage, integration reliability and support pressure into one customer-retention view.</p>
        </div>
        <span className={atRisk.length ? "admin-status warning" : "admin-status live"}>
          {atRisk.length ? `${atRisk.length} accounts need review` : "No high-risk accounts detected"}
        </span>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Gauge size={15} /> High risk</p><strong>{atRisk.length}</strong><span>Organizations requiring customer-success review</span></article>
        <article className="admin-metric-card"><p><Target size={15} /> Cancellation intent</p><strong>{cancellationRequests.length}</strong><span>Active cancellation requests</span></article>
        <article className="admin-metric-card"><p><LifeBuoy size={15} /> Escalated support</p><strong>{escalated.length}</strong><span>Accounts with support escalation pressure</span></article>
        <article className="admin-metric-card"><p><LineChart size={15} /> Churned</p><strong>{churned.length}</strong><span>Archived accounts eligible for review before win-back</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Retention queue</h2><p>Signals are advisory. No discount, win-back message, account change or sales outreach is sent automatically.</p></div>
          <AlertTriangle size={18} />
        </div>
        <div className="admin-list">
          {snapshots.map((snapshot) => (
            <article className="admin-list-row" key={snapshot.organizationId} style={{ alignItems: "start", gap: 18 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong>{snapshot.organizationName}</strong>
                  <span className={badge(snapshot.riskLevel)}>{snapshot.riskLevel} risk · {snapshot.riskScore}/100</span>
                  <span className="admin-status">{snapshot.stage.replaceAll("_", " ")}</span>
                </div>
                <span>Current 30-day usage: {Math.round(snapshot.current30DayUsage)} · Previous 30 days: {Math.round(snapshot.previous30DayUsage)} · Connected integrations: {snapshot.connectedIntegrations} · Open support: {snapshot.unresolvedSupportCases}</span>
                {snapshot.cancellationReason ? <span className="admin-muted">Cancellation reason: {snapshot.cancellationReason}</span> : null}
                {snapshot.signals.length ? (
                  <div className="admin-list" style={{ marginTop: 12 }}>
                    {snapshot.signals.map((signal) => (
                      <div className="admin-list-row compact" key={signal.key}>
                        <div><strong>{signal.label} (+{signal.impact})</strong><span>{signal.detail}</span></div>
                      </div>
                    ))}
                  </div>
                ) : <span className="admin-muted">No active retention-risk signal.</span>}
                <span className="admin-muted" style={{ marginTop: 10 }}>Recommended: {snapshot.recommendedAction}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 130 }}>
                <Link className="admin-button secondary" href="/dashboard/health">Health</Link>
                <Link className="admin-button secondary" href="/dashboard/value">Usage</Link>
                <Link className="admin-button secondary" href={`/dashboard/clients?organizationId=${encodeURIComponent(snapshot.organizationId)}`}>Workspace</Link>
              </div>
            </article>
          ))}
          {!snapshots.length ? <p className="admin-empty">No organizations are available for retention analysis.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Phase 10 guardrails</h2><p>Retention interventions need context, not panic automation.</p></div><Target size={18} /></div>
        <div className="admin-list">
          <div className="admin-list-row compact"><div><strong>No automatic save offer</strong><span>Discounts, credits, plan changes and commercial concessions require human approval.</span></div></div>
          <div className="admin-list-row compact"><div><strong>No automatic win-back email</strong><span>Archived customers remain an internal review queue until an approved outreach policy exists.</span></div></div>
          <div className="admin-list-row compact"><div><strong>Fix value problems before selling</strong><span>Operational failures, poor adoption and unresolved support should be addressed before expansion or renewal conversations.</span></div></div>
        </div>
      </section>
    </main>
  );
}
