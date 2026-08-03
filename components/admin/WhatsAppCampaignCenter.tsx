"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import type { CampaignGroup } from "@/lib/campaign-groups";
import type { ProgressiveLead } from "@/lib/lead-profile-service";
import type { PropertyRecord } from "@/lib/limitless-data";

type Props = { leads: ProgressiveLead[]; properties: PropertyRecord[]; groups: CampaignGroup[] };
type AudienceMode = "all" | "manual" | "group" | "filters";
type CampaignType = "new_estate_update" | "limitless_realty_update" | "limitless_realty_reminder";
type CampaignResult = {
  status: string;
  attempted: number;
  sent: number;
  delivered: number;
  pendingDelivery: number;
  failed: number;
  skipped: number;
  campaignType?: string;
  templateName?: string;
  cooldownSkipped?: number;
  duplicatePrevented?: boolean;
};

const campaignTypes: Array<{
  value: CampaignType;
  label: string;
  templateName: string;
  description: string;
}> = [
  {
    value: "new_estate_update",
    label: "New Estate Update Campaign",
    templateName: "estate_brief_update",
    description: "Use only for a new estate or property launch/update.",
  },
  {
    value: "limitless_realty_update",
    label: "Limitless Realty Update",
    templateName: "limitless_realty_update_v2",
    description: "Use for normal broadcasts, price updates, promos, and market updates.",
  },
  {
    value: "limitless_realty_reminder",
    label: "Limitless Realty Reminder",
    templateName: "limitless_realty_reminder",
    description: "Use for reminder updates and follow-up style messages.",
  },
];

function text(value: unknown) { return String(value || "").trim().toLowerCase(); }
function money(value: unknown) {
  const parsed = Number(String(value || "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function eligible(lead: ProgressiveLead) {
  const status = text(lead.status);
  return Boolean(lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status));
}

export default function WhatsAppCampaignCenter({ leads, properties, groups }: Props) {
  const searchParams = useSearchParams();
  const requestedGroupId = searchParams.get("group") || "";
  const requestedLead = searchParams.get("lead") || "";
  const initialGroupId = groups.some((group) => group.id === requestedGroupId) ? requestedGroupId : "";
  const initialLead = requestedLead ? leads.find((item) => item.phone === requestedLead || item.id === requestedLead) : undefined;
  const [audienceMode, setAudienceMode] = useState<AudienceMode>(initialGroupId ? "group" : initialLead ? "manual" : "all");
  const [campaignType, setCampaignType] = useState<CampaignType>("limitless_realty_update");
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>(initialLead ? [String(initialLead.id)] : []);
  const [campaignGroupId, setCampaignGroupId] = useState(initialGroupId);
  const [state, setState] = useState("");
  const [interest, setInterest] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const sendingRef = useRef(false);

  const states = useMemo(() => [...new Set(leads.map((lead) => lead.location_preference).filter(Boolean) as string[])].sort(), [leads]);
  const interests = useMemo(() => [...new Set(leads.flatMap((lead) => [lead.purpose, lead.property_type, lead.property_interest]).filter(Boolean) as string[])].sort(), [leads]);
  const selectedProperty = properties.find((property) => property.id === propertyId);
  const selectedCampaignType = campaignTypes.find((type) => type.value === campaignType) || campaignTypes[1];
  const selectedGroup = groups.find((group) => group.id === campaignGroupId);

  const audience = useMemo(() => {
    const selected = new Set(selectedLeadIds);
    const groupLeadIds = new Set(selectedGroup?.leadIds || []);
    const stateNeedle = text(state);
    const interestNeedle = text(interest);
    const propertyNeedle = text(selectedProperty?.title || "");
    const minimum = money(budgetMin);
    const maximum = money(budgetMax);
    return leads.filter((lead) => {
      if (!eligible(lead)) return false;
      if (audienceMode === "all") return true;
      if (audienceMode === "manual") return selected.has(String(lead.id));
      if (audienceMode === "group") return groupLeadIds.has(String(lead.id));
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
  }, [audienceMode, budgetMax, budgetMin, interest, leads, selectedLeadIds, selectedGroup, selectedProperty, state]);

  const groupExtraCount = audienceMode === "group" ? selectedGroup?.phones.length || 0 : 0;
  const recipientCount = audience.length + groupExtraCount;

  const toggleLead = (id: string) => setSelectedLeadIds((current) => current.includes(id) ? current.filter((leadId) => leadId !== id) : [...current, id]);

  const sendCampaign = () => {
    if (sendingRef.current || isPending) return;
    sendingRef.current = true;
    setResult(null);
    setError("");
    const requestId = crypto.randomUUID();

    startTransition(async () => {
      try {
        const response = await fetch("/api/limitless/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
          body: JSON.stringify({
            requestId,
            campaignType,
            topic,
            message,
            mediaUrl,
            audienceMode,
            selectedLeadIds,
            campaignGroupId,
            state,
            interest,
            propertyId,
            budgetMin,
            budgetMax,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Campaign failed.");
        setResult({
          status: data.status,
          attempted: data.attempted || 0,
          sent: data.sent || 0,
          delivered: data.delivered || 0,
          pendingDelivery: data.pendingDelivery || 0,
          failed: data.failed || 0,
          skipped: data.skipped || 0,
          cooldownSkipped: data.cooldownSkipped || 0,
          campaignType: data.campaignType,
          templateName: data.templateName,
          duplicatePrevented: data.duplicatePrevented,
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Campaign failed.");
      } finally {
        sendingRef.current = false;
      }
    });
  };

  return (
    <div className="campaign-center">
      <section className="campaign-panel">
        <div className="campaign-heading"><div><span>Audience</span><h2>Choose who receives this campaign</h2></div><strong>{recipientCount} recipients</strong></div>
        <div className="audience-tabs">
          {(["all", "manual", "group", "filters"] as AudienceMode[]).map((mode) => <button key={mode} type="button" className={audienceMode === mode ? "active" : ""} onClick={() => setAudienceMode(mode)}>{mode === "all" ? "All leads" : mode === "manual" ? "Manual selection" : mode === "group" ? "Saved group" : "Smart filters"}</button>)}
        </div>
        {audienceMode === "group" ? <div className="filter-grid">
          <label className="wide"><span>Saved campaign group</span><select value={campaignGroupId} onChange={(event) => setCampaignGroupId(event.target.value)}><option value="">Choose saved group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.leadIds.length + group.phones.length})</option>)}</select></label>
          {selectedGroup ? <p className="group-note">This group contains {selectedGroup.leadIds.length} saved lead(s) and {selectedGroup.phones.length} extra number(s).</p> : null}
        </div> : null}
        {audienceMode === "filters" ? <div className="filter-grid">
          <label><span>State or location</span><input list="campaign-states" value={state} onChange={(event) => setState(event.target.value)} placeholder="Any location" /><datalist id="campaign-states">{states.map((value) => <option key={value} value={value} />)}</datalist></label>
          <label><span>Interest</span><input list="campaign-interests" value={interest} onChange={(event) => setInterest(event.target.value)} placeholder="Any interest" /><datalist id="campaign-interests">{interests.map((value) => <option key={value} value={value} />)}</datalist></label>
          <label><span>Property</span><select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">Any property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
          <label><span>Minimum budget</span><input inputMode="numeric" value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} placeholder="N0" /></label>
          <label><span>Maximum budget</span><input inputMode="numeric" value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} placeholder="No maximum" /></label>
        </div> : null}
        {audienceMode === "manual" ? <div className="lead-picker">{leads.filter(eligible).map((lead) => <label key={lead.id} className="lead-row"><input type="checkbox" checked={selectedLeadIds.includes(String(lead.id))} onChange={() => toggleLead(String(lead.id))} /><span><strong>{lead.name}</strong><small>{lead.phone} - {lead.profile_status || "undocumented"}</small></span></label>)}</div> : null}
      </section>

      <section className="campaign-panel">
        <div className="campaign-heading"><div><span>Message</span><h2>Compose WhatsApp campaign</h2></div><strong>Maia</strong></div>
        <div className="campaign-type-grid">
          {campaignTypes.map((type) => (
            <button key={type.value} type="button" className={campaignType === type.value ? "active" : ""} onClick={() => setCampaignType(type.value)}>
              <strong>{type.label}</strong>
              <span>{type.description}</span>
              <small>{type.templateName}</small>
            </button>
          ))}
        </div>
        <div className="compose-grid">
          <label><span>Campaign title</span><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="New estate update" /></label>
          <label><span>Property to feature</span><select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">No linked property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
          <label className="wide"><span>Message</span><textarea rows={8} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write the WhatsApp message Maia should send..." /></label>
          <label className="wide"><span>Optional media URL</span><input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder={selectedProperty?.drive_photos_link || "Google Drive or public image link"} /></label>
        </div>
        <div className="campaign-submit"><div><strong>{recipientCount} eligible recipients</strong><small>Saved groups can include selected leads and extra pasted phone numbers.</small></div><button type="button" disabled={isPending || !message.trim() || recipientCount === 0 || (audienceMode === "group" && !campaignGroupId)} onClick={sendCampaign}>{isPending ? "Sending through Maia..." : "Send WhatsApp campaign"}</button></div>

        {result ? <div className={`campaign-result ${result.failed ? "warning" : "success"}`}>
          <strong>{result.status.replaceAll("_", " ")}</strong>
          <small>{selectedCampaignType.label} - {result.templateName || selectedCampaignType.templateName}</small>
          <div className="result-grid"><span>Attempted <b>{result.attempted}</b></span><span>Sent <b>{result.sent}</b></span><span>Delivered <b>{result.delivered}</b></span><span>Pending <b>{result.pendingDelivery}</b></span><span>Failed <b>{result.failed}</b></span><span>Skipped <b>{result.skipped}</b></span></div>
          {result.cooldownSkipped ? <small>{result.cooldownSkipped} skipped because WhatsApp recently blocked delivery to the contact.</small> : null}
          {result.duplicatePrevented ? <small>Duplicate send prevented.</small> : null}
        </div> : null}
        {error ? <p className="campaign-error">{error}</p> : null}
      </section>

      <style jsx>{`
        .campaign-center{display:grid;gap:22px}.campaign-panel{border:1px solid rgba(167,112,255,.24);border-radius:24px;background:linear-gradient(145deg,#11081f,#09050f);padding:24px}.campaign-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px}.campaign-heading span,label span{display:block;color:#a99cbd;font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;margin-bottom:7px}.campaign-heading h2{margin:0;color:#fff;font-size:1.35rem}.campaign-heading strong{color:#bd8cff}.audience-tabs{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px}.audience-tabs button{border:1px solid rgba(167,112,255,.24);border-radius:999px;padding:10px 15px;color:#c9bed9;background:#0d0716}.audience-tabs button.active{color:#fff;background:#7c3aed;border-color:#9f67ff}.campaign-type-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px}.campaign-type-grid button{text-align:left;border:1px solid rgba(167,112,255,.18);border-radius:15px;padding:13px;background:#08050e;color:#d8cceb}.campaign-type-grid button.active{border-color:#9f67ff;background:rgba(124,58,237,.22)}.campaign-type-grid strong,.campaign-type-grid span,.campaign-type-grid small{display:block}.campaign-type-grid strong{font-size:.9rem;color:#fff}.campaign-type-grid span{margin-top:6px;color:#9d91ad;font-size:.76rem;line-height:1.35}.campaign-type-grid small{margin-top:8px;color:#bd8cff;font-size:.68rem;overflow-wrap:anywhere}.filter-grid,.compose-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.group-note{grid-column:1/-1;color:#a99cbd;margin:0}label input,label select,label textarea{width:100%;box-sizing:border-box;border:1px solid rgba(173,137,236,.24);border-radius:13px;padding:13px 14px;background:#08050e;color:#fff;font:inherit}label textarea{resize:vertical}.wide{grid-column:1/-1}.lead-picker{max-height:360px;overflow:auto;display:grid;gap:8px;padding-right:4px}.lead-row{display:flex;align-items:center;gap:12px;border:1px solid rgba(173,137,236,.16);border-radius:13px;padding:12px;background:#0a0611}.lead-row input{width:auto}.lead-row span{margin:0;text-transform:none;letter-spacing:0}.lead-row strong,.lead-row small{display:block}.lead-row small{color:#9d91ad;margin-top:4px}.campaign-submit{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:20px}.campaign-submit strong,.campaign-submit small{display:block}.campaign-submit small{color:#9d91ad;margin-top:5px}.campaign-submit button{border:0;border-radius:14px;padding:14px 18px;font-weight:800;color:white;background:linear-gradient(135deg,#9b5cff,#6d28d9)}.campaign-submit button:disabled{opacity:.45}.campaign-result{margin-top:16px;border:1px solid rgba(173,137,236,.24);border-radius:14px;padding:14px;color:#e7dcf8}.campaign-result.success{border-color:rgba(74,222,128,.35)}.campaign-result.warning{border-color:rgba(251,191,36,.35)}.campaign-result>strong{display:block;text-transform:capitalize;margin-bottom:10px}.result-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.result-grid span{display:flex;justify-content:space-between;background:#08050e;border-radius:9px;padding:8px;color:#a99cbd}.result-grid b{color:#fff}.campaign-result small{display:block;margin-top:9px;color:#9d91ad}.campaign-error{margin:16px 0 0;color:#fca5a5}@media(max-width:820px){.campaign-type-grid{grid-template-columns:1fr}}@media(max-width:700px){.campaign-panel{padding:18px}.filter-grid,.compose-grid{grid-template-columns:1fr}.wide,.group-note{grid-column:auto}.campaign-submit,.campaign-heading{align-items:stretch;flex-direction:column}.campaign-submit button{width:100%}.result-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>
    </div>
  );
}
