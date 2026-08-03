"use client";

import {
  CheckSquare, Edit3, Filter, MessageCircle, Save, Search, Send, Square,
  SlidersHorizontal, Star, Trash2, UserCheck, UsersRound, X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  matchesCampaignGroupRules,
  type CampaignGroup,
  type CampaignGroupRules,
} from "@/lib/campaign-groups";
import type { ProgressiveLead } from "@/lib/lead-profile-service";

type LeadsCrmProps = { leads: ProgressiveLead[]; groups: CampaignGroup[] };
type GroupType = "manual" | "smart";
type LeadDraft = Pick<ProgressiveLead,
  "name" | "phone" | "email" | "status" | "score" | "budget" | "location_preference" |
  "property_type" | "property_interest" | "purpose" | "notes" | "campaign_eligible"
>;

const statuses = ["all", "new", "in_conversation", "qualified", "cold", "opted_out"] as const;
const scores = ["all", "hot", "warm", "cold", "unscored"] as const;

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

function formatDate(value?: string) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusLabel(value?: string) {
  return String(value || "new").replace(/_/g, " ");
}

function draftFromLead(lead: ProgressiveLead): LeadDraft {
  return {
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    status: lead.status || "new",
    score: lead.score || "",
    budget: lead.budget || "",
    location_preference: lead.location_preference || "",
    property_type: lead.property_type || "",
    property_interest: lead.property_interest || "",
    purpose: lead.purpose || "",
    notes: lead.notes || "",
    campaign_eligible: lead.campaign_eligible !== false,
  };
}

function describeRules(rules?: CampaignGroupRules) {
  const parts = [
    rules?.state ? `location: ${rules.state}` : "",
    rules?.interest ? `interest: ${rules.interest}` : "",
    rules?.propertyInterest ? `property: ${rules.propertyInterest}` : "",
    rules?.status && rules.status !== "all" ? `status: ${rules.status}` : "",
    rules?.score && rules.score !== "all" ? `score: ${rules.score}` : "",
    rules?.budgetMin ? `from ${rules.budgetMin}` : "",
    rules?.budgetMax ? `up to ${rules.budgetMax}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No smart filters";
}

export default function LeadsCrm({ leads, groups }: LeadsCrmProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [score, setScore] = useState<(typeof scores)[number]>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<LeadDraft | null>(null);
  const [editingGroupId, setEditingGroupId] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("manual");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [extraPhones, setExtraPhones] = useState("");
  const [smartRules, setSmartRules] = useState<CampaignGroupRules>({ campaignEligibleOnly: true });
  const [localGroups, setLocalGroups] = useState(groups);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredLeads = useMemo(() => {
    const normalizedQuery = normalize(query);
    return leads.filter((lead) => {
      const haystack = [
        lead.name, lead.phone, lead.status, lead.score, lead.budget, lead.location_preference,
        lead.property_type, lead.property_interest, lead.purpose, lead.email, lead.notes,
      ].map(normalize).join(" ");
      return (status === "all" || normalize(lead.status) === status)
        && (score === "all" || normalize(lead.score || "unscored") === score)
        && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [leads, query, score, status]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visibleIds = filteredLeads.map((lead) => String(lead.id));
  const visibleSelected = visibleIds.filter((id) => selectedSet.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleSelected === visibleIds.length;
  const hotLeads = leads.filter((lead) => normalize(lead.score) === "hot" || normalize(lead.status) === "qualified").length;
  const warmLeads = leads.filter((lead) => normalize(lead.score) === "warm").length;
  const followUpLeads = leads.filter((lead) => Number(lead.follow_up_stage || 0) > 0).length;
  const qualifiedRate = leads.length ? Math.round((hotLeads / leads.length) * 100) : 0;
  const locationOptions = useMemo(
    () => [...new Set(leads.map((lead) => lead.location_preference).filter(Boolean) as string[])].sort(),
    [leads],
  );
  const interestOptions = useMemo(
    () => [...new Set(leads.flatMap((lead) => [lead.purpose, lead.property_type, lead.property_interest]).filter(Boolean) as string[])].sort(),
    [leads],
  );
  const smartPreviewCount = useMemo(
    () => leads.filter((lead) => matchesCampaignGroupRules(lead, smartRules)).length,
    [leads, smartRules],
  );

  const toggleLead = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleVisible = () => {
    setSelected((current) => {
      const currentSet = new Set(current);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => currentSet.delete(id));
      } else {
        visibleIds.forEach((id) => currentSet.add(id));
      }
      return [...currentSet];
    });
  };

  const startEdit = (lead: ProgressiveLead) => {
    setEditingId(String(lead.id));
    setDraft(draftFromLead(lead));
    setError("");
    setMessage("");
  };

  const updateDraft = (key: keyof LeadDraft, value: string | boolean) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const updateSmartRule = (key: keyof CampaignGroupRules, value: string | boolean) => {
    setSmartRules((current) => ({ ...current, [key]: value }));
  };

  const resetGroupEditor = () => {
    setEditingGroupId("");
    setGroupType("manual");
    setGroupName("");
    setGroupDescription("");
    setExtraPhones("");
    setSmartRules({ campaignEligibleOnly: true });
  };

  const editGroup = (group: CampaignGroup) => {
    setEditingGroupId(group.id);
    setGroupType(group.groupType);
    setGroupName(group.name);
    setGroupDescription(group.description || "");
    setSelected(group.leadIds);
    setExtraPhones(group.phones.join("\n"));
    setSmartRules(group.rules || { campaignEligibleOnly: true });
    setError("");
    setMessage("");
  };

  const saveLead = (id: string) => {
    if (!draft) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/limitless/leads/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to update lead.");
        setEditingId("");
        setDraft(null);
        setMessage("Lead updated.");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to update lead.");
      }
    });
  };

  const deleteLead = (lead: ProgressiveLead) => {
    if (!window.confirm(`Delete ${lead.name || lead.phone || "this lead"} from the CRM?`)) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/limitless/leads/${encodeURIComponent(String(lead.id))}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to delete lead.");
        setSelected((current) => current.filter((id) => id !== String(lead.id)));
        setMessage("Lead deleted.");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to delete lead.");
      }
    });
  };

  const saveGroup = () => {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/limitless/campaign-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingGroupId || undefined,
            name: groupName,
            groupType,
            description: groupDescription,
            leadIds: groupType === "manual" ? selected : [],
            phones: groupType === "manual" ? extraPhones : "",
            rules: groupType === "smart" ? smartRules : undefined,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to save campaign group.");
        setLocalGroups((current) => [data.group, ...current.filter((group) => group.id !== data.group.id)]);
        resetGroupEditor();
        setMessage(`${data.group.groupType === "smart" ? "Smart" : "Manual"} group saved.`);
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to save campaign group.");
      }
    });
  };

  const deleteGroup = (id: string) => {
    setError("");
    setMessage("");
    startTransition(async () => {
      try {
        const response = await fetch(`/api/limitless/campaign-groups/${encodeURIComponent(id)}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to delete campaign group.");
        setLocalGroups((current) => current.filter((group) => group.id !== id));
        if (editingGroupId === id) resetGroupEditor();
        setMessage("Campaign group deleted.");
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to delete campaign group.");
      }
    });
  };

  return (
    <div className="leads-crm">
      <div className="leads-crm-summary">
        <div><span><UserCheck size={16} /></span><p>Total Leads</p><strong>{leads.length}</strong></div>
        <div><span><Star size={16} /></span><p>Hot / Qualified</p><strong>{hotLeads}</strong></div>
        <div><span><MessageCircle size={16} /></span><p>Warm Leads</p><strong>{warmLeads}</strong></div>
        <div><span><Send size={16} /></span><p>In Follow-up</p><strong>{followUpLeads}</strong></div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Lead Control</h2><p>{filteredLeads.length} of {leads.length} leads showing. Qualification rate: {qualifiedRate}%.</p></div>
          <span className="admin-status live">{selected.length} selected</span>
        </div>

        <div className="lead-filter-bar">
          <button type="button" className="lead-select-button" onClick={toggleVisible}>
            {allVisibleSelected ? <CheckSquare size={16} /> : <Square size={16} />}
            {allVisibleSelected ? "Clear visible" : "Select visible"}
          </button>
          <label className="lead-search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, budget, location..." />
          </label>
          <label><Filter size={15} /><select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{statuses.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
          <label><Star size={15} /><select value={score} onChange={(event) => setScore(event.target.value as typeof score)}>{scores.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>

        {message ? <p className="lead-feedback success">{message}</p> : null}
        {error ? <p className="lead-feedback error">{error}</p> : null}

        <div className="lead-compact-list">
          {filteredLeads.map((lead) => {
            const isEditing = editingId === String(lead.id) && draft;
            return (
              <details key={lead.id} className="lead-compact-card admin-record-disclosure">
                <summary className="admin-record-summary">
                  <button type="button" className="lead-check" onClick={(event) => { event.preventDefault(); toggleLead(String(lead.id)); }}>
                    {selectedSet.has(String(lead.id)) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                  <div className="admin-record-summary-main">
                    <strong>{lead.name || "Unknown lead"}</strong>
                    <span>{lead.phone || "No phone saved"}</span>
                  </div>
                  <div className="admin-record-summary-meta">
                    <span>{getStatusLabel(lead.status)}</span>
                    <em>{lead.score || "unscored"}</em>
                  </div>
                </summary>

                <div className="admin-record-disclosure-body">
                  {isEditing ? (
                    <div className="lead-edit-grid">
                      <label>Name<input value={draft.name || ""} onChange={(event) => updateDraft("name", event.target.value)} /></label>
                      <label>WhatsApp phone<input value={draft.phone || ""} onChange={(event) => updateDraft("phone", event.target.value)} /></label>
                      <label>Email<input value={draft.email || ""} onChange={(event) => updateDraft("email", event.target.value)} /></label>
                      <label>Budget<input value={draft.budget || ""} onChange={(event) => updateDraft("budget", event.target.value)} /></label>
                      <label>Location<input value={draft.location_preference || ""} onChange={(event) => updateDraft("location_preference", event.target.value)} /></label>
                      <label>Property type<input value={draft.property_type || ""} onChange={(event) => updateDraft("property_type", event.target.value)} /></label>
                      <label>Interested property<input value={draft.property_interest || ""} onChange={(event) => updateDraft("property_interest", event.target.value)} /></label>
                      <label>Purpose<input value={draft.purpose || ""} onChange={(event) => updateDraft("purpose", event.target.value)} /></label>
                      <label>Status<select value={draft.status || "new"} onChange={(event) => updateDraft("status", event.target.value)}><option value="new">new</option><option value="in_conversation">in conversation</option><option value="qualified">qualified</option><option value="cold">cold</option><option value="opted_out">opted out</option></select></label>
                      <label>Score<select value={draft.score || ""} onChange={(event) => updateDraft("score", event.target.value)}><option value="">unscored</option><option value="cold">cold</option><option value="warm">warm</option><option value="hot">hot</option></select></label>
                      <label className="wide">Notes<textarea value={draft.notes || ""} onChange={(event) => updateDraft("notes", event.target.value)} rows={3} /></label>
                      <label className="lead-toggle"><input type="checkbox" checked={draft.campaign_eligible !== false} onChange={(event) => updateDraft("campaign_eligible", event.target.checked)} /> Campaign eligible</label>
                    </div>
                  ) : (
                    <>
                      <div className="lead-card-meta">
                        <span>{lead.budget || "Budget pending"}</span>
                        <span>{lead.location_preference || "Location pending"}</span>
                        <span>{lead.property_type || "Property type pending"}</span>
                        {lead.property_interest ? <span>{lead.property_interest}</span> : null}
                        {lead.purpose ? <span>{lead.purpose}</span> : null}
                      </div>
                      <div className="lead-card-bottom">
                        <span>Follow-up stage {lead.follow_up_stage ?? 0}</span>
                        <span>{formatDate(lead.last_contacted_at || lead.created_at)}</span>
                      </div>
                    </>
                  )}
                  <div className="lead-card-actions">
                    {isEditing ? (
                      <>
                        <button type="button" disabled={isPending} onClick={() => saveLead(String(lead.id))}><Save size={15} />Save</button>
                        <button type="button" disabled={isPending} onClick={() => { setEditingId(""); setDraft(null); }}><X size={15} />Cancel</button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => startEdit(lead)}><Edit3 size={15} />Edit</button>
                        <a href={whatsappHref(lead.phone)} target="_blank" rel="noreferrer"><MessageCircle size={15} />WhatsApp</a>
                        <a href={`/dashboard/limitless/campaigns?lead=${encodeURIComponent(lead.phone || lead.id)}`}><Send size={15} />Campaign</a>
                        <button type="button" className="danger" disabled={isPending} onClick={() => deleteLead(lead)}><Trash2 size={15} />Delete</button>
                      </>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>

        {!filteredLeads.length ? <div className="admin-empty-state"><strong>No leads match this view.</strong><p>Clear the search or change the filters.</p></div> : null}
      </section>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div><h2>Audience Groups</h2><p>Create manual groups from chosen contacts, or smart groups that update from lead filters.</p></div>
          <span className="admin-status warning">{localGroups.length} saved</span>
        </div>
        <div className="campaign-group-builder">
          <div className="group-type-toggle wide">
            <button type="button" className={groupType === "manual" ? "active" : ""} onClick={() => setGroupType("manual")}><UsersRound size={15} />Manual group</button>
            <button type="button" className={groupType === "smart" ? "active" : ""} onClick={() => setGroupType("smart")}><SlidersHorizontal size={15} />Smart group</button>
          </div>
          <label>Group name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Benin investors, Hot buyers, Test list..." /></label>
          <label>Description<input value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} placeholder="Optional internal note" /></label>
          {groupType === "manual" ? (
            <>
              <label className="wide">Extra WhatsApp numbers<textarea value={extraPhones} onChange={(event) => setExtraPhones(event.target.value)} rows={3} placeholder="Paste numbers separated by commas, spaces, or new lines" /></label>
              <p className="group-builder-note wide">{selected.length} selected lead(s) will be saved in this manual group. Load an existing group below to add or remove people.</p>
            </>
          ) : (
            <>
              <label><span>Location</span><input list="smart-group-locations" value={smartRules.state || ""} onChange={(event) => updateSmartRule("state", event.target.value)} placeholder="Benin City, Edo State..." /><datalist id="smart-group-locations">{locationOptions.map((value) => <option key={value} value={value} />)}</datalist></label>
              <label><span>Interest</span><input list="smart-group-interests" value={smartRules.interest || ""} onChange={(event) => updateSmartRule("interest", event.target.value)} placeholder="investment, land, installment..." /><datalist id="smart-group-interests">{interestOptions.map((value) => <option key={value} value={value} />)}</datalist></label>
              <label><span>Property interest</span><input value={smartRules.propertyInterest || ""} onChange={(event) => updateSmartRule("propertyInterest", event.target.value)} placeholder="Iwinosa, Atlanta City..." /></label>
              <label><span>Status</span><select value={smartRules.status || "all"} onChange={(event) => updateSmartRule("status", event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
              <label><span>Score</span><select value={smartRules.score || "all"} onChange={(event) => updateSmartRule("score", event.target.value)}>{scores.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label><span>Minimum budget</span><input inputMode="numeric" value={smartRules.budgetMin || ""} onChange={(event) => updateSmartRule("budgetMin", event.target.value)} placeholder="N0" /></label>
              <label><span>Maximum budget</span><input inputMode="numeric" value={smartRules.budgetMax || ""} onChange={(event) => updateSmartRule("budgetMax", event.target.value)} placeholder="No maximum" /></label>
              <label className="lead-toggle"><input type="checkbox" checked={smartRules.campaignEligibleOnly !== false} onChange={(event) => updateSmartRule("campaignEligibleOnly", event.target.checked)} /> Campaign eligible only</label>
              <p className="group-builder-note wide">{smartPreviewCount} lead(s) currently match this smart group.</p>
            </>
          )}
          <div className="group-builder-actions wide">
            <button type="button" disabled={isPending} onClick={saveGroup}>
              <UsersRound size={15} />{editingGroupId ? "Update group" : groupType === "smart" ? `Save smart group (${smartPreviewCount})` : `Save manual group (${selected.length})`}
            </button>
            {editingGroupId ? <button type="button" className="secondary" disabled={isPending} onClick={resetGroupEditor}><X size={15} />Cancel edit</button> : null}
          </div>
        </div>
        <div className="campaign-group-list">
          {localGroups.map((group) => {
            const smartCount = group.groupType === "smart" ? leads.filter((lead) => matchesCampaignGroupRules(lead, group.rules)).length : 0;
            return (
            <article key={group.id}>
              <div>
                <strong>{group.name}</strong>
                <span>{group.groupType === "smart" ? `Smart group · ${smartCount} matching lead(s)` : `Manual group · ${group.leadIds.length} saved lead(s), ${group.phones.length} extra number(s)`}</span>
                {group.groupType === "smart" ? <small>{describeRules(group.rules)}</small> : null}
                {group.description ? <small>{group.description}</small> : null}
              </div>
              <div>
                <button type="button" disabled={isPending} onClick={() => editGroup(group)}><Edit3 size={14} /></button>
                <a href={`/dashboard/limitless/campaigns?group=${encodeURIComponent(group.id)}`}>Use group</a>
                <button type="button" disabled={isPending} onClick={() => deleteGroup(group.id)}><Trash2 size={14} /></button>
              </div>
            </article>
          );})}
          {!localGroups.length ? <p className="admin-empty">No campaign groups saved yet.</p> : null}
        </div>
      </section>

      <style jsx>{`
        .lead-select-button,.lead-check,.lead-card-actions button,.campaign-group-builder button,.campaign-group-list button{border:1px solid rgba(173,137,236,.24);background:#08050e;color:#e9ddff;border-radius:12px;display:inline-flex;align-items:center;gap:7px;padding:10px 12px;font:inherit;font-weight:800}.lead-check{padding:7px;border:0;background:transparent;color:#22d3ee}.lead-card-actions button.danger,.campaign-group-list button{color:#fca5a5}.lead-feedback{border-radius:12px;padding:10px 12px;font-weight:700}.lead-feedback.success{background:rgba(34,197,94,.12);color:#86efac}.lead-feedback.error{background:rgba(239,68,68,.12);color:#fca5a5}.lead-edit-grid,.campaign-group-builder{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.lead-edit-grid label,.campaign-group-builder label{color:#a99cbd;font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.lead-edit-grid input,.lead-edit-grid select,.lead-edit-grid textarea,.campaign-group-builder input,.campaign-group-builder select,.campaign-group-builder textarea{margin-top:7px;width:100%;box-sizing:border-box;border:1px solid rgba(173,137,236,.24);border-radius:12px;background:#08050e;color:#fff;padding:11px 12px;font:inherit;text-transform:none;letter-spacing:0}.campaign-group-builder select option{color:#111827}.wide{grid-column:1/-1}.lead-toggle{display:flex;align-items:center;gap:9px;text-transform:none!important;letter-spacing:0!important}.lead-toggle input{width:auto;margin:0}.group-type-toggle,.group-builder-actions{display:flex;flex-wrap:wrap;gap:10px}.group-type-toggle button{background:#08050e;border:1px solid rgba(173,137,236,.24);color:#c8bdd9}.group-type-toggle button.active{background:rgba(34,211,238,.14);border-color:rgba(34,211,238,.45);color:#67e8f9}.group-builder-actions button{justify-content:center;background:linear-gradient(135deg,#0891b2,#7c3aed);border:0;color:white}.group-builder-actions button.secondary{background:#08050e;border:1px solid rgba(173,137,236,.24);color:#e9ddff}.group-builder-note{margin:0;color:#a99cbd;font-weight:700}.campaign-group-list{display:grid;gap:10px;margin-top:16px}.campaign-group-list article{border:1px solid rgba(173,137,236,.18);border-radius:14px;background:#08050e;padding:13px;display:flex;align-items:center;justify-content:space-between;gap:12px}.campaign-group-list strong,.campaign-group-list span,.campaign-group-list small{display:block}.campaign-group-list span,.campaign-group-list small{color:#9d91ad;margin-top:4px}.campaign-group-list article>div:last-child{display:flex;align-items:center;gap:8px}.campaign-group-list a{border:1px solid rgba(34,211,238,.35);border-radius:10px;color:#67e8f9;padding:9px 11px;text-decoration:none;font-weight:800}@media(max-width:780px){.lead-edit-grid,.campaign-group-builder{grid-template-columns:1fr}.wide{grid-column:auto}.campaign-group-list article{align-items:stretch;flex-direction:column}.campaign-group-list article>div:last-child,.group-builder-actions,.group-type-toggle{display:grid;grid-template-columns:1fr}.lead-select-button{width:100%;justify-content:center}}
      `}</style>
    </div>
  );
}
