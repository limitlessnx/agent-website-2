import Link from "next/link";
import { Bot, Cable, Gauge, LineChart, Target, Workflow } from "@/components/admin/ServerIcons";
import { getExpansionSnapshots } from "@/lib/expansion-intelligence";

export const dynamic = "force-dynamic";

function badge(priority: "low" | "medium" | "high") {
  if (priority === "high") return "admin-status warning";
  if (priority === "medium") return "admin-status live";
  return "admin-status";
}

export default async function ExpansionIntelligencePage() {
  const snapshots = await getExpansionSnapshots(30);
  const opportunities = snapshots.flatMap((snapshot) => snapshot.opportunities);
  const highPriority = opportunities.filter((item) => item.priority === "high").length;
  const strongSignals = opportunities.filter((item) => item.confidence === "strong").length;
  const organizationsWithOpportunity = snapshots.filter((item) => item.opportunities.length > 0).length;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-kicker">Expansion intelligence</p>
          <h1>Growth Opportunities</h1>
          <p>Phase 7 turns measured usage into expansion recommendations without attaching them to today&apos;s pricing plans.</p>
        </div>
        <span className={opportunities.length ? "admin-status live" : "admin-status warning"}>
          {opportunities.length ? `${opportunities.length} opportunities detected` : "Awaiting stronger usage signals"}
        </span>
      </header>

      <div className="admin-metric-grid">
        <article className="admin-metric-card"><p><Target size={15} /> Organizations</p><strong>{organizationsWithOpportunity}</strong><span>With at least one expansion signal</span></article>
        <article className="admin-metric-card"><p><Gauge size={15} /> High priority</p><strong>{highPriority}</strong><span>Requires near-term review</span></article>
        <article className="admin-metric-card"><p><LineChart size={15} /> Strong signals</p><strong>{strongSignals}</strong><span>Backed by meaningful recorded activity</span></article>
        <article className="admin-metric-card"><p><Workflow size={15} /> Total opportunities</p><strong>{opportunities.length}</strong><span>Across agents, channels and workflows</span></article>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Organization opportunities</h2><p>Recommendations are evidence-led and remain advisory until a human approves any commercial or operational change.</p></div>
          <Target size={18} />
        </div>

        <div className="admin-list">
          {snapshots.map((snapshot) => (
            <article className="admin-list-row" key={snapshot.organizationId} style={{ alignItems: "start", gap: 18 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <strong>{snapshot.organizationName}</strong>
                  <span className={snapshot.opportunities.length ? "admin-status live" : "admin-status"}>
                    Opportunity score {snapshot.opportunityScore}/100
                  </span>
                </div>
                {!snapshot.hasOperationalData ? <span>No operational data is available yet, so no expansion recommendation is generated.</span> : null}
                {snapshot.hasOperationalData && snapshot.opportunities.length === 0 ? <span>Current usage does not cross any Phase 7 expansion threshold.</span> : null}

                {snapshot.opportunities.length > 0 ? (
                  <div className="admin-list" style={{ marginTop: 14 }}>
                    {snapshot.opportunities.map((item) => (
                      <div className="admin-list-row compact" key={item.id} style={{ alignItems: "start" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <strong>{item.title}</strong>
                            <span className={badge(item.priority)}>{item.priority} priority</span>
                            <span className="admin-status">{item.confidence} signal</span>
                          </div>
                          <span>{item.rationale}</span>
                          <span className="admin-muted">Evidence: {item.evidence.join(" · ")}</span>
                          <span className="admin-muted">Recommended: {item.recommendedAction}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 130 }}>
                <Link className="admin-button secondary" href={`/dashboard/value`}>Usage</Link>
                <Link className="admin-button secondary" href={`/dashboard/health`}>Health</Link>
                <Link className="admin-button secondary" href={`/dashboard/clients?organizationId=${encodeURIComponent(snapshot.organizationId)}`}>Workspace</Link>
              </div>
            </article>
          ))}
          {!snapshots.length ? <p className="admin-empty">No active organizations are available for expansion analysis.</p> : null}
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header"><div><h2>Phase 7 guardrails</h2><p>Growth intelligence is useful only when it avoids becoming a sales pop-up generator with delusions of strategy.</p></div><Bot size={18} /></div>
        <div className="admin-list">
          <div className="admin-list-row compact"><div><strong>No pricing-plan dependency</strong><span>Recommendations describe capacity, agent, channel and workflow needs without assigning a package or price.</span></div><Gauge size={17} /></div>
          <div className="admin-list-row compact"><div><strong>No automatic upsell email</strong><span>Expansion signals stay inside the dashboard and admin workflow unless a later policy explicitly enables outreach.</span></div><Cable size={17} /></div>
          <div className="admin-list-row compact"><div><strong>Human approval before expansion</strong><span>No agent, channel, automation or subscription change is applied automatically from these recommendations.</span></div><Workflow size={17} /></div>
        </div>
      </section>
    </main>
  );
}
