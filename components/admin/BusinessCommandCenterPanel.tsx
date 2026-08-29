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
  return (
    <section className={styles.shell} aria-label="Business Operations OS command center">
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>PHASE 8 · BUSINESS OPERATIONS OS</span><h2>Business Command Center</h2><p>{snapshot.headline}</p></div>
        <span className={`${styles.status} ${styles[snapshot.status]}`}>{snapshot.status}</span>
      </header>

      <div className={styles.metrics}>
        <article><span>Workspaces</span><strong>{snapshot.metrics.activeWorkspaces}/{snapshot.metrics.workspaces}</strong><small>active across portfolio</small></article>
        <article><span>KPI health</span><strong>{snapshot.metrics.kpis.healthy}/{snapshot.metrics.kpis.total}</strong><small>{snapshot.metrics.kpis.critical} critical · {snapshot.metrics.kpis.attention} attention</small></article>
        <article><span>Operating risks</span><strong>{attention}</strong><small>{snapshot.metrics.risks.matchedRules} rule breaches · {snapshot.metrics.risks.overdue} overdue</small></article>
        <article><span>24h event risk</span><strong>{snapshot.metrics.risks.criticalEvents + snapshot.metrics.risks.highEvents}</strong><small>{snapshot.metrics.risks.criticalEvents} critical · {snapshot.metrics.risks.highEvents} high</small></article>
      </div>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <header><div><span>PRIORITY RISKS</span><h3>What needs attention now</h3></div><Link href="/dashboard/activity">Open activity</Link></header>
          <div className={styles.list}>
            {snapshot.priorityRisks.slice(0, 5).map((risk) => <div className={styles.row} key={risk.key}><b className={`${styles.badge} ${styles[risk.severity] || ""}`}>{risk.severity}</b><div><strong>{label(risk.title)}</strong><small>{risk.detail}</small></div></div>)}
            {!snapshot.priorityRisks.length && <div className={styles.empty}>No current high-priority operating risks.</div>}
          </div>
        </article>

        <article className={styles.panel}>
          <header><div><span>NEXT OPERATIONS</span><h3>Calendar and deadlines</h3></div><span>{snapshot.metrics.risks.dueSoon} due soon</span></header>
          <div className={styles.list}>
            {snapshot.upcoming.slice(0, 5).map((item) => <div className={styles.row} key={item.id}><b className={styles.badge}>{item.timing}</b><div><strong>{item.title}</strong><small>{label(item.type)} · {time(item.dueAt)}{item.workspace ? ` · ${item.workspace}` : ""}</small></div></div>)}
            {!snapshot.upcoming.length && <div className={styles.empty}>No overdue or near-term operational calendar items.</div>}
          </div>
        </article>
      </div>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <header><div><span>RECOMMENDATIONS</span><h3>Next best actions</h3></div><span>{snapshot.metrics.optimizations} optimization proposals</span></header>
          <div className={styles.list}>
            {snapshot.recommendations.slice(0, 5).map((item, index) => <div className={styles.row} key={`${item.source}-${index}`}><b className={styles.badge}>{item.requiresApproval ? "approval" : "review"}</b><div><strong>{label(item.title)}</strong><small>{item.detail}</small></div></div>)}
            {!snapshot.recommendations.length && <div className={styles.empty}>No evidence-backed intervention is currently recommended.</div>}
          </div>
        </article>

        <article className={styles.panel}>
          <header><div><span>BUSINESS EVENTS</span><h3>Recent operating changes</h3></div><span>last 24 hours</span></header>
          <div className={styles.list}>
            {snapshot.recentEvents.slice(0, 5).map((event) => <div className={styles.row} key={event.id}><b className={`${styles.badge} ${styles[event.severity] || ""}`}>{event.severity}</b><div><strong>{label(event.type)}</strong><small>{event.workspace || event.organizationId} · {time(event.occurredAt)}</small></div></div>)}
            {!snapshot.recentEvents.length && <div className={styles.empty}>No normalized business events recorded in the last 24 hours.</div>}
          </div>
        </article>
      </div>

      <footer>Generated {time(snapshot.generatedAt)} · Read-only executive view · Sensitive actions remain approval-gated.</footer>
    </section>
  );
}
