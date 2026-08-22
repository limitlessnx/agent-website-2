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

const CHANNEL_URL = "https://whatsapp.com/channel/0029Vas58FFInlqLq2KyeI2F";
const CHANNEL_INVITE = "Reply YES if you'd like to join our Limitless Realty WhatsApp Channel for property deals, new estate launches and real estate updates near you.";
const campaignTypes: Array<{ value: CampaignType; label: string; description: string; template?: string }> = [
  { value: "new_estate_update", label: "Estate update", template: "estate_brief_update", description: "New properties, estate launches and price updates." },
  { value: "limitless_realty_update", label: "Market update", template: "limitless_realty_update_v2", description: "General real-estate campaigns, news and property updates." },
  { value: "limitless_realty_reminder", label: "Reminder", template: "limitless_realty_reminder", description: "Maia follow-ups for clients who showed property interest." },
  { value: "direct_message", label: "Direct message", description: "Send your exact message inside the 24-hour WhatsApp window." },
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
  const [state, setState] = useState("");
  const [interest, setInterest] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [mainUpdate, setMainUpdate] = useState("");
  const [supportingUpdate, setSupportingUpdate] = useState("");
  const [responsePrompt, setResponsePrompt] = useState("Reply MORE INFO if you'd like more information about this update.");
  const [mediaUrl, setMediaUrl] = useState("");
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const sending = useRef(false);

  const selectedGroup = groups.find((group) => group.id === groupId);
  const selectedProperty = properties.find((property) => property.id === propertyId);
  const selectedType = campaignTypes.find((item) => item.value === campaignType) || campaignTypes[1];
  const isUpdateTemplate = campaignType === "limitless_realty_update";

  const audience = useMemo(() => {
    const selected = new Set(selectedLeadIds);
    const groupLeadIds = new Set(selectedGroup?.leadIds || []);
    const stateNeedle = text(state);
    const interestNeedle = text(interest);
    const propertyNeedle = text(selectedProperty?.title || "");
    const min = money(budgetMin);
    const max = money(budgetMax);
    return leads.filter((lead) => {
      if (!eligible(lead)) return false;
      if (audienceMode === "manual") return selected.has(String(lead.id));
      if (audienceMode === "group") return selectedGroup ? selectedGroup.groupType === "smart" ? matchesCampaignGroupRules(lead, selectedGroup.rules) : groupLeadIds.has(String(lead.id)) : false;
      if (audienceMode === "filters") {
        if (stateNeedle && !text(lead.location_preference).includes(stateNeedle)) return false;
        if (interestNeedle && ![lead.purpose, lead.property_type, lead.property_interest].map(text).join(" ").includes(interestNeedle)) return false;
        if (propertyNeedle && ![lead.property_interest, lead.property_type, lead.purpose].map(text).join(" ").includes(propertyNeedle)) return false;
        const budget = money(lead.budget);
        if (min && (!budget || budget < min)) return false;
        if (max && (!budget || budget > max)) return false;
      }
      return true;
    });
  }, [audienceMode, budgetMax, budgetMin, interest, leads, selectedGroup, selectedLeadIds, selectedProperty, state]);

  const recipientCount = audience.length + (audienceMode === "group" && selectedGroup?.groupType === "manual" ? selectedGroup.phones.length : 0);
  const composedUpdate = [mainUpdate.trim(), supportingUpdate.trim(), responsePrompt.trim()].filter(Boolean).join("\n\n");
  const canSend = Boolean(recipientCount && (isUpdateTemplate ? mainUpdate.trim() && supportingUpdate.trim() && responsePrompt.trim() : message.trim()) && !(audienceMode === "group" && !groupId));

  const sendCampaign = () => {
    if (sending.current || isPending || !canSend) return;
    sending.current = true;
    setError("");
    setResult(null);
    const requestId = crypto.randomUUID();
    const outboundMessage = isUpdateTemplate ? composedUpdate : message.trim();
    startTransition(async () => {
      try {
        const endpoint = campaignType === "direct_message" ? "/api/limitless/campaigns/direct" : "/api/limitless/campaigns/send";
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
          body: JSON.stringify({ requestId, campaignType, topic, message: outboundMessage, mediaUrl, audienceMode, selectedLeadIds, campaignGroupId: groupId, state, interest, propertyId, budgetMin, budgetMax }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Campaign failed.");
        setResult({ status: data.status, attempted: data.attempted || 0, sent: data.sent || 0, delivered: data.delivered || 0, pendingDelivery: data.pendingDelivery || 0, failed: data.failed || 0, skipped: data.skipped || 0, templateName: data.templateName });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Campaign failed.");
      } finally {
        sending.current = false;
      }
    });
  };

  return (
    <section className="campaign-v2">
      <div className="campaign-v2-grid">
        <section className="campaign-card">
          <header><span>AUDIENCE</span><h2>Select recipients</h2><strong>{recipientCount}</strong></header>
          <div className="audience-tabs">
            {(["all", "manual", "group", "filters"] as AudienceMode[]).map((mode) => <button key={mode} type="button" className={audienceMode === mode ? "active" : ""} onClick={() => setAudienceMode(mode)}>{mode === "all" ? "All leads" : mode === "manual" ? "Manual" : mode === "group" ? "Saved group" : "Smart filters"}</button>)}
          </div>
          {audienceMode === "group" && <label>Saved group<select value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">Choose group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
          {audienceMode === "filters" && <div className="filters"><label>Location<input value={state} onChange={(e) => setState(e.target.value)} placeholder="Any" /></label><label>Interest<input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="Any" /></label><label>Property<select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">Any property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label><label>Min budget<input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} /></label><label>Max budget<input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} /></label></div>}
          {audienceMode === "manual" && <div className="lead-list">{leads.filter(eligible).slice(0, 300).map((lead) => <label key={lead.id}><input type="checkbox" checked={selectedLeadIds.includes(String(lead.id))} onChange={() => setSelectedLeadIds((current) => current.includes(String(lead.id)) ? current.filter((id) => id !== String(lead.id)) : [...current, String(lead.id)])} /><span>{lead.name}<small>{lead.phone}</small></span></label>)}</div>}
          <p className="audience-note">Only campaign-eligible contacts are included. WhatsApp cooldown and delivery eligibility are checked again before sending.</p>
        </section>

        <section className="campaign-card composer">
          <header><span>MESSAGE ENGINE</span><h2>Compose campaign</h2><small className="engine-note">Approved template routing · Maia delivery engine</small></header>
          <div className="campaign-type-grid">{campaignTypes.map((type) => <button key={type.value} type="button" className={campaignType === type.value ? "active" : ""} onClick={() => setCampaignType(type.value)}><strong>{type.label}</strong><span>{type.description}</span>{type.template && <small>{type.template}</small>}</button>)}</div>

          {isUpdateTemplate ? (
            <>
              <div className="template-contract">
                <div><strong>Limitless Realty Update v2</strong><span>Four body variables. No URL CTA. The WhatsApp Channel invitation is already part of the approved template.</span></div>
                <div className="variable-row"><b>{{1}}</b><span>Customer first name</span></div>
                <div className="variable-row"><b>{{2}}</b><span>Main campaign update</span></div>
                <div className="variable-row"><b>{{3}}</b><span>Supporting paragraph</span></div>
                <div className="variable-row"><b>{{4}}</b><span>Context-specific response prompt</span></div>
              </div>
              <div className="form-grid">
                <label>Campaign title<input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Campaign title" /></label>
                <label>Featured property<select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">No linked property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
                <label className="wide">Main update · {{2}}<textarea rows={5} value={mainUpdate} onChange={(e) => setMainUpdate(e.target.value)} placeholder="The main announcement, property update, market news or campaign message." /></label>
                <label className="wide">Supporting paragraph · {{3}}<textarea rows={4} value={supportingUpdate} onChange={(e) => setSupportingUpdate(e.target.value)} placeholder="Additional context, details, benefits or explanation." /></label>
                <label className="wide">Response prompt · {{4}}<textarea rows={3} value={responsePrompt} onChange={(e) => setResponsePrompt(e.target.value)} placeholder="Example: Reply MORE INFO if you'd like more information about this update." /></label>
                <label className="wide">Campaign image URL · optional<input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder={selectedProperty?.drive_photos_link || "https://..."} /></label>
              </div>
              <div className="channel-contract"><div><strong>Permanent channel invitation</strong><span>{CHANNEL_INVITE}</span></div><small>Channel URL is handled by Maia when the client replies YES. It is not sent as a template button.</small><code>{CHANNEL_URL}</code></div>
              <div className="message-preview"><span>PREVIEW</span><p>Hello Grace,</p><p>We have an update from Limitless Realty:</p><p>{mainUpdate || "Main campaign update"}</p><p>{supportingUpdate || "Supporting paragraph"}</p><p>{responsePrompt || "Reply MORE INFO if you'd like more information about this update."}</p><p>{CHANNEL_INVITE}</p><p>Maia, Limitless Realty</p></div>
            </>
          ) : (
            <>
              {campaignType === "direct_message" && <div className="direct-notice"><strong>Direct message mode</strong><span>This sends your message exactly as written. It is only valid inside the recipient's 24-hour WhatsApp customer-service window.</span></div>}
              <div className="form-grid"><label>Campaign title<input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Campaign title" /></label><label>Featured property<select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">No linked property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label><label className="wide">Message<textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={campaignType === "direct_message" ? "Write the exact WhatsApp message. Maia will not rewrite it." : "Write the campaign message Maia should deliver using the selected campaign route."} /></label><label className="wide">Image URL (optional)<input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder={selectedProperty?.drive_photos_link || "https://..."} /></label></div>
            </>
          )}

          <div className="sendbar"><div><strong>{recipientCount} READY</strong><small>{selectedType.template || "DIRECT MESSAGE · 24H WINDOW ONLY"}</small></div><button type="button" disabled={isPending || !canSend} onClick={sendCampaign}>{isPending ? "TRANSMITTING..." : "SEND CAMPAIGN"}</button></div>
          {result && <div className="result"><strong>{result.status.replaceAll("_", " ")}</strong><span>{result.sent} sent · {result.delivered} delivered · {result.pendingDelivery} pending · {result.failed} failed · {result.skipped} skipped</span>{result.templateName && <small>Template: {result.templateName}</small>}</div>}
          {error && <div className="error">{error}</div>}
        </section>
      </div>
      <style jsx>{`
        .campaign-v2{width:100%;min-width:0}.campaign-v2-grid{display:grid;grid-template-columns:minmax(0,.78fr) minmax(0,1.22fr);gap:18px}.campaign-card{min-width:0;border:1px solid rgba(255,255,255,.08);border-radius:22px;background:rgba(16,12,30,.82);padding:22px;color:#fff;overflow:hidden}.campaign-card header{position:relative;margin-bottom:18px}.campaign-card header span{font-size:10px;letter-spacing:.16em;color:#a99bc7}.campaign-card header h2{margin:5px 0 0;font-size:22px}.campaign-card header>strong{position:absolute;right:0;top:0;font-size:28px}.engine-note{display:block;color:#81778e;font-size:10px;margin-top:6px}.audience-tabs,.campaign-type-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.audience-tabs button,.campaign-type-grid button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:#bfb6d2;border-radius:12px;padding:12px;text-align:left;cursor:pointer}.audience-tabs button.active,.campaign-type-grid button.active{border-color:#8b5cf6;background:rgba(139,92,246,.14);color:#fff}.campaign-type-grid button strong,.campaign-type-grid button span,.campaign-type-grid button small{display:block}.campaign-type-grid button span{font-size:11px;line-height:1.4;margin-top:5px;color:#9d94af}.campaign-type-grid button small{margin-top:8px;font-size:9px;color:#8b5cf6}.campaign-card label{display:block;margin-top:14px;font-size:11px;color:#a99fb8}.campaign-card input,.campaign-card select,.campaign-card textarea{display:block;width:100%;box-sizing:border-box;margin-top:7px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:#0c0916;color:#fff;padding:11px;outline:none}.filters,.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.wide{grid-column:1/-1}.lead-list{margin-top:14px;max-height:320px;overflow:auto}.lead-list label{display:flex;gap:10px;align-items:center;padding:9px;border-bottom:1px solid rgba(255,255,255,.05)}.lead-list label span{color:#fff}.lead-list small{display:block;color:#857d92;margin-top:3px}.audience-note{font-size:11px;line-height:1.5;color:#7f768e;margin-top:16px}.direct-notice,.template-contract,.channel-contract,.message-preview{margin:14px 0;padding:14px;border:1px solid rgba(139,92,246,.28);border-radius:14px;background:rgba(139,92,246,.07)}.direct-notice strong,.direct-notice span,.template-contract>div,.channel-contract>div{display:block}.direct-notice span,.template-contract span,.channel-contract span,.channel-contract small{font-size:11px;line-height:1.5;color:#bdb3ca;margin-top:4px}.variable-row{display:flex!important;align-items:center;gap:10px;margin-top:9px!important}.variable-row b{min-width:34px;color:#b08cff}.channel-contract code{display:block;margin-top:9px;color:#a98df3;font-size:10px;overflow-wrap:anywhere}.message-preview{background:rgba(255,255,255,.025);border-color:rgba(255,255,255,.08)}.message-preview>span{font-size:9px;letter-spacing:.15em;color:#8b5cf6}.message-preview p{margin:8px 0;color:#eee;line-height:1.45}.message-preview p:nth-last-child(1){color:#a99fb8}.sendbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07)}.sendbar strong,.sendbar small{display:block}.sendbar small{color:#81778e;font-size:10px;margin-top:4px}.sendbar button{border:0;border-radius:12px;padding:13px 18px;background:#8b5cf6;color:#fff;font-weight:700;cursor:pointer}.sendbar button:disabled{opacity:.45;cursor:not-allowed}.result,.error{margin-top:14px;padding:13px;border-radius:12px;font-size:12px}.result{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.18)}.result>*{display:block;margin-top:3px}.error{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#ffb2b2}@media(max-width:900px){.campaign-v2-grid{grid-template-columns:1fr}.campaign-type-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.campaign-card{padding:16px;border-radius:17px}.audience-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.campaign-type-grid,.filters,.form-grid{grid-template-columns:1fr}.sendbar{align-items:stretch;flex-direction:column}.sendbar button{width:100%}.wide{grid-column:auto}}
      `}</style>
    </section>
  );
}
