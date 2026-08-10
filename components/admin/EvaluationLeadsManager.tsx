"use client";

import { useMemo, useState, useTransition } from "react";
import type { EvaluationLead } from "@/lib/evaluation-leads";

const statuses = ["new", "contacted", "qualified", "converted", "closed"] as const;

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function EvaluationLeadsManager({ initialLeads }: { initialLeads: EvaluationLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(initialLeads[0]?.id || "");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (!needle) return true;
      return [lead.name, lead.email, lead.phone, lead.business_name, lead.business_type, lead.main_goal]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [leads, query, statusFilter]);

  const selected = leads.find((lead) => lead.id === selectedId) || filtered[0] || null;

  function updateStatus(id: string, status: string) {
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/evaluations/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to update status.");
        setLeads((current) => current.map((lead) => lead.id === id ? { ...lead, status, updated_at: new Date().toISOString() } : lead));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to update status.");
      }
    });
  }

  return (
    <div className="evaluation-manager">
      <section className="evaluation-list-panel">
        <div className="evaluation-toolbar">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, business, phone, goal..." />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
        </div>

        <div className="evaluation-list">
          {filtered.length ? filtered.map((lead) => (
            <button key={lead.id} type="button" onClick={() => setSelectedId(lead.id)} className={selected?.id === lead.id ? "active" : ""}>
              <div><strong>{lead.name}</strong><span>{lead.business_name}</span></div>
              <small>{lead.phone}</small>
              <em className={`evaluation-status status-${lead.status}`}>{label(lead.status)}</em>
            </button>
          )) : <p className="evaluation-empty">No evaluation requests match this filter.</p>}
        </div>
      </section>

      <section className="evaluation-detail-panel">
        {selected ? (
          <>
            <header className="evaluation-detail-header">
              <div><span>Evaluation request</span><h2>{selected.name}</h2><p>{selected.business_name} · {selected.business_type}</p></div>
              <select disabled={isPending} value={selected.status} onChange={(event) => updateStatus(selected.id, event.target.value)}>
                {statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
              </select>
            </header>

            <div className="evaluation-contact-grid">
              <a href={`tel:${selected.phone}`}>Call<br /><strong>{selected.phone}</strong></a>
              <a href={`mailto:${selected.email}`}>Email<br /><strong>{selected.email}</strong></a>
              <div>Preferred time<br /><strong>{selected.preferred_contact_time || "Not specified"}</strong></div>
              <div>Submitted<br /><strong>{new Date(selected.submitted_at).toLocaleString("en-NG")}</strong></div>
            </div>

            <div className="evaluation-section"><span>Requested agents</span><div className="evaluation-chips">{selected.agent_types.map((type) => <b key={type}>{label(type)}</b>)}</div></div>
            <div className="evaluation-section"><span>Main goal</span><p>{selected.main_goal}</p></div>
            <div className="evaluation-detail-grid">
              <div><span>Lead volume</span><strong>{selected.lead_volume}</strong></div>
              <div><span>Timeline</span><strong>{selected.timeline}</strong></div>
              <div><span>Budget</span><strong>{selected.budget}</strong></div>
              <div><span>Current tools</span><strong>{selected.current_tools || "None specified"}</strong></div>
            </div>
            <div className="evaluation-section"><span>Consent</span><p>{selected.consent_given ? "Consent granted for contact and AI evaluation call." : "No consent recorded."}</p></div>
            {error ? <p className="evaluation-error">{error}</p> : null}
          </>
        ) : <p className="evaluation-empty">Select an evaluation request to inspect it.</p>}
      </section>

      <style jsx>{`
        .evaluation-manager{display:grid;grid-template-columns:minmax(300px,.78fr) minmax(0,1.4fr);gap:18px;align-items:start}
        .evaluation-list-panel,.evaluation-detail-panel{border:1px solid rgba(167,139,250,.2);border-radius:16px;background:linear-gradient(145deg,rgba(20,16,39,.96),rgba(8,7,18,.98));box-shadow:0 20px 60px rgba(0,0,0,.25)}
        .evaluation-list-panel{padding:14px}.evaluation-detail-panel{padding:22px;min-height:540px}
        .evaluation-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:9px;margin-bottom:12px}
        .evaluation-toolbar input,.evaluation-toolbar select,.evaluation-detail-header select{min-width:0;min-height:42px;border:1px solid rgba(167,139,250,.22);border-radius:10px;padding:0 12px;color:#f8fbff;background:#090713;font:inherit}
        .evaluation-list{display:grid;gap:8px;max-height:660px;overflow:auto;padding-right:2px}
        .evaluation-list button{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;text-align:left;padding:13px;border:1px solid rgba(167,139,250,.14);border-radius:12px;color:#f8fbff;background:rgba(12,9,25,.72);cursor:pointer}
        .evaluation-list button.active{border-color:rgba(167,139,250,.58);background:linear-gradient(135deg,rgba(124,58,237,.24),rgba(34,211,238,.07))}
        .evaluation-list button div{min-width:0}.evaluation-list strong,.evaluation-list span,.evaluation-list small{display:block;overflow-wrap:anywhere}.evaluation-list span,.evaluation-list small{color:#9b91ad;font-size:.82rem}.evaluation-list small{grid-column:1;margin-top:2px}
        .evaluation-status{grid-column:2;grid-row:1 / span 2;align-self:center;padding:5px 8px;border-radius:999px;font-size:.66rem;font-style:normal;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#c4b5fd;border:1px solid rgba(167,139,250,.28)}
        .status-qualified,.status-converted{color:#6ee7b7;border-color:rgba(52,211,153,.35)}.status-closed{color:#94a3b8}.status-contacted{color:#67e8f9;border-color:rgba(34,211,238,.35)}
        .evaluation-detail-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:18px;border-bottom:1px solid rgba(167,139,250,.16)}
        .evaluation-detail-header span,.evaluation-section>span,.evaluation-detail-grid span{color:#8f83a4;font-size:.7rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.evaluation-detail-header h2{margin:5px 0 4px;font-size:1.7rem}.evaluation-detail-header p{margin:0;color:#aaa0b8}.evaluation-detail-header select{width:145px}
        .evaluation-contact-grid,.evaluation-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:16px}.evaluation-contact-grid>* ,.evaluation-detail-grid>div{min-width:0;padding:13px;border:1px solid rgba(167,139,250,.14);border-radius:11px;color:#958aa7;background:rgba(255,255,255,.02);font-size:.76rem;line-height:1.5;text-decoration:none}.evaluation-contact-grid strong,.evaluation-detail-grid strong{color:#f8fbff;font-size:.88rem;overflow-wrap:anywhere}
        .evaluation-section{margin-top:18px;padding-top:16px;border-top:1px solid rgba(167,139,250,.12)}.evaluation-section p{margin:8px 0 0;color:#d7d0e1;line-height:1.65}.evaluation-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.evaluation-chips b{padding:7px 9px;border:1px solid rgba(34,211,238,.22);border-radius:999px;color:#a5f3fc;background:rgba(34,211,238,.06);font-size:.76rem}.evaluation-error{color:#fda4af}.evaluation-empty{color:#93889f;text-align:center;padding:28px 12px}
        @media(max-width:900px){.evaluation-manager{grid-template-columns:1fr}.evaluation-list{max-height:390px}}
        @media(max-width:620px){.evaluation-list-panel,.evaluation-detail-panel{padding:12px;border-radius:12px}.evaluation-toolbar{grid-template-columns:1fr}.evaluation-detail-header{flex-direction:column}.evaluation-detail-header select{width:100%}.evaluation-contact-grid,.evaluation-detail-grid{grid-template-columns:1fr}.evaluation-list button{grid-template-columns:minmax(0,1fr) auto}.evaluation-detail-panel{min-height:0}}
      `}</style>
    </div>
  );
}
