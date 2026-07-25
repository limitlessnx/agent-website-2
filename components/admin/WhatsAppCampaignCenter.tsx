"use client";

import { useMemo, useState, useTransition } from "react";
import type { PropertyRecord } from "@/lib/limitless-data";
import type { ProgressiveLead } from "@/lib/lead-profile-service";

type Props = {
  leads: ProgressiveLead[];
  properties: PropertyRecord[];
};

type AudienceMode = "all" | "manual" | "filters";

function text(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function money(value: unknown) {
  const parsed = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function eligible(lead: ProgressiveLead) {
  const status = text(lead.status);
  return Boolean(
    lead.phone &&
      lead.campaign_eligible !== false &&
      !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status),
  );
}

export default function WhatsAppCampaignCenter({ leads, properties }: Props) {
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [state, setState] = useState("");
  const [interest, setInterest] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [result, setResult] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const states = useMemo(
    () => [...new Set(leads.map((lead) => lead.location_preference).filter(Boolean) as string[])].sort(),
    [leads],
  );
  const interests = useMemo(
    () =>
      [
        ...new Set(
          leads
            .flatMap((lead) => [lead.purpose, lead.property_type, lead.property_interest])
            .filter(Boolean) as string[],
        ),
      ].sort(),
    [leads],
  );

  const selectedProperty = properties.find((property) => property.id === propertyId);

  const audience = useMemo(() => {
    const selected = new Set(selectedLeadIds);
    const stateNeedle = text(state);
    const interestNeedle = text(interest);
    const propertyNeedle = text(selectedProperty?.title || "");
    const minimum = money(budgetMin);
    const maximum = money(budgetMax);

    return leads.filter((lead) => {
      if (!eligible(lead)) return false;
      if (audienceMode === "all") return true;
      if (audienceMode === "manual") return selected.has(String(lead.id));

      if (stateNeedle && !text(lead.location_preference).includes(stateNeedle)) return false;
      if (interestNeedle) {
        const haystack = [lead.purpose, lead.property_type, lead.property_interest].map(text).join(" ");
        if (!haystack.includes(interestNeedle)) return false;
      }
      if (propertyNeedle) {
        const haystack = [lead.property_interest, lead.property_type, lead.purpose].map(text).join(" ");
        if (!haystack.includes(propertyNeedle)) return false;
      }
      const budget = money(lead.budget);
      if (minimum && (!budget || budget < minimum)) return false;
      if (maximum && (!budget || budget > maximum)) return false;
      return true;
    });
  }, [audienceMode, budgetMax, budgetMin, interest, leads, selectedLeadIds, selectedProperty, state]);

  const toggleLead = (id: string) => {
    setSelectedLeadIds((current) =>
      current.includes(id) ? current.filter((leadId) => leadId !== id) : [...current, id],
    );
  };

  const sendCampaign = () => {
    setResult("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/limitless/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic,
            message,
            mediaUrl,
            audienceMode,
            selectedLeadIds,
            state,
            interest,
            propertyId,
            budgetMin,
            budgetMax,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Campaign failed.");
        setResult(`${data.accepted} lead(s) accepted by the WhatsApp campaign workflow.`);
      } catch (error) {
        setResult(error instanceof Error ? error.message : "Campaign failed.");
      }
    });
  };

  return (
    <div className="campaign-center">
      <section className="campaign-panel">
        <div className="campaign-heading">
          <div>
            <span>Audience</span>
            <h2>Choose who receives this campaign</h2>
          </div>
          <strong>{audience.length} recipients</strong>
        </div>

        <div className="audience-tabs">
          {(["all", "manual", "filters"] as AudienceMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={audienceMode === mode ? "active" : ""}
              onClick={() => setAudienceMode(mode)}
            >
              {mode === "all" ? "All leads" : mode === "manual" ? "Manual selection" : "Smart filters"}
            </button>
          ))}
        </div>

        {audienceMode === "filters" ? (
          <div className="filter-grid">
            <label>
              <span>State or location</span>
              <input list="campaign-states" value={state} onChange={(event) => setState(event.target.value)} placeholder="Any location" />
              <datalist id="campaign-states">{states.map((value) => <option key={value} value={value} />)}</datalist>
            </label>
            <label>
              <span>Interest</span>
              <input list="campaign-interests" value={interest} onChange={(event) => setInterest(event.target.value)} placeholder="Any interest" />
              <datalist id="campaign-interests">{interests.map((value) => <option key={value} value={value} />)}</datalist>
            </label>
            <label>
              <span>Property</span>
              <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
                <option value="">Any property</option>
                {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
              </select>
            </label>
            <label>
              <span>Minimum budget</span>
              <input inputMode="numeric" value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} placeholder="₦0" />
            </label>
            <label>
              <span>Maximum budget</span>
              <input inputMode="numeric" value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} placeholder="No maximum" />
            </label>
          </div>
        ) : null}

        {audienceMode === "manual" ? (
          <div className="lead-picker">
            {leads.filter(eligible).map((lead) => (
              <label key={lead.id} className="lead-row">
                <input type="checkbox" checked={selectedLeadIds.includes(String(lead.id))} onChange={() => toggleLead(String(lead.id))} />
                <span>
                  <strong>{lead.name}</strong>
                  <small>{lead.phone} · {lead.profile_status || "undocumented"}</small>
                </span>
              </label>
            ))}
          </div>
        ) : null}
      </section>

      <section className="campaign-panel">
        <div className="campaign-heading">
          <div>
            <span>Message</span>
            <h2>Compose WhatsApp campaign</h2>
          </div>
          <strong>Maia</strong>
        </div>
        <div className="compose-grid">
          <label>
            <span>Campaign title</span>
            <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="New estate update" />
          </label>
          <label>
            <span>Property to feature</span>
            <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
              <option value="">No linked property</option>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
            </select>
          </label>
          <label className="wide">
            <span>Message</span>
            <textarea rows={8} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write the WhatsApp message Maia should send..." />
          </label>
          <label className="wide">
            <span>Optional media URL</span>
            <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder={selectedProperty?.drive_photos_link || "Google Drive or public image link"} />
          </label>
        </div>
        <div className="campaign-submit">
          <div>
            <strong>{audience.length} eligible recipients</strong>
            <small>Undocumented leads are included when using All leads or manual selection.</small>
          </div>
          <button type="button" disabled={isPending || !message.trim() || audience.length === 0} onClick={sendCampaign}>
            {isPending ? "Sending to n8n..." : "Send WhatsApp campaign"}
          </button>
        </div>
        {result ? <p className="campaign-result">{result}</p> : null}
      </section>

      <style jsx>{`
        .campaign-center { display: grid; gap: 22px; }
        .campaign-panel { border: 1px solid rgba(167,112,255,.24); border-radius: 24px; background: linear-gradient(145deg,#11081f,#09050f); padding: 24px; }
        .campaign-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; margin-bottom:20px; }
        .campaign-heading span, label span { display:block; color:#a99cbd; font-size:.78rem; letter-spacing:.12em; text-transform:uppercase; margin-bottom:7px; }
        .campaign-heading h2 { margin:0; color:#fff; font-size:1.35rem; }
        .campaign-heading strong { color:#bd8cff; }
        .audience-tabs { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px; }
        .audience-tabs button { border:1px solid rgba(167,112,255,.24); border-radius:999px; padding:10px 15px; color:#c9bed9; background:#0d0716; }
        .audience-tabs button.active { color:#fff; background:#7c3aed; border-color:#9f67ff; }
        .filter-grid,.compose-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
        label input,label select,label textarea { width:100%; box-sizing:border-box; border:1px solid rgba(173,137,236,.24); border-radius:13px; padding:13px 14px; background:#08050e; color:#fff; font:inherit; }
        label textarea { resize:vertical; }
        .wide { grid-column:1/-1; }
        .lead-picker { max-height:360px; overflow:auto; display:grid; gap:8px; padding-right:4px; }
        .lead-row { display:flex; align-items:center; gap:12px; border:1px solid rgba(173,137,236,.16); border-radius:13px; padding:12px; background:#0a0611; }
        .lead-row input { width:auto; }
        .lead-row span { margin:0; text-transform:none; letter-spacing:0; }
        .lead-row strong,.lead-row small { display:block; }
        .lead-row small { color:#9d91ad; margin-top:4px; }
        .campaign-submit { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-top:20px; }
        .campaign-submit strong,.campaign-submit small { display:block; }
        .campaign-submit small { color:#9d91ad; margin-top:5px; }
        .campaign-submit button { border:0; border-radius:14px; padding:14px 18px; font-weight:800; color:white; background:linear-gradient(135deg,#9b5cff,#6d28d9); }
        .campaign-submit button:disabled { opacity:.45; }
        .campaign-result { margin:16px 0 0; color:#cab8e7; }
        @media(max-width:700px){ .campaign-panel{padding:18px}.filter-grid,.compose-grid{grid-template-columns:1fr}.wide{grid-column:auto}.campaign-submit,.campaign-heading{align-items:stretch;flex-direction:column}.campaign-submit button{width:100%} }
      `}</style>
    </div>
  );
}
