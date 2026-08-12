import EvaluationLeadsManager from "@/components/admin/EvaluationLeadsManager";
import { getEvaluationLeads } from "@/lib/evaluation-leads";
import { getLeoPublicLeads } from "@/lib/leo-public-leads";

export const dynamic = "force-dynamic";

export default async function EvaluationsPage() {
  const [leads, leoLeads] = await Promise.all([
    getEvaluationLeads(500),
    getLeoPublicLeads(100).catch(() => []),
  ]);
  const total = leads.length;
  const newCount = leads.filter((lead) => lead.status === "new").length;
  const qualified = leads.filter((lead) => lead.status === "qualified").length;
  const converted = leads.filter((lead) => lead.status === "converted").length;

  return (
    <div className="admin-page evaluation-page">
      <section className="admin-hero-panel">
        <div>
          <p className="admin-kicker">Fluxknight / AI Evaluation Pipeline</p>
          <h1>Evaluation Leads</h1>
          <p>Review website evaluation requests, inspect the business need, and move each prospect through your qualification pipeline.</p>
        </div>
        <div className="admin-launch-score"><span>{newCount}</span><p>New requests</p></div>
      </section>

      <section className="console-kpi-grid evaluation-kpis">
        <article><span>TOTAL REQUESTS</span><strong>{total}</strong><i style={{ "--meter": `${Math.min(100, total * 8)}%` } as React.CSSProperties} /></article>
        <article><span>NEW</span><strong>{newCount}</strong><i style={{ "--meter": `${total ? Math.round((newCount / total) * 100) : 0}%` } as React.CSSProperties} /></article>
        <article><span>QUALIFIED</span><strong>{qualified}</strong><i style={{ "--meter": `${total ? Math.round((qualified / total) * 100) : 0}%` } as React.CSSProperties} /></article>
        <article><span>CONVERTED</span><strong>{converted}</strong><i style={{ "--meter": `${total ? Math.round((converted / total) * 100) : 0}%` } as React.CSSProperties} /></article>
      </section>

      <EvaluationLeadsManager initialLeads={leads} />

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Leo Website Leads</h2>
            <p>Summaries captured by the public Leo support and onboarding assistant on the Fluxknight homepage.</p>
          </div>
          <span className="admin-status live">{leoLeads.length} captured</span>
        </div>
        <div className="admin-list">
          {leoLeads.slice(0, 25).map((lead) => {
            const qualification = lead.qualification || {};
            const need = String(qualification.business_need || lead.notes || "").slice(0, 260);
            return (
              <article key={lead.id} className="admin-list-row">
                <div>
                  <strong>{lead.full_name || "Website visitor"}</strong>
                  <span>{lead.company_name || "No business name"} · {lead.industry || "Industry pending"} · {lead.recommended_plan || "Package pending"}</span>
                  <span>{need || "No summary saved yet."}</span>
                </div>
                <div>
                  <em>{lead.phone || "No WhatsApp"}</em>
                  <em>{lead.email || "No email"}</em>
                  <em>{new Date(lead.created_at).toLocaleString("en-NG")}</em>
                </div>
              </article>
            );
          })}
          {!leoLeads.length ? <p className="admin-empty">No public Leo leads yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
