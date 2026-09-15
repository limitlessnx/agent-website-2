import Link from "next/link";
import styles from "./BusinessCommandCenterPanel.module.css";

type Snapshot = {
  generatedAt: string;
  status: "healthy" | "attention" | "critical" | "unknown";
  headline: string;
  metrics: {
    workspaces: number;
    activeWorkspaces: number;
    kpis: { total: number; healthy: number; attention: number; critical: number; insufficientData: number };
    risks: { matchedRules: number; blockedRecommendations: number; overdue: number; dueSoon: number; criticalEvents: number; highEvents: number };
    optimizations: number;
    businessModels: number;
  };
  priorityRisks: Array<{ key: string; severity: string; title: string; detail: string; source: string }>;
  upcoming: Array<{ id: string; title: string; type: string; priority: string; dueAt: string; timing: string; workspace?: string; organizationId?: string }>;
  recentEvents: Array<{ id: string; type: string; severity: string; occurredAt: string; workspace?: string; organizationId: string }>;
  recommendations: Array<{ title: string; detail: string; source: string; requiresApproval: boolean }>;
};

function label(value: string) { return value.replaceAll("_", " ").replaceAll(".", " "); }
function time(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString() : value; }

export default function BusinessCommandCenterPanel({ snapshot }: { snapshot: Snapshot | null }) {
  if (!snapshot) return null;
  const attention = snapshot.priorityRisks.length;
  const highRiskEvents = snapshot.metrics.risks.criticalEvents + snapshot.metrics.risks.highEvents;
  const statusCopy = snapshot.status === "healthy"
    ? "Operations are stable across the current evidence."
    : snapshot.status === "critical"
      ? "Critical operating signals need review now."
      : "Some operating signals need attention.";

  return (
    <section className={styles.shell} aria-label="Business command center">
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>OPERATIONS OVERVIEW</span>
          <h1>Command Center</h1>
          <p>{statusCopy}</p>
          {snapshot.headline ? <small>{snapshot.headline}</small> : null}
        </div>
        <span className={`${styles.status} ${styles[snapshot.status]}`}>{snapshot.status}</span>
      </header>

      <div className={styles.metrics}>
        <article><span>Workspaces</span><strong>{snapshot.metrics.activeWorkspaces}<i>/{snapshot.metrics.workspaces}</i></strong><small>currently active</small></article>
        <article className={attention ? styles.metricAttention : ""}><span>Needs attention</span><strong>{attention}</strong><small>{attention ? "priority operating signals" : "nothing urgent"}</small></article>
        <article><span>Due soon</span><strong>{snapshot.metrics.risks.dueSoon}</strong><small>{snapshot.metrics.risks.overdue} overdue</small></article>
        <article className={highRiskEvents ? styles.metricAttention : ""}><span>24h risk events</span><strong>{highRiskEvents}</strong><small>{snapshot.metrics.risks.criticalEvents} critical · {snapshot.metrics.risks.highEvents} high</small></article>
      </div>

      <div className={styles.primaryGrid}>
        <article className={`${styles.panel} ${styles.priorityPanel}`}>
          <header>
            <div><span>NEEDS ATTENTION</span><h2>What requires review</h2><p>Highest-priority signals from the current operating state.</p></div>
            <Link href="/dashboard/activity">View activity</Link>
          </header>
          <div className={styles.list}>
            {snapshot.priorityRisks.slice(0, 4).map((risk) => (
              <div className={styles.row} key={risk.key}>
                <b className={`${styles.badge} ${styles[risk.severity] || ""}`}>{risk.severity}</b>
                <div><strong>{label(risk.title)}</strong><small>{risk.detail}</small></div>
              </div>
            ))}
            {!snapshot.priorityRisks.length && <div className={`${styles.empty} ${styles.emptyGood}`}><strong>No urgent operating issues.</strong><span>Current evidence does not show a high-priority signal that needs review.</span></div>}
          </div>
        </article>

        <article className={styles.panel}>
          <header>
            <div><span>NEXT ACTIONS</span><h2>Recommended next moves</h2><p>Evidence-backed recommendations. Sensitive changes still require approval.</p></div>
          </header>
          <div className={styles.list}>
            {snapshot.recommendations.slice(0, 4).map((item, index) => (
              <div className={styles.row} key={`${item.source}-${index}`}>
                <b className={styles.badge}>{item.requiresApproval ? "approval" : "review"}</b>
                <div><strong>{label(item.title)}</strong><small>{item.detail}</small></div>
              </div>
            ))}
            {!snapshot.recommendations.length && <div className={styles.empty}><strong>No action recommended.</strong><span>There is no evidence-backed intervention to surface right now.</span></div>}
          </div>
        </article>
      </div>

      <div className={styles.secondaryGrid}>
        <article className={styles.panel}>
          <header><div><span>UPCOMING</span><h2>Deadlines</h2></div><span>{snapshot.metrics.risks.dueSoon} due soon</span></header>
          <div className={styles.list}>
            {snapshot.upcoming.slice(0, 4).map((item) => (
              <div className={styles.row} key={item.id}>
                <b className={styles.badge}>{item.timing}</b>
                <div><strong>{item.title}</strong><small>{time(item.dueAt)}{item.workspace ? ` · ${item.workspace}` : ""}</small></div>
              </div>
            ))}
            {!snapshot.upcoming.length && <div className={styles.empty}>No overdue or near-term operating deadlines.</div>}
          </div>
        </article>

        <article className={styles.panel}>
          <header><div><span>RECENT CHANGES</span><h2>Business events</h2></div><span>last 24 hours</span></header>
          <div className={styles.list}>
            {snapshot.recentEvents.slice(0, 4).map((event) => (
              <div className={styles.row} key={event.id}>
                <b className={`${styles.badge} ${styles[event.severity] || ""}`}>{event.severity}</b>
                <div><strong>{label(event.type)}</strong><small>{event.workspace || event.organizationId} · {time(event.occurredAt)}</small></div>
              </div>
            ))}
            {!snapshot.recentEvents.length && <div className={styles.empty}>No significant business events were recorded in the last 24 hours.</div>}
          </div>
        </article>
      </div>

      <footer><span>Updated {time(snapshot.generatedAt)}</span><span>Read-only overview · sensitive actions require approval</span></footer>
    </section>
  );
}
