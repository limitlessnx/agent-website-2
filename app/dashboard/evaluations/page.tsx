import EvaluationLeadsManager from "@/components/admin/EvaluationLeadsManager";
import { getEvaluationLeads } from "@/lib/evaluation-leads";

export const dynamic = "force-dynamic";

export default async function EvaluationsPage() {
  const leads = await getEvaluationLeads(500);
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
    </div>
  );
}
