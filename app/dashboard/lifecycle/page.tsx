import Link from "next/link";
import { getUnifiedLifecycleSnapshots, type LifecycleAttention } from "@/lib/lifecycle-intelligence";
import styles from "./CustomerIntelligence.module.css";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ");
}

function attentionRank(attention: LifecycleAttention) {
  return attention === "critical" ? 3 : attention === "high" ? 2 : attention === "watch" ? 1 : 0;
}

function usageDelta(current: number, previous: number) {
  if (!previous) return current > 0 ? "New activity" : "No baseline";
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change > 0 ? "+" : ""}${change}% vs prior 30d`;
}

export default async function CustomerIntelligencePage() {
  const snapshots = await getUnifiedLifecycleSnapshots(30);
  const sorted = [...snapshots].sort((a, b) => attentionRank(b.attention) - attentionRank(a.attention) || b.retentionRiskScore - a.retentionRiskScore);
  const risk = snapshots.filter((item) => item.stage === "risk" || item.stage === "churned").length;
  const expansion = snapshots.filter((item) => item.stage === "expansion").length;
  const value = snapshots.filter((item) => item.stage === "value").length;
  const critical = snapshots.filter((item) => item.attention === "critical").length;

  return (
    <main className={`admin-page ${styles.page}`}>
      <section className={`admin-page-header ${styles.hero}`}>
        <div>
          <p className="admin-kicker">Customer intelligence</p>
          <h1>Health, value, risk and opportunity in one view</h1>
          <p>One operating surface for customer lifecycle state, measurable value, retention risk, expansion opportunity and the next action that deserves attention.</p>
        </div>
        <div className={styles.heroState}>
          <strong>{critical}</strong>
          <span>critical accounts</span>
        </div>
      </section>

      <section className={styles.summary} aria-label="Customer intelligence summary">
        <div><span>Organizations</span><strong>{snapshots.length}</strong><small>Unified customer records</small></div>
        <div><span>At risk</span><strong>{risk}</strong><small>Risk or churn stage</small></div>
        <div><span>Showing value</span><strong>{value}</strong><small>Measured operational value</small></div>
        <div><span>Expansion</span><strong>{expansion}</strong><small>Measured growth signal</small></div>
      </section>

      <section className={styles.queue}>
        <header className={styles.panelHeader}>
          <div>
            <p className="admin-kicker">Priority queue</p>
            <h2>Customer operating view</h2>
            <p>Highest-attention organizations appear first. Health, usage, retention and growth signals stay together so one account does not require a tour of five dashboards.</p>
          </div>
          <span>{snapshots.length} accounts</span>
        </header>

        <div className={styles.customerList}>
          {sorted.map((item) => (
            <article className={styles.customerRow} key={item.organizationId}>
              <div className={styles.customerMain}>
                <div className={styles.customerHeading}>
                  <strong>{item.organizationName}</strong>
                  <span className={styles.badge} data-attention={item.attention}>{label(item.attention)} attention</span>
                  <span className={styles.badge} data-stage={item.stage}>{label(item.stage)}</span>
                  <span className={styles.badge}>{label(item.organizationStatus)}</span>
                </div>

                <div className={styles.metrics}>
                  <div><span>Health</span><strong>{item.healthScore}/100</strong></div>
                  <div><span>Retention risk</span><strong>{item.retentionRiskScore}/100</strong></div>
                  <div><span>Opportunity</span><strong>{item.opportunityScore}/100</strong></div>
                  <div><span>30d usage</span><strong>{Math.round(item.current30DayUsage)}</strong></div>
                </div>

                <div className={styles.signals}>
                  <span>{item.conversations.toLocaleString()} conversations · {item.leadsCaptured.toLocaleString()} leads · {item.successfulActions.toLocaleString()} successful actions · {item.activeAgents} active agent{item.activeAgents === 1 ? "" : "s"}</span>
                  <span>{item.connectedIntegrations} connected integration{item.connectedIntegrations === 1 ? "" : "s"} · {item.unresolvedSupportCases} unresolved support case{item.unresolvedSupportCases === 1 ? "" : "s"} · {usageDelta(item.current30DayUsage, item.previous30DayUsage)}</span>
                  {item.reasons.slice(0, 3).map((reason) => <span key={reason}>• {reason}</span>)}
                </div>
              </div>

              <aside className={styles.customerSide}>
                <div className={styles.nextAction}>
                  <span>Recommended next action</span>
                  <strong>{item.recommendedNextAction}</strong>
                </div>
                <div className={styles.sideFacts}>
                  <div><span>Retention stage</span><strong>{label(item.retentionStage)}</strong></div>
                  <div><span>Health band</span><strong>{label(item.healthBand)}</strong></div>
                  <div><span>Opportunities</span><strong>{item.opportunityCount}</strong></div>
                  <div><span>Last activity</span><strong>{item.lastActivityAt ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(new Date(item.lastActivityAt)) : "Not recorded"}</strong></div>
                </div>
                <Link className={styles.workspaceLink} href={`/dashboard/clients?organizationId=${encodeURIComponent(item.organizationId)}`}>Open workspace</Link>
              </aside>
            </article>
          ))}
          {!snapshots.length ? (
            <div className={styles.empty}>
              <strong>No organizations available</strong>
              <span>Customer intelligence will appear once organization-scoped operational data is available.</span>
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.model}>
        <header className={styles.panelHeader}>
          <div>
            <p className="admin-kicker">Operating model</p>
            <h2>One customer, one intelligence path</h2>
            <p>The old Health, Retention, Growth, Usage and Lifecycle pages remain available by route for compatibility, but the sidebar now points operators to this consolidated view.</p>
          </div>
        </header>
        <div className={styles.modelGrid}>
          <div><strong>Health</strong><span>Integration reliability, support pressure and account condition establish whether the customer needs intervention.</span></div>
          <div><strong>Value</strong><span>Recorded conversations, leads, successful actions and usage show whether Fluxknight is producing measurable operational value.</span></div>
          <div><strong>Risk</strong><span>Declining usage, cancellation intent, unresolved support and unhealthy integrations override optimistic growth signals.</span></div>
          <div><strong>Opportunity</strong><span>Expansion appears only when measured usage supports another agent, channel, workflow or capacity review.</span></div>
        </div>
      </section>
    </main>
  );
}
