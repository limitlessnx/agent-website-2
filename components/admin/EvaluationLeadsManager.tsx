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
    </div>
  );
}
