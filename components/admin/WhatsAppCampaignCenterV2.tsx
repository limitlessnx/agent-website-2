"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { matchesCampaignGroupRules, type CampaignGroup } from "@/lib/campaign-groups";
import type { ProgressiveLead } from "@/lib/lead-profile-service";
import type { PropertyRecord } from "@/lib/limitless-data";

type Props = { leads: ProgressiveLead[]; properties: PropertyRecord[]; groups: CampaignGroup[] };
type AudienceMode = "all" | "manual" | "group" | "filters";
type CampaignType = "new_estate_update" | "limitless_realty_update" | "limitless_realty_reminder" | "direct_message";

type CampaignResult = { status: string; attempted: number; sent: number; delivered: number; pendingDelivery: number; failed: number; skipped: number; templateName?: string };

const campaignTypes: Array<{ value: CampaignType; label: string; description: string; template?: string }> = [
  { value: "new_estate_update", label: "Estate update", template: "estate_brief_update", description: "New properties, estate launches and price updates." },
  { value: "limitless_realty_update", label: "Market update", template: "limitless_realty_update_v2", description: "General real-estate campaigns and market information." },
  { value: "limitless_realty_reminder", label: "Reminder", template: "limitless_realty_reminder", description: "Maia follow-ups for clients who showed property interest." },
  { value: "direct_message", label: "Direct message", description: "Send your exact message to contacts inside the 24-hour WhatsApp window. No template and no Maia rewriting." },
];

function text(value: unknown) { return String(value || "").trim().toLowerCase(); }
function money(value: unknown) { const parsed = Number(String(value || "").replace(/[^\d.]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function eligible(lead: ProgressiveLead) { const status = text(lead.status); return Boolean(lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status)); }

export default function WhatsAppCampaignCenterV2({ leads, properties, groups }: Props) {
  const params = useSearchParams();
  const requestedGroup = params.get("group") || "";
  const requestedLead = params.get("lead") || "";
  const initialLead = requestedLead ? leads.find((lead) => lead.id === requestedLead || lead.phone === requestedLead) : undefined;
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(requestedGroup ? "group" : initialLead ? "manual" : "all");
  const [campaignType, setCampaignType] = useState<CampaignType>("limitless_realty_update");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>(initialLead ? [String(initialLead.id)] : []);
  const [groupId, setGroupId] = useState(requestedGroup);
  const [state, setState] = useState(""); const [interest, setInterest] = useState(""); const [propertyId, setPropertyId] = useState(""); const [budgetMin, setBudgetMin] = useState(""); const [budgetMax, setBudgetMax] = useState("");
  const [topic, setTopic] = useState(""); const [message, setMessage] = useState(""); const [mediaUrl, setMediaUrl] = useState("");
  const [result, setResult] = useState<CampaignResult | null>(null); const [error, setError] = useState(""); const [isPending, startTransition] = useTransition(); const sending = useRef(false);

  const selectedGroup = groups.find((group) => group.id === groupId); const selectedProperty = properties.find((property) => property.id === propertyId); const selectedType = campaignTypes.find((item) => item.value === campaignType) || campaignTypes[1];
  const audience = useMemo(() => {
    const selected = new Set(selectedLeadIds); const groupLeadIds = new Set(selectedGroup?.leadIds || []); const stateNeedle = text(state); const interestNeedle = text(interest); const propertyNeedle = text(selectedProperty?.title || ""); const min = money(budgetMin); const max = money(budgetMax);
    return leads.filter((lead) => {
      if (!eligible(lead)) return false;
      if (audienceMode === "manual") return selected.has(String(lead.id));
      if (audienceMode === "group") return selectedGroup ? selectedGroup.groupType === "smart" ? matchesCampaignGroupRules(lead, selectedGroup.rules) : groupLeadIds.has(String(lead.id)) : false;
      if (audienceMode === "filters") {
        if (stateNeedle && !text(lead.location_preference).includes(stateNeedle)) return false;
        if (interestNeedle && ![lead.purpose, lead.property_type, lead.property_interest].map(text).join(" ").includes(interestNeedle)) return false;
        if (propertyNeedle && ![lead.property_interest, lead.property_type, lead.purpose].map(text).join(" ").includes(propertyNeedle)) return false;
        const budget = money(lead.budget); if (min && (!budget || budget < min)) return false; if (max && (!budget || budget > max)) return false;
      }
      return true;
    });
  }, [audienceMode, budgetMax, budgetMin, interest, leads, selectedGroup, selectedLeadIds, selectedProperty, state]);
  const recipientCount = audience.length + (audienceMode === "group" && selectedGroup?.groupType === "manual" ? selectedGroup.phones.length : 0);

  const sendCampaign = () => {
    if (sending.current || isPending) return; sending.current = true; setError(""); setResult(null); const requestId = crypto.randomUUID();
    startTransition(async () => {
      try {
        const response = await fetch("/api/limitless/campaigns/send", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestId }, body: JSON.stringify({ requestId, campaignType, topic, message, mediaUrl, audienceMode, selectedLeadIds, campaignGroupId: groupId, state, interest, propertyId, budgetMin, budgetMax }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Campaign failed.");
        setResult({ status: data.status, attempted: data.attempted || 0, sent: data.sent || 0, delivered: data.delivered || 0, pendingDelivery: data.pendingDelivery || 0, failed: data.failed || 0, skipped: data.skipped || 0, templateName: data.templateName });
      } catch (caught) { setError(caught instanceof Error ? caught.message : "Campaign failed."); } finally { sending.current = false; }
    });
  };

  return <section className="campaign-v2">
    <div className="campaign-v2-grid">
      <section className="campaign-card">
        <header><span>AUDIENCE</span><h2>Select recipients</h2><strong>{recipientCount}</strong></header>
        <div className="audience-tabs">{(["all", "manual", "group", "filters"] as AudienceMode[]).map((mode) => <button key={mode} type="button" className={audienceMode === mode ? "active" : ""} onClick={() => setAudienceMode(mode)}>{mode === "all" ? "All leads" : mode === "manual" ? "Manual" : mode === "group" ? "Saved group" : "Smart filters"}</button>)}</div>
        {audienceMode === "group" && <label>Saved group<select value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">Choose group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
        {audienceMode === "filters" && <div className="filters"><label>Location<input value={state} onChange={(e) => setState(e.target.value)} placeholder="Any" /></label><label>Interest<input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="Any" /></label><label>Property<select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">Any property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label><label>Min budget<input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} /></label><label>Max budget<input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} /></label></div>}
        {audienceMode === "manual" && <div className="lead-list">{leads.filter(eligible).slice(0, 300).map((lead) => <label key={lead.id}><input type="checkbox" checked={selectedLeadIds.includes(String(lead.id))} onChange={() => setSelectedLeadIds((current) => current.includes(String(lead.id)) ? current.filter((id) => id !== String(lead.id)) : [...current, String(lead.id)])} /><span>{lead.name}<small>{lead.phone}</small></span></label>)}</div>}
        <p className="audience-note">Only campaign-eligible contacts are included. Meta cooldown and delivery eligibility are checked again before sending.</p>
      </section>

      <section className="campaign-card composer">
        <header><span>MESSAGE ENGINE</span><h2>Compose campaign</h2></header>
        <div className="campaign-type-grid">{campaignTypes.map((type) => <button key={type.value} type="button" className={campaignType === type.value ? "active" : ""} onClick={() => setCampaignType(type.value)}><strong>{type.label}</strong><span>{type.description}</span>{type.template && <small>{type.template}</small>}</button>)}</div>
        {campaignType === "direct_message" && <div className="direct-notice"><strong>Direct message mode</strong><span>This sends your message exactly as written. It is only valid inside the recipient's 24-hour WhatsApp customer-service window. Outside that window, use Estate update, Market update or Reminder.</span></div>}
        <div className="form-grid"><label>Campaign title<input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Campaign title" /></label><label>Featured property<select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">No linked property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label><label className="wide">Message<textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={campaignType === "direct_message" ? "Write the exact WhatsApp message. Maia will not rewrite it." : "Write the campaign message Maia should deliver using the selected campaign route."} /></label><label className="wide">Image URL (optional)<input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder={selectedProperty?.drive_photos_link || "https://..."} /></label></div>
        <div className="sendbar"><div><strong>{recipientCount} READY</strong><small>{selectedType.template || "DIRECT MESSAGE · 24H WINDOW ONLY"}</small></div><button type="button" disabled={isPending || !message.trim() || recipientCount === 0 || (audienceMode === "group" && !groupId)} onClick={sendCampaign}>{isPending ? "TRANSMITTING..." : "SEND CAMPAIGN"}</button></div>
        {result && <div className="result"><strong>{result.status.replaceAll("_", " ")}</strong><span>{result.sent} sent · {result.delivered} delivered · {result.failed} failed · {result.skipped} skipped</span>{result.templateName && <small>Template: {result.templateName}</small>}</div>}
        {error && <div className="error">{error}</div>}
      </section>
    </div>
    <style jsx>{`
      .campaign-v2{width:100%;min-width:0}.campaign-v2-grid{display:grid;grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr);gap:18px}.campaign-card{min-width:0;border:1px solid rgba(255,255,255,.08);border-radius:22px;background:rgba(16,12,30,.82);padding:22px;color:#fff;overflow:hidden}.campaign-card header{position:relative;margin-bottom:18px}.campaign-card header span{font-size:10px;letter-spacing:.16em;color:#a99bc7}.campaign-card header h2{margin:5px 0 0;font-size:22px}.campaign-card header>strong{position:absolute;right:0;top:0;font-size:28px}.audience-tabs,.campaign-type-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.audience-tabs button,.campaign-type-grid button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:#bfb6d2;border-radius:12px;padding:12px;text-align:left;cursor:pointer}.audience-tabs button.active,.campaign-type-grid button.active{border-color:#8b5cf6;background:rgba(139,92,246,.14);color:#fff}.campaign-type-grid button strong,.campaign-type-grid button span,.campaign-type-grid button small{display:block}.campaign-type-grid button span{font-size:11px;line-height:1.4;margin-top:5px;color:#9d94af}.campaign-type-grid button small{margin-top:8px;font-size:9px;color:#8b5cf6}.campaign-card label{display:block;margin-top:14px;font-size:11px;color:#a99fb8}.campaign-card input,.campaign-card select,.campaign-card textarea{display:block;width:100%;box-sizing:border-box;margin-top:7px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:#0c0916;color:#fff;padding:11px;outline:none}.filters,.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.wide{grid-column:1/-1}.lead-list{margin-top:14px;max-height:320px;overflow:auto}.lead-list label{display:flex;gap:10px;align-items:center;padding:9px;border-bottom:1px solid rgba(255,255,255,.05)}.lead-list label span{color:#fff}.lead-list small{display:block;color:#857d92;margin-top:3px}.audience-note{font-size:11px;line-height:1.5;color:#7f768e;margin-top:16px}.direct-notice{margin:14px 0;padding:13px;border:1px solid rgba(139,92,246,.35);border-radius:12px;background:rgba(139,92,246,.08)}.direct-notice strong,.direct-notice span{display:block}.direct-notice span{font-size:11px;line-height:1.5;color:#bdb3ca;margin-top:4px}.sendbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07)}.sendbar strong,.sendbar small{display:block}.sendbar small{color:#81778e;font-size:10px;margin-top:4px}.sendbar button{border:0;border-radius:12px;padding:13px 18px;background:#8b5cf6;color:#fff;font-weight:700;cursor:pointer}.sendbar button:disabled{opacity:.45;cursor:not-allowed}.result,.error{margin-top:14px;padding:13px;border-radius:12px;font-size:12px}.result{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.18)}.result>*{display:block;margin-top:3px}.error{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#ffb2b2}@media(max-width:900px){.campaign-v2-grid{grid-template-columns:1fr}.campaign-type-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.campaign-card{padding:16px;border-radius:17px}.audience-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.campaign-type-grid,.filters,.form-grid{grid-template-columns:1fr}.sendbar{align-items:stretch;flex-direction:column}.sendbar button{width:100%}.wide{grid-column:auto}}
    `}</style>
  </section>;
}
