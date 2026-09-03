import Link from "next/link";
import { Activity, Bot, LineChart, MessageCircle, Target, Users, Workflow } from "@/components/admin/ServerIcons";
import { getOrganizationValueReports, type UsageTrend } from "@/lib/usage-reporting";

export const dynamic = "force-dynamic";

function formatTrend(metric: UsageTrend) {
  if (metric.changePercent === null) return metric.current > 0 ? "New activity" : "No prior baseline";
  const sign = metric.changePercent > 0 ? "+" : "";
  return `${sign}${metric.changePercent}% vs previous period`;
}

function formatDate(value: string | null) {
  if (!value) return "No tracked activity yet";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function UsageValuePage() {
  const reports = await getOrganizationValueReports(30);
  const activeReports = reports.filter((report) => report.hasOperationalData);
  const totals = reports.reduce(
    (accumulator, report) => {
      accumulator.conversations += report.metrics.conversations.current;
      accumulator.leads += report.metrics.leadsCaptured.current;
      accumulator.actions += report.metrics.successfulActions.current;
      accumulator.handoffs += report.metrics.handoffs.current;
      return accumulator;
    },
    { conversations: 0, leads: 0, actions: 0, handoffs: 0 },
  );

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Customer value</p>
          <h1>Usage &amp; Value</h1>
          <p>Thirty-day organization reporting built only from recorded Fluxknight activity. Empty sources stay empty rather than becoming optimistic fiction.</p>
        </div>
        <span className={activeReports.length ? "admin-status live" : "admin-status warning"}>
          {activeReports.length ? `${activeReports.length} organizations reporting activity` : "Awaiting operational data"}
        </span>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><MessageCircle size={15} /> Conversations</p><strong>{totals.conversations}</strong><span>Tracked agent conversations</span></article>
        <article className="admin-metric-card"><p><Users size={15} /> Leads captured</p><strong>{totals.leads}</strong><span>Organization-scoped CRM leads</span></article>
        <article className="admin-metric-card"><p><Workflow size={15} /> Successful actions</p><strong>{totals.actions}</strong><span>Runtime executions and tool calls</span></article>
        <article className="admin-metric-card"><p><Target size={15} /> Human handoffs</p><strong>{totals.handoffs}</strong><span>Escalations requiring people</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Organization value reports</h2><p>Current 30 days compared with the preceding 30-day period.</p></div>
          <LineChart size={18} />
        </div>

        <div className="admin-list">
          {reports.map((report) => {
            const measuredMinutes = report.metrics.estimatedTimeSavedMinutes;
            const coverageWithData = report.trackingCoverage.filter((source) => source.recordCount > 0).length;
            return (
              <article className="admin-list-row" key={report.organizationId} style={{ alignItems: "start", gap: 18 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <strong>{report.organizationName}</strong>
                    <span className={report.hasOperationalData ? "admin-status live" : "admin-status warning"}>
                      {report.hasOperationalData ? "Activity tracked" : "No current activity"}
                    </span>
                  </div>
                  <span>Last tracked activity: {formatDate(report.lastActivityAt)}</span>
                  <span>{coverageWithData}/{report.trackingCoverage.length} reporting sources currently contain records.</span>

                  <div className="admin-grid four" style={{ marginTop: 16 }}>
                    <section className="admin-panel compact">
                      <p>Conversations</p>
                      <strong>{report.metrics.conversations.current}</strong>
                      <span className="admin-muted">{formatTrend(report.metrics.conversations)}</span>
                    </section>
                    <section className="admin-panel compact">
                      <p>Leads</p>
                      <strong>{report.metrics.leadsCaptured.current}</strong>
                      <span className="admin-muted">{report.metrics.qualifiedLeads.current} currently qualified</span>
                    </section>
                    <section className="admin-panel compact">
                      <p>Successful actions</p>
                      <strong>{report.metrics.successfulActions.current}</strong>
                      <span className="admin-muted">{report.metrics.successRate === null ? "Success rate not yet measurable" : `${report.metrics.successRate}% measured success`}</span>
                    </section>
                    <section className="admin-panel compact">
                      <p>Measured time saved</p>
                      <strong>{measuredMinutes === null ? "—" : `${Math.round(measuredMinutes / 60 * 10) / 10}h`}</strong>
                      <span className="admin-muted">{measuredMinutes === null ? "Not yet recorded in usage metadata" : `${measuredMinutes} minutes recorded`}</span>
                    </section>
                  </div>

                  <div className="admin-grid two" style={{ marginTop: 14 }}>
                    <section className="admin-panel compact">
                      <p>Channels</p>
                      <strong>{report.topChannel ? report.topChannel.replaceAll("_", " ") : "Not yet tracked"}</strong>
                      <span className="admin-muted">{report.metrics.whatsappMessages.current} successful WhatsApp deliveries · {report.metrics.emailsSent.current} emails sent</span>
                    </section>
                    <section className="admin-panel compact">
                      <p>Operational intervention</p>
                      <strong>{report.metrics.handoffs.current}</strong>
                      <span className="admin-muted">Human handoffs · {report.metrics.failedActions.current} failed runtime actions</span>
                    </section>
                  </div>

                  {Object.keys(report.usageByType).length ? (
                    <div style={{ marginTop: 14 }}>
                      <span className="admin-muted">Metered usage: {Object.entries(report.usageByType).map(([type, quantity]) => `${type.replaceAll("_", " ")}: ${quantity}`).join(" · ")}</span>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 130 }}>
                  <Link className="admin-button secondary" href={`/dashboard/clients?organizationId=${encodeURIComponent(report.organizationId)}`}>Workspace</Link>
                  <Link className="admin-button secondary" href="/dashboard/health">Health</Link>
                </div>
              </article>
            );
          })}
          {!reports.length ? <p className="admin-empty">No active organizations are available for reporting.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Reporting policy</h2><p>Phase 6 deliberately separates measured value from future instrumentation.</p></div><Activity size={18} /></div>
        <div className="admin-list">
          <div className="admin-list-row compact"><div><strong>Organization-scoped sources only</strong><span>Legacy records without a reliable tenant key are excluded from customer value reports.</span></div><Bot size={17} /></div>
          <div className="admin-list-row compact"><div><strong>No assumed time savings</strong><span>Time saved appears only when an execution or usage record explicitly stores that measurement.</span></div><LineChart size={17} /></div>
          <div className="admin-list-row compact"><div><strong>Dashboard first</strong><span>No Phase 6 email is sent automatically. Periodic summaries can be enabled later as an optional preference.</span></div><MessageCircle size={17} /></div>
        </div>
      </section>
    </main>
  );
}
