import Link from "next/link";
import { Activity, Building2, PlugZap, ShieldCheck } from "@/components/admin/ServerIcons";
import { calculateOrganizationHealthSnapshots } from "@/lib/customer-health";
import { getPlatformEngineSummary } from "@/lib/platform-engine";

export const dynamic = "force-dynamic";

type HealthPageProps = {
  searchParams: Promise<{ organizationId?: string }>;
};

function bandLabel(band: string) {
  if (band === "healthy") return "Healthy";
  if (band === "watch") return "Watch";
  if (band === "risk") return "At risk";
  return "Critical";
}

export default async function CustomerHealthPage({ searchParams }: HealthPageProps) {
  const { organizationId } = await searchParams;
  const { integrations, errors } = await getPlatformEngineSummary();
  const allSnapshots = calculateOrganizationHealthSnapshots(integrations, errors);
  const snapshots = organizationId
    ? allSnapshots.filter((snapshot) => snapshot.organizationId === organizationId)
    : allSnapshots;

  const healthy = snapshots.filter((snapshot) => snapshot.band === "healthy").length;
  const watch = snapshots.filter((snapshot) => snapshot.band === "watch").length;
  const risk = snapshots.filter((snapshot) => ["risk", "critical"].includes(snapshot.band)).length;
  const alerts = snapshots.reduce((total, snapshot) => total + snapshot.notifications.length, 0);

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Phase 5 · Customer success</p>
          <h1>Customer Health</h1>
          <p>Organization health is calculated from live integration state, stale health checks, channel availability and recent platform activity. Dashboard alerts are the default response; email is reserved for separately routed critical events.</p>
        </div>
        <span className={risk ? "admin-status warning" : "admin-status live"}>
          {risk ? `${risk} organization${risk === 1 ? "" : "s"} need attention` : "Customer health stable"}
        </span>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><ShieldCheck size={15} /> Healthy</p><strong>{healthy}</strong><span>Score 80–100</span></article>
        <article className="admin-metric-card"><p><Activity size={15} /> Watch</p><strong>{watch}</strong><span>Score 60–79</span></article>
        <article className="admin-metric-card"><p><Building2 size={15} /> At risk</p><strong>{risk}</strong><span>Score below 60</span></article>
        <article className="admin-metric-card"><p><PlugZap size={15} /> Active alerts</p><strong>{alerts}</strong><span>Dashboard-first interventions</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Organization health board</h2><p>Lowest health scores appear first so customer-success attention goes where it is actually needed.</p></div>
          <Activity size={18} />
        </div>
        <div className="admin-list">
          {snapshots.map((snapshot) => (
            <div className="admin-list-row" key={snapshot.organizationId} style={{ alignItems: "start", gap: 18 }}>
              <div style={{ flex: 1 }}>
                <strong>{snapshot.organizationName}</strong>
                <span>Health score {snapshot.score}/100 · {bandLabel(snapshot.band)} · {snapshot.connectedIntegrations}/{snapshot.integrationCount} integrations connected</span>
                <span>
                  Last platform activity {snapshot.lastActivityAt
                    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(snapshot.lastActivityAt))
                    : "not yet recorded"}
                </span>
                {snapshot.signals.length ? (
                  <div style={{ marginTop: 8 }}>
                    {snapshot.signals.map((signal) => (
                      <span key={signal.key} style={{ display: "block" }}>
                        {signal.label}: {signal.detail} · -{signal.impact} points
                      </span>
                    ))}
                  </div>
                ) : <span>No active health-risk signals.</span>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Link className="admin-button secondary" href={`/dashboard/clients?organizationId=${encodeURIComponent(snapshot.organizationId)}`}>Workspace</Link>
                <Link className="admin-button secondary" href={`/dashboard/integrations?organizationId=${encodeURIComponent(snapshot.organizationId)}`}>Integrations</Link>
              </div>
            </div>
          ))}
          {!snapshots.length ? <p className="admin-empty">No organization integration records are available yet, so there is not enough real data to calculate customer health.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Dashboard interventions</h2><p>Health and integration issues stay in-product unless a separate routing rule escalates them.</p></div><ShieldCheck size={18} /></div>
        <div className="admin-list">
          {snapshots.flatMap((snapshot) => snapshot.notifications).map((notification) => (
            <div className="admin-list-row compact" key={notification.id}>
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.message}</span>
              </div>
              {notification.actionHref && notification.actionLabel ? <Link href={notification.actionHref}>{notification.actionLabel}</Link> : null}
            </div>
          ))}
          {!alerts ? <p className="admin-empty">No health interventions are currently required.</p> : null}
        </div>
      </section>

      {errors.length ? (
        <section className="admin-panel">
          <div className="admin-list-row compact"><div><strong>Health visibility is partially degraded</strong><span>{errors.join(" · ")}</span></div><ShieldCheck size={16} /></div>
        </section>
      ) : null}
    </main>
  );
}
