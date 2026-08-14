"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { matchesCampaignGroupRules, type CampaignGroup } from "@/lib/campaign-groups";
import type { ProgressiveLead } from "@/lib/lead-profile-service";
import type { PropertyRecord } from "@/lib/limitless-data";

type Props = { leads: ProgressiveLead[]; properties: PropertyRecord[]; groups: CampaignGroup[] };
type AudienceMode = "all" | "manual" | "group" | "filters";
type CampaignType = "new_estate_update" | "limitless_realty_update" | "limitless_realty_reminder";
type CampaignResult = { status: string; attempted: number; sent: number; delivered: number; pendingDelivery: number; failed: number; skipped: number; campaignType?: string; templateName?: string; cooldownSkipped?: number; duplicatePrevented?: boolean };

const campaignTypes: Array<{ value: CampaignType; label: string; templateName: string; description: string }> = [
  { value: "new_estate_update", label: "Estate update", templateName: "estate_brief_update", description: "New estate or property launch." },
  { value: "limitless_realty_update", label: "Market update", templateName: "limitless_realty_update_v2", description: "Price, promo and market broadcasts." },
  { value: "limitless_realty_reminder", label: "Reminder", templateName: "limitless_realty_reminder", description: "Follow-up and reminder messages." },
];

function text(value: unknown) { return String(value || "").trim().toLowerCase(); }
function money(value: unknown) { const parsed = Number(String(value || "").replace(/[^\d.]/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function eligible(lead: ProgressiveLead) { const status = text(lead.status); return Boolean(lead.phone && lead.campaign_eligible !== false && !["opted_out", "do_not_contact", "blocked", "invalid"].includes(status)); }

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
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState("");
  const [mediaUploading, setMediaUploading] = useState(false);
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
      if (audienceMode === "group") return selectedGroup ? (selectedGroup.groupType === "smart" ? matchesCampaignGroupRules(lead, selectedGroup.rules) : groupLeadIds.has(String(lead.id))) : false;
      if (stateNeedle && !text(lead.location_preference).includes(stateNeedle)) return false;
      if (interestNeedle && ![lead.purpose, lead.property_type, lead.property_interest].map(text).join(" ").includes(interestNeedle)) return false;
      if (propertyNeedle && ![lead.property_interest, lead.property_type, lead.purpose].map(text).join(" ").includes(propertyNeedle)) return false;
      const budget = money(lead.budget);
      if (minimum && (!budget || budget < minimum)) return false;
      if (maximum && (!budget || budget > maximum)) return false;
      return true;
    });
  }, [audienceMode, budgetMax, budgetMin, interest, leads, selectedLeadIds, selectedGroup, selectedProperty, state]);

  const groupExtraCount = audienceMode === "group" && selectedGroup?.groupType === "manual" ? selectedGroup.phones.length || 0 : 0;
  const recipientCount = audience.length + groupExtraCount;
  const toggleLead = (id: string) => setSelectedLeadIds((current) => current.includes(id) ? current.filter((leadId) => leadId !== id) : [...current, id]);

  const chooseMedia = (file: File | null) => {
    setError("");
    setMediaFile(file);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(file ? URL.createObjectURL(file) : "");
  };

  const uploadSelectedMedia = async () => {
    if (!mediaFile) return mediaUrl.trim();
    setMediaUploading(true);
    const body = new FormData();
    body.set("file", mediaFile);
    body.set("channel", "whatsapp");
    if (propertyId) body.set("property_id", propertyId);
    if (message.trim()) body.set("caption", message.trim());
    try {
      const response = await fetch("/api/admin/media/upload", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Media upload failed with status ${response.status}.`);
      setMediaUrl(String(data.url || ""));
      setMediaFile(null);
      return String(data.url || "");
    } finally {
      setMediaUploading(false);
    }
  };

  const sendCampaign = () => {
    if (sendingRef.current || isPending) return;
    sendingRef.current = true;
    setResult(null);
    setError("");
    const requestId = crypto.randomUUID();
    startTransition(async () => {
      try {
        const uploadedMediaUrl = await uploadSelectedMedia();
        const response = await fetch("/api/limitless/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
          body: JSON.stringify({ requestId, campaignType, topic, message, mediaUrl: uploadedMediaUrl, audienceMode, selectedLeadIds, campaignGroupId, state, interest, propertyId, budgetMin, budgetMax }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Campaign failed.");
        setResult({ status: data.status, attempted: data.attempted || 0, sent: data.sent || 0, delivered: data.delivered || 0, pendingDelivery: data.pendingDelivery || 0, failed: data.failed || 0, skipped: data.skipped || 0, cooldownSkipped: data.cooldownSkipped || 0, campaignType: data.campaignType, templateName: data.templateName, duplicatePrevented: data.duplicatePrevented });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Campaign failed.");
      } finally { sendingRef.current = false; }
    });
  };

  return (
    <div className="campaign-console-grid">
      <section className="console-panel audience-console">
        <header className="console-panel-head"><div><span>AUDIENCE MATRIX</span><h2>Select recipients</h2></div><strong>{recipientCount}</strong></header>
        <div className="console-mode-grid">
          {(["all", "manual", "group", "filters"] as AudienceMode[]).map((mode) => <button key={mode} type="button" className={audienceMode === mode ? "active" : ""} onClick={() => setAudienceMode(mode)}><small>{mode === "all" ? "01" : mode === "manual" ? "02" : mode === "group" ? "03" : "04"}</small><span>{mode === "all" ? "All leads" : mode === "manual" ? "Manual" : mode === "group" ? "Saved group" : "Smart filters"}</span></button>)}
        </div>
        {audienceMode === "group" ? <div className="console-form-grid"><label className="wide"><span>Saved campaign group</span><select value={campaignGroupId} onChange={(event) => setCampaignGroupId(event.target.value)}><option value="">Choose saved group</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name} · {group.groupType}</option>)}</select></label></div> : null}
        {audienceMode === "filters" ? <div className="console-form-grid">
          <label><span>Location</span><input list="campaign-states" value={state} onChange={(event) => setState(event.target.value)} placeholder="Any" /><datalist id="campaign-states">{states.map((value) => <option key={value} value={value} />)}</datalist></label>
          <label><span>Interest</span><input list="campaign-interests" value={interest} onChange={(event) => setInterest(event.target.value)} placeholder="Any" /><datalist id="campaign-interests">{interests.map((value) => <option key={value} value={value} />)}</datalist></label>
          <label><span>Property</span><select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">Any property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
          <label><span>Minimum budget</span><input inputMode="numeric" value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} placeholder="₦0" /></label>
          <label><span>Maximum budget</span><input inputMode="numeric" value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} placeholder="No maximum" /></label>
        </div> : null}
        {audienceMode === "manual" ? <div className="console-lead-picker">{leads.filter(eligible).slice(0, 250).map((lead) => <label className="console-lead-option" key={lead.id}><input type="checkbox" checked={selectedLeadIds.includes(String(lead.id))} onChange={() => toggleLead(String(lead.id))} /><span className="console-lead-copy"><strong>{lead.name}</strong><small>{lead.phone}</small></span></label>)}</div> : null}
        <div className="console-audience-meter"><div style={{ "--angle": `${Math.min(100, recipientCount ? 76 : 0) * 3.6}deg` } as React.CSSProperties}><strong>{recipientCount}</strong><span>RECIPIENTS</span></div><ul><li><i />Eligible audience</li><li><i />Duplicate protected</li><li><i />Provider verified</li></ul></div>
      </section>

      <section className="console-panel composer-console">
        <header className="console-panel-head"><div><span>MESSAGE ENGINE</span><h2>Compose campaign</h2></div><small>MAIA / WHATSAPP</small></header>
        <div className="console-template-grid">{campaignTypes.map((type) => <button key={type.value} type="button" className={campaignType === type.value ? "active" : ""} onClick={() => setCampaignType(type.value)}><strong>{type.label}</strong><span>{type.description}</span><small>{type.templateName}</small></button>)}</div>
        <div className="console-form-grid">
          <label><span>Campaign title</span><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="New estate update" /></label>
          <label><span>Featured property</span><select value={propertyId} onChange={(event) => setPropertyId(event.target.value)}><option value="">No linked property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}</select></label>
          <label className="wide"><span>Message</span><textarea rows={7} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write the WhatsApp message Maia should send..." /></label>
          <label className="wide"><span>Attach image directly</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={isPending || mediaUploading} onChange={(event) => chooseMedia(event.target.files?.[0] || null)} />
            <small>{mediaFile ? `${mediaFile.name} selected. It will be stored in Supabase and sent as media.` : "Images are stored in Supabase Storage. No Google Drive link is required."}</small>
          </label>
          {mediaPreview ? <div className="wide campaign-media-preview"><img src={mediaPreview} alt="Selected campaign media preview" /><button type="button" onClick={() => chooseMedia(null)} disabled={isPending || mediaUploading}>Remove image</button></div> : null}
          <label className="wide"><span>Or use an existing public image URL</span><input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder={selectedProperty?.drive_photos_link || "https://..."} /></label>
        </div>
        <div className="console-sendbar"><div><strong>{recipientCount} READY</strong><small>{selectedCampaignType.templateName}{mediaFile ? " · IMAGE ATTACHED" : ""}</small></div><button type="button" disabled={isPending || mediaUploading || !message.trim() || recipientCount === 0 || (audienceMode === "group" && !campaignGroupId)} onClick={sendCampaign}>{mediaUploading ? "UPLOADING MEDIA..." : isPending ? "TRANSMITTING..." : "SEND CAMPAIGN"}</button></div>
        {result ? <div className={`console-result ${result.failed ? "warning" : "success"}`}><header><strong>{result.status.replaceAll("_", " ")}</strong><small>{result.templateName || selectedCampaignType.templateName}</small></header><div>{[["ATTEMPTED",result.attempted],["SENT",result.sent],["DELIVERED",result.delivered],["PENDING",result.pendingDelivery],["FAILED",result.failed],["SKIPPED",result.skipped]].map(([label,value]) => <span key={String(label)}>{label}<b>{value}</b></span>)}</div></div> : null}
        {error ? <p className="campaign-error">{error}</p> : null}
      </section>

      <style jsx>{`
        .campaign-console-grid,
        .console-panel,
        .audience-console,
        .console-lead-picker {
          min-width: 0;
          max-width: 100%;
        }

        .console-lead-picker {
          width: 100%;
          overflow-x: hidden;
        }

        .console-lead-option {
          width: 100%;
          min-width: 0;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr);
          align-items: center;
          gap: 12px;
          padding: 13px 14px;
          text-align: left;
        }

        .console-lead-option > input {
          width: 20px;
          height: 20px;
          min-width: 20px;
          margin: 0;
          justify-self: start;
        }

        .console-lead-copy {
          display: block;
          min-width: 0;
          width: 100%;
          text-align: left;
          overflow: hidden;
        }

        .console-lead-copy strong,
        .console-lead-copy small {
          display: block;
          max-width: 100%;
          text-align: left;
          overflow-wrap: anywhere;
          word-break: normal;
        }

        .console-lead-copy strong { line-height: 1.25; }
        .console-lead-copy small { margin-top: 4px; line-height: 1.35; }

        .campaign-media-preview {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          flex-wrap: wrap;
        }

        .campaign-media-preview img {
          width: 180px;
          height: 140px;
          object-fit: cover;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.12);
        }

        @media (max-width: 640px) {
          .console-mode-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .console-mode-grid button { min-width: 0; width: 100%; padding: 12px 10px; }
          .console-panel-head { min-width: 0; }
          .console-lead-option { padding: 12px 10px; gap: 10px; }
          .console-lead-copy strong { font-size: 0.98rem; }
          .console-lead-copy small { font-size: 0.8rem; }
        }
      `}</style>
    </div>
  );
}
