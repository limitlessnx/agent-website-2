"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { matchesCampaignGroupRules, type CampaignGroup } from "@/lib/campaign-groups";
import type { ProgressiveLead } from "@/lib/lead-profile-service";
import type { PropertyRecord } from "@/lib/limitless-data";

type Props = { leads: ProgressiveLead[]; properties: PropertyRecord[]; groups: CampaignGroup[] };
type AudienceMode = "all" | "manual" | "group" | "filters";
type CampaignType = "estate_brief_update" | "new_estate_update" | "limitless_realty_update" | "limitless_realty_reminder" | "direct_message";
type CampaignResult = { status: string; attempted: number; sent: number; delivered: number; pendingDelivery: number; failed: number; skipped: number; templateName?: string };
type PendingApproval = { fingerprint: string; requestId: string; approvalId?: string; token?: string; expiresAt?: string; preview?: { attemptedRecipients: number; serviceWindowSkipped?: number; cooldownSkipped: number; messageParts: number; templateName?: string; message: string; propertyName?: string | null; recipientPreview?: Array<{ name: string; phone: string }>; moreRecipients?: number }; unresolved?: boolean };

const CHANNEL_INVITE = "Reply YES if you'd like to join our Limitless Realty WhatsApp Channel for property deals, new estate launches and real estate updates near you.";
const campaignTypes: Array<{ value: CampaignType; label: string; description: string; template?: string; unavailable?: boolean }> = [
  { value: "estate_brief_update", label: "Estate brief", template: "estate_brief_update · IN REVIEW", description: "Prepare a property campaign with the Meta image header and five approved body variables.", },
  { value: "new_estate_update", label: "Estate update", template: "estate_brief_update · NOT VERIFIED", description: "Unavailable until the approved Meta template schema is verified.", unavailable: true },
  { value: "limitless_realty_update", label: "Market update", template: "limitless_realty_update_v2", description: "General real-estate campaigns, news and property updates." },
  { value: "limitless_realty_reminder", label: "Reminder", template: "limitless_realty_reminder · NOT VERIFIED", description: "Unavailable until the approved Meta template schema is verified.", unavailable: true },
  { value: "direct_message", label: "Direct message", description: "Send your exact message inside the 24-hour WhatsApp window." },
];

function text(value: unknown) { return String(value || "").trim().toLowerCase(); }
function money(value: unknown) { const parsed = Number(String(value || "").replace(/[^\d.]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function eligible(lead: ProgressiveLead) { const status = text(lead.status); return Boolean(lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status)); }
function approvalIsUnexpired(approval: PendingApproval | null) { return Boolean(approval?.expiresAt && Number.isFinite(Date.parse(approval.expiresAt)) && Date.parse(approval.expiresAt) > Date.now() && !approval.unresolved); }

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
  const [result, setResult] = useState<CampaignResult | null>(null);
  const [error, setError] = useState("");
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [approvalClock, setApprovalClock] = useState<{ expiresAt: string; now: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const sending = useRef(false);

  useEffect(() => {
    if (!pendingApproval?.expiresAt) return;
    const approvalExpiry = pendingApproval.expiresAt;
    const expiresAt = Date.parse(approvalExpiry);
    const refresh = () => setApprovalClock({ expiresAt: approvalExpiry, now: Date.now() });
    const initialRefresh = window.setTimeout(refresh, 0);
    const expiryRefresh = Number.isFinite(expiresAt) ? window.setTimeout(refresh, Math.max(0, expiresAt - Date.now() + 1)) : undefined;
    return () => { window.clearTimeout(initialRefresh); if (expiryRefresh !== undefined) window.clearTimeout(expiryRefresh); };
  }, [pendingApproval?.expiresAt]);

  const selectedGroup = groups.find((group) => group.id === groupId);
  const selectedProperty = properties.find((property) => property.id === propertyId);
  const selectedType = campaignTypes.find((item) => item.value === campaignType) || campaignTypes[1];
  const isUpdateTemplate = campaignType === "limitless_realty_update";
  const isEstateBrief = campaignType === "estate_brief_update";

  const audience = useMemo(() => {
    const selected = new Set(selectedLeadIds);
    const groupLeadIds = new Set(selectedGroup?.leadIds || []);
    const stateNeedle = text(state);
    const interestNeedle = text(interest);
    const propertyNeedle = campaignType === "direct_message" ? "" : text(selectedProperty?.title || "");
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
  }, [audienceMode, budgetMax, budgetMin, campaignType, interest, leads, selectedGroup, selectedLeadIds, selectedProperty, state]);

  const recipientCount = audience.length + (audienceMode === "group" && selectedGroup?.groupType === "manual" ? selectedGroup.phones.length : 0);
  const composedUpdate = [mainUpdate.trim(), supportingUpdate.trim(), responsePrompt.trim()].filter(Boolean).join("\n\n");
  const outboundMessage = isUpdateTemplate ? composedUpdate : message.trim();
  const requestPayload = { campaignType, topic, message: outboundMessage, mediaUrl: "", audienceMode, selectedLeadIds, campaignGroupId: groupId, state, interest, propertyId: campaignType === "direct_message" ? "" : propertyId, budgetMin, budgetMax };
  const fingerprint = JSON.stringify(requestPayload);
  const approvalMatches = Boolean(pendingApproval && pendingApproval.fingerprint === fingerprint);
  const approvalUsable = Boolean(approvalMatches && pendingApproval?.approvalId && pendingApproval.token && approvalClock?.expiresAt === pendingApproval?.expiresAt && pendingApproval.expiresAt && Date.parse(pendingApproval.expiresAt) > (approvalClock?.now || 0) && !pendingApproval.unresolved);
  const blockedByUnknown = Boolean(pendingApproval?.unresolved && pendingApproval.fingerprint !== fingerprint);
  const canSend = Boolean(recipientCount && (isEstateBrief ? selectedProperty?.title && selectedProperty?.drive_photos_link && message.trim() : isUpdateTemplate ? mainUpdate.trim() && supportingUpdate.trim() && responsePrompt.trim() : message.trim()) && !(audienceMode === "group" && !groupId) && !blockedByUnknown);

  const sendCampaign = () => {
    if (sending.current || isPending || !canSend) return;
    sending.current = true;
    setError("");
    setResult(null);
    const approvalCurrent = approvalUsable && approvalIsUnexpired(pendingApproval);
    const requestId = approvalMatches && approvalCurrent && pendingApproval ? pendingApproval.requestId : crypto.randomUUID();
    const approvalStage = approvalCurrent ? "send" : "prepare";
    startTransition(async () => {
      try {
        const endpoint = campaignType === "direct_message" ? "/api/limitless/campaigns/direct" : "/api/limitless/campaigns/send";
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestId }, body: JSON.stringify({ ...requestPayload, requestId, approvalStage, ...(approvalStage === "send" && pendingApproval ? { approvalId: pendingApproval.approvalId, approvalToken: pendingApproval.token } : {}) }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Campaign failed.");
        if (approvalStage === "prepare") {
          if (!data.approval?.approvalId || !data.approval?.token || !data.preview) throw new Error("The server did not return a valid confirmation preview.");
          setPendingApproval({ fingerprint, requestId, approvalId: data.approval.approvalId, token: data.approval.token, expiresAt: data.approval.expiresAt, preview: data.preview });
          setError("");
          return;
        }
        setResult({ status: data.status, attempted: data.attempted || 0, sent: data.sent || 0, delivered: data.delivered || 0, pendingDelivery: data.pendingDelivery || 0, failed: data.failed || 0, skipped: data.skipped || 0, templateName: data.templateName });
        setPendingApproval(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Campaign failed.");
        if (approvalStage === "send") setPendingApproval({ fingerprint, requestId, unresolved: true });
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
          <div className="audience-tabs">{(["all", "manual", "group", "filters"] as AudienceMode[]).map((mode) => <button key={mode} type="button" className={audienceMode === mode ? "active" : ""} onClick={() => setAudienceMode(mode)}>{mode === "all" ? "All leads" : mode === "manual" ? "Manual" : mode === "group" ? "Saved group" : "Smart filters"}</button>)}</div>
          {audienceMode === "group" && <label>Saved group<select value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">Choose group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}
          {audienceMode === "filters" && <div className="filters"><label>Location<input value={state} onChange={(e) => setState(e.target.value)} placeholder="Any" /></label><label>Interest<input value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="Any" /></label>{campaignType !== "direct_message" && <label>Property<select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">Any property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>}<label>Min budget<input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} /></label><label>Max budget<input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} /></label></div>}
          {audienceMode === "manual" && <div className="lead-list">{leads.filter(eligible).slice(0, 300).map((lead) => <label key={lead.id}><input type="checkbox" checked={selectedLeadIds.includes(String(lead.id))} onChange={() => setSelectedLeadIds((current) => current.includes(String(lead.id)) ? current.filter((id) => id !== String(lead.id)) : [...current, String(lead.id)])} /><span>{lead.name}<small>{lead.phone}</small></span></label>)}</div>}
          <p className="audience-note">Only campaign-eligible contacts are included. WhatsApp cooldown and delivery eligibility are checked again before sending.</p>
        </section>

        <section className="campaign-card composer">
          <header><span>MESSAGE ENGINE</span><h2>Compose campaign</h2><small className="engine-note">Approved template routing · Maia delivery engine</small></header>
          <div className="campaign-type-grid">{campaignTypes.map((type) => <button key={type.value} type="button" disabled={type.unavailable} className={`${campaignType === type.value ? "active" : ""} ${type.unavailable ? "unavailable" : ""}`} onClick={() => { if (!type.unavailable) setCampaignType(type.value); }}><strong>{type.label}</strong><span>{type.description}</span>{type.template && <small>{type.template}</small>}</button>)}</div>

          {isEstateBrief ? (
            <>
              <div className="template-contract">
                <div><strong>Estate Brief Update · awaiting Meta approval</strong><span>Uses the selected property&apos;s direct public image as the Meta HEADER image. The route will remain unavailable to real recipients until Meta approves the template.</span></div>
                <div className="variable-row"><b>{"{{1}}"}</b><span>Customer first name</span></div>
                <div className="variable-row"><b>{"{{2}}"}</b><span>Property or estate name</span></div>
                <div className="variable-row"><b>{"{{3}}"}</b><span>Property location</span></div>
                <div className="variable-row"><b>{"{{4}}"}</b><span>Property price</span></div>
                <div className="variable-row"><b>{"{{5}}"}</b><span>Campaign-specific selling point or offer</span></div>
              </div>
              <div className="form-grid">
                <label>Campaign title<input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Estate campaign title" /></label>
                <label>Featured property<select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">Choose a property with an image</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
                <label className="wide">Selling point or offer · {"{{5}}"}<textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Example: Flexible payment options available. Secure your plot today with a convenient installment plan." /></label>
              </div>
              <div className="message-preview"><span>PREVIEW</span><p>Hello Greatness, 👋</p><p>🏡 {selectedProperty?.title || "Property name"}</p><p>📍 Location: {[selectedProperty?.location_area, selectedProperty?.location_city].filter(Boolean).join(", ") || "Property location"}</p><p>💰 Price: {selectedProperty?.price || "Property price"}</p><p>{message || "Campaign-specific selling point or offer"}</p><p>Whether you’re looking to secure land, grow your real estate portfolio, or find your next home, Limitless Realty is here to guide you.</p><p>Looking for something different?</p><p>Let’s find the right property for you. 🏡</p></div>
            </>
          ) : isUpdateTemplate ? (
            <>
              <div className="template-contract">
                <div><strong>Limitless Realty Update v2</strong><span>Four body variables. No URL CTA or media attachment. The WhatsApp Channel invitation is already part of the approved template. The Channel URL is only sent by Maia after a client replies YES.</span></div>
                <div className="variable-row"><b>{"{{1}}"}</b><span>Customer first name</span></div>
                <div className="variable-row"><b>{"{{2}}"}</b><span>Main campaign update</span></div>
                <div className="variable-row"><b>{"{{3}}"}</b><span>Supporting paragraph</span></div>
                <div className="variable-row"><b>{"{{4}}"}</b><span>Context-specific response prompt</span></div>
              </div>
              <div className="form-grid">
                <label>Campaign title<input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Campaign title" /></label>
                <label>Featured property<select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">No linked property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
                <label className="wide">Main update · {"{{2}}"}<textarea rows={5} value={mainUpdate} onChange={(e) => setMainUpdate(e.target.value)} placeholder="The main announcement, property update, market news or campaign message." /></label>
                <label className="wide">Supporting paragraph · {"{{3}}"}<textarea rows={4} value={supportingUpdate} onChange={(e) => setSupportingUpdate(e.target.value)} placeholder="Additional context, details, benefits or explanation." /></label>
                <label className="wide">Response prompt · {"{{4}}"}<textarea rows={3} value={responsePrompt} onChange={(e) => setResponsePrompt(e.target.value)} placeholder="Example: Reply MORE INFO if you'd like more information about this update." /></label>
              </div>
              <div className="message-preview"><span>PREVIEW</span><p>Hello Grace,</p><p>We have an update from Limitless Realty:</p><p>{mainUpdate || "Main campaign update"}</p><p>{supportingUpdate || "Supporting paragraph"}</p><p>{responsePrompt || "Reply MORE INFO if you'd like more information about this update."}</p><p>{CHANNEL_INVITE}</p><p>Maia, Limitless Realty</p></div>
            </>
          ) : (
            <>
              {campaignType === "direct_message" && <div className="direct-notice"><strong>Direct message mode</strong><span>This sends your message exactly as written. It is only valid inside the recipient&apos;s 24-hour WhatsApp customer-service window.</span></div>}
              <div className="form-grid"><label>Campaign title<input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Campaign title" /></label>{campaignType !== "direct_message" && <label>Featured property<select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">No linked property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>}<label className="wide">Message<textarea rows={8} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={campaignType === "direct_message" ? "Write the exact WhatsApp message. Maia will not rewrite it." : "Write the campaign message Maia should deliver using the selected campaign route."} /></label><p className="wide audience-note">{isEstateBrief ? "The selected property image will be sent as the Meta template header after approval." : "Media attachments are not enabled by the verified provider template; use text-only copy."}</p></div>
            </>
          )}

          <div className="sendbar"><div><strong>{recipientCount} SELECTED</strong><small>{selectedType.template || "DIRECT MESSAGE · SERVER-VERIFIED 24H WINDOW"}</small></div><button type="button" disabled={isPending || !canSend} onClick={sendCampaign}>{isPending ? "CHECKING / SENDING..." : approvalUsable ? `CONFIRM & SEND TO ${pendingApproval?.preview?.attemptedRecipients || 0}` : "PREVIEW & PREPARE"}</button></div>
          {approvalUsable && pendingApproval?.preview && <div className="result"><strong>Review before sending {pendingApproval.preview.propertyName ? `· ${pendingApproval.preview.propertyName}` : ""}</strong><span>{pendingApproval.preview.attemptedRecipients} server-eligible recipients · {pendingApproval.preview.cooldownSkipped} provider cooldown skips · {pendingApproval.preview.messageParts} message part(s)</span>{pendingApproval.preview.serviceWindowSkipped !== undefined && <span>{pendingApproval.preview.serviceWindowSkipped} contacts excluded: no verified inbound message inside 24 hours.</span>}<pre>{pendingApproval.preview.message}</pre>{pendingApproval.preview.recipientPreview?.map((recipient, index) => <small key={`${recipient.phone}-${index}`}>{recipient.name} · {recipient.phone}</small>)}{!!pendingApproval.preview.moreRecipients && <small>+{pendingApproval.preview.moreRecipients} more recipients</small>}<small>Approval expires {new Date(pendingApproval.expiresAt!).toLocaleTimeString()} · changing the audience or message cancels this approval.</small></div>}
          {blockedByUnknown && <div className="error">A previous send has an uncertain provider result. Reconcile it in Operations before preparing a changed campaign; the server will not automatically resend it.</div>}
          {result && <div className="result"><strong>{result.status.replaceAll("_", " ")}</strong><span>{result.sent} sent · {result.delivered} delivered · {result.pendingDelivery} pending · {result.failed} failed · {result.skipped} skipped</span>{result.templateName && <small>Template: {result.templateName}</small>}</div>}
          {error && <div className="error">{error}</div>}
        </section>
      </div>
      <style jsx>{`
        .campaign-v2{width:100%;min-width:0}.campaign-v2-grid{display:grid;grid-template-columns:minmax(0,.78fr) minmax(0,1.22fr);gap:18px}.campaign-card{min-width:0;border:1px solid rgba(255,255,255,.08);border-radius:22px;background:rgba(16,12,30,.82);padding:22px;color:#fff;overflow:hidden}.campaign-card header{position:relative;margin-bottom:18px}.campaign-card header span{font-size:10px;letter-spacing:.16em;color:#a99bc7}.campaign-card header h2{margin:5px 0 0;font-size:22px}.campaign-card header>strong{position:absolute;right:0;top:0;font-size:28px}.engine-note{display:block;color:#81778e;font-size:10px;margin-top:6px}.audience-tabs,.campaign-type-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.audience-tabs button,.campaign-type-grid button{border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:#bfb6d2;border-radius:12px;padding:12px;text-align:left;cursor:pointer}.audience-tabs button.active,.campaign-type-grid button.active{border-color:#8b5cf6;background:rgba(139,92,246,.14);color:#fff}.campaign-type-grid button strong,.campaign-type-grid button span,.campaign-type-grid button small{display:block}.campaign-type-grid button span{font-size:11px;line-height:1.4;margin-top:5px;color:#9d94af}.campaign-type-grid button small{margin-top:8px;font-size:9px;color:#8b5cf6}.campaign-card label{display:block;margin-top:14px;font-size:11px;color:#a99fb8}.campaign-card input,.campaign-card select,.campaign-card textarea{display:block;width:100%;box-sizing:border-box;margin-top:7px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:#0c0916;color:#fff;padding:11px;outline:none}.filters,.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.wide{grid-column:1/-1}.lead-list{margin-top:14px;max-height:320px;overflow:auto}.lead-list label{display:flex;gap:10px;align-items:center;padding:9px;border-bottom:1px solid rgba(255,255,255,.05)}.lead-list label span{color:#fff}.lead-list small{display:block;color:#857d92;margin-top:3px}.audience-note{font-size:11px;line-height:1.5;color:#7f768e;margin-top:16px}.direct-notice,.template-contract,.message-preview{margin:14px 0;padding:14px;border:1px solid rgba(139,92,246,.28);border-radius:14px;background:rgba(139,92,246,.07)}.direct-notice strong,.direct-notice span,.template-contract>div{display:block}.direct-notice span,.template-contract span{font-size:11px;line-height:1.5;color:#bdb3ca;margin-top:4px}.variable-row{display:flex!important;align-items:center;gap:10px;margin-top:9px!important}.variable-row b{min-width:34px;color:#b08cff}.message-preview{background:rgba(255,255,255,.025);border-color:rgba(255,255,255,.08)}.message-preview>span{font-size:9px;letter-spacing:.15em;color:#8b5cf6}.message-preview p{margin:8px 0;color:#eee;line-height:1.45}.message-preview p:nth-last-child(1){color:#a99fb8}.sendbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07)}.sendbar strong,.sendbar small{display:block}.sendbar small{color:#81778e;font-size:10px;margin-top:4px}.sendbar button{border:0;border-radius:12px;padding:13px 18px;background:#8b5cf6;color:#fff;font-weight:700;cursor:pointer}.sendbar button:disabled{opacity:.45;cursor:not-allowed}.result,.error{margin-top:14px;padding:13px;border-radius:12px;font-size:12px}.result{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.18)}.result>*{display:block;margin-top:3px}.error{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#ffb2b2}@media(max-width:900px){.campaign-v2-grid{grid-template-columns:1fr}.campaign-type-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.campaign-card{padding:16px;border-radius:17px}.audience-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.campaign-type-grid,.filters,.form-grid{grid-template-columns:1fr}.sendbar{align-items:stretch;flex-direction:column}.sendbar button{width:100%}.wide{grid-column:auto}}
      `}</style>
    </section>
  );
}
