"use client";

import {
  CheckSquare, Edit3, Filter, MessageCircle, Save, Search, Send, Square,
  SlidersHorizontal, Star, Trash2, UserCheck, UsersRound, X,
} from "@/components/admin/ServerIcons";
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
            <input aria-label="Search leads" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone, budget, location..." />
          </label>
          <label><Filter size={15} /><select aria-label="Filter leads by status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>{statuses.map((item) => <option key={item} value={item}>{item.replace(/_/g, " ")}</option>)}</select></label>
          <label><Star size={15} /><select aria-label="Filter leads by score" value={score} onChange={(event) => setScore(event.target.value as typeof score)}>{scores.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>

        {message ? <p className="lead-feedback success" role="status" aria-live="polite">{message}</p> : null}
        {error ? <p className="lead-feedback error" role="alert">{error}</p> : null}

        <div className="lead-compact-list">
          {filteredLeads.map((lead) => {
            const isEditing = editingId === String(lead.id) && draft;
            const whatsapp = whatsappHref(lead.phone);
            const selectedLead = selectedSet.has(String(lead.id));
            return (
              <div key={lead.id} className="lead-record-shell">
                <button
                  type="button"
                  className="lead-check"
                  aria-label={selectedLead ? `Deselect ${lead.name || lead.phone || "lead"}` : `Select ${lead.name || lead.phone || "lead"}`}
                  aria-pressed={selectedLead}
                  onClick={() => toggleLead(String(lead.id))}
                >
                  {selectedLead ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
                <details className="lead-compact-card admin-record-disclosure">
                <summary className="admin-record-summary">
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
                        {whatsapp !== "#" ? (
                          <a href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={15} />WhatsApp</a>
                        ) : (
                          <span className="lead-disabled-action" aria-disabled="true"><MessageCircle size={15} />WhatsApp unavailable</span>
                        )}
                        <a href={`/dashboard/limitless/campaigns?lead=${encodeURIComponent(lead.phone || lead.id)}`}><Send size={15} />Campaign</a>
                        <button type="button" className="danger" disabled={isPending} onClick={() => deleteLead(lead)}><Trash2 size={15} />Delete</button>
                      </>
                    )}
                  </div>
                </div>
                </details>
              </div>
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
            <button type="button" aria-pressed={groupType === "manual"} className={groupType === "manual" ? "active" : ""} onClick={() => setGroupType("manual")}><UsersRound size={15} />Manual group</button>
            <button type="button" aria-pressed={groupType === "smart"} className={groupType === "smart" ? "active" : ""} onClick={() => setGroupType("smart")}><SlidersHorizontal size={15} />Smart group</button>
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
                <button type="button" aria-label={`Edit ${group.name}`} disabled={isPending} onClick={() => editGroup(group)}><Edit3 size={14} /></button>
                <a href={`/dashboard/limitless/campaigns?group=${encodeURIComponent(group.id)}`}>Use group</a>
                <button type="button" aria-label={`Delete ${group.name}`} disabled={isPending} onClick={() => deleteGroup(group.id)}><Trash2 size={14} /></button>
              </div>
            </article>
          );})}
          {!localGroups.length ? <p className="admin-empty">No campaign groups saved yet.</p> : null}
        </div>
      </section>

      <style jsx>{`
        .leads-crm{display:grid;gap:16px}
        .leads-crm-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
        .leads-crm-summary>div{min-width:0;padding:15px;border:1px solid var(--fk-border);border-radius:14px;background:var(--fk-surface)}
        .leads-crm-summary>div>span{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;color:var(--fk-brand-hover);background:var(--fk-brand-soft)}
        .leads-crm-summary p{margin:11px 0 0;color:var(--fk-text-muted);font-size:10px;font-weight:600}
        .leads-crm-summary strong{display:block;margin-top:5px;color:var(--fk-text);font-size:24px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.035em}
        .lead-select-button,.lead-check,.lead-card-actions button,.campaign-group-builder button,.campaign-group-list button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:0 12px;border:1px solid var(--fk-border-strong);border-radius:10px;background:var(--fk-surface-raised);color:var(--fk-text-secondary);font:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:background 150ms var(--fk-ease),border-color 150ms var(--fk-ease),color 150ms var(--fk-ease),transform 150ms var(--fk-ease)}
        .lead-select-button:hover,.lead-card-actions button:hover,.campaign-group-builder button:hover,.campaign-group-list button:hover{border-color:var(--fk-border-strong);background:var(--fk-surface-hover);color:var(--fk-text)}
        .lead-select-button:active,.lead-card-actions button:active,.campaign-group-builder button:active,.campaign-group-list button:active{transform:translateY(1px)}
        .lead-check{width:38px;min-height:38px;padding:0;border-color:transparent;background:transparent;color:var(--fk-brand-hover)}
        .lead-card-actions button.danger,.campaign-group-list button{color:var(--fk-danger)}
        .lead-feedback{margin:12px 0 0;border:1px solid var(--fk-border);border-radius:10px;padding:10px 12px;font-size:11px;font-weight:600}
        .lead-feedback.success{border-color:color-mix(in srgb,var(--fk-success) 28%,var(--fk-border));background:color-mix(in srgb,var(--fk-success) 8%,transparent);color:var(--fk-success)}
        .lead-feedback.error{border-color:color-mix(in srgb,var(--fk-danger) 28%,var(--fk-border));background:color-mix(in srgb,var(--fk-danger) 8%,transparent);color:var(--fk-danger)}
        .lead-filter-bar{display:grid;grid-template-columns:auto minmax(220px,1fr) minmax(150px,.32fr) minmax(150px,.32fr);gap:8px;align-items:center;margin-top:14px}
        .lead-filter-bar>label{display:flex;align-items:center;gap:7px;min-width:0;min-height:40px;padding:0 10px;border:1px solid var(--fk-border);border-radius:10px;background:var(--fk-surface-raised);color:var(--fk-text-muted)}
        .lead-filter-bar input,.lead-filter-bar select{min-width:0;width:100%;height:38px;border:0!important;outline:0!important;background:transparent!important;color:var(--fk-text)!important;box-shadow:none!important;font:inherit;font-size:11px}
        .lead-filter-bar select{cursor:pointer}
        .lead-filter-bar select option{background:var(--fk-surface-overlay);color:var(--fk-text)}
        .lead-compact-list{display:grid;gap:8px;margin-top:14px}
        .lead-record-shell{display:grid;grid-template-columns:auto minmax(0,1fr);gap:8px;align-items:start}
        .lead-record-shell>.lead-check{margin-top:12px}
        .lead-compact-card{overflow:hidden;border:1px solid var(--fk-border);border-radius:13px;background:var(--fk-surface-raised);transition:border-color 150ms var(--fk-ease),background 150ms var(--fk-ease)}
        .lead-compact-card[open]{border-color:var(--fk-border-strong);background:var(--fk-surface-hover)}
        .lead-compact-card summary{list-style:none}
        .lead-compact-card summary::-webkit-details-marker{display:none}
        .admin-record-summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;min-height:62px;padding:10px 12px;cursor:pointer}
        .admin-record-summary-main{min-width:0}
        .admin-record-summary-main strong,.admin-record-summary-main span{display:block}
        .admin-record-summary-main strong{overflow:hidden;color:var(--fk-text);font-size:12px;font-weight:600;text-overflow:ellipsis;white-space:nowrap}
        .admin-record-summary-main span{margin-top:3px;color:var(--fk-text-muted);font-size:10px}
        .admin-record-summary-meta{display:flex;align-items:center;gap:7px}
        .admin-record-summary-meta span,.admin-record-summary-meta em{padding:5px 7px;border:1px solid var(--fk-border);border-radius:999px;background:var(--fk-surface);color:var(--fk-text-muted);font-size:8px;font-style:normal;font-weight:600;text-transform:capitalize}
        .admin-record-summary-meta em{color:var(--fk-brand-hover)}
        .admin-record-disclosure-body{padding:14px;border-top:1px solid var(--fk-border);background:var(--fk-surface)}
        .lead-card-meta{display:flex;flex-wrap:wrap;gap:7px}
        .lead-card-meta span{padding:6px 8px;border:1px solid var(--fk-border);border-radius:999px;background:var(--fk-surface-raised);color:var(--fk-text-secondary);font-size:9px}
        .lead-card-bottom{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;color:var(--fk-text-muted);font-size:9px}
        .lead-card-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
        .lead-card-actions a{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:0 12px;border:1px solid var(--fk-border-strong);border-radius:10px;background:var(--fk-surface-raised);color:var(--fk-text-secondary);font-size:11px;font-weight:600;text-decoration:none}
        .lead-card-actions a:hover{background:var(--fk-surface-hover);color:var(--fk-text)}
        .lead-disabled-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:0 12px;border:1px solid var(--fk-border);border-radius:10px;background:var(--fk-surface-raised);color:var(--fk-text-muted);font-size:11px;font-weight:600;opacity:.65}
        .lead-edit-grid,.campaign-group-builder{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .lead-edit-grid label,.campaign-group-builder label{color:var(--fk-text-muted);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
        .lead-edit-grid input,.lead-edit-grid select,.lead-edit-grid textarea,.campaign-group-builder input,.campaign-group-builder select,.campaign-group-builder textarea{margin-top:7px;width:100%;box-sizing:border-box;border:1px solid var(--fk-border-strong)!important;border-radius:10px;background:var(--fk-surface-raised)!important;color:var(--fk-text)!important;padding:10px 11px;font:inherit;font-size:11px;text-transform:none;letter-spacing:0}
        .lead-edit-grid textarea,.campaign-group-builder textarea{resize:vertical}
        .campaign-group-builder select option{background:var(--fk-surface-overlay);color:var(--fk-text)}
        .wide{grid-column:1/-1}
        .lead-toggle{display:flex;align-items:center;gap:9px;text-transform:none!important;letter-spacing:0!important}
        .lead-toggle input{width:auto;margin:0}
        .group-type-toggle,.group-builder-actions{display:flex;flex-wrap:wrap;gap:8px}
        .group-type-toggle button{background:var(--fk-surface-raised);color:var(--fk-text-muted)}
        .group-type-toggle button.active{border-color:color-mix(in srgb,var(--fk-brand) 38%,var(--fk-border-strong));background:var(--fk-brand-soft);color:var(--fk-brand-hover)}
        .group-builder-actions button:first-child{border-color:color-mix(in srgb,var(--fk-brand) 62%,var(--fk-border-strong));background:linear-gradient(135deg,var(--fk-brand-strong),var(--fk-brand));color:white;box-shadow:0 8px 20px var(--fk-brand-glow)}
        .group-builder-actions button.secondary{background:var(--fk-surface-raised);color:var(--fk-text-secondary)}
        .group-builder-note{margin:0;color:var(--fk-text-muted);font-size:10px;font-weight:600;line-height:1.45}
        .campaign-group-list{display:grid;gap:8px;margin-top:14px}
        .campaign-group-list article{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid var(--fk-border);border-radius:12px;background:var(--fk-surface-raised)}
        .campaign-group-list strong,.campaign-group-list span,.campaign-group-list small{display:block}
        .campaign-group-list strong{color:var(--fk-text);font-size:12px}
        .campaign-group-list span,.campaign-group-list small{margin-top:4px;color:var(--fk-text-muted);font-size:9px;line-height:1.4}
        .campaign-group-list article>div:last-child{display:flex;align-items:center;gap:8px}
        .campaign-group-list a{display:inline-flex;align-items:center;min-height:38px;padding:0 10px;border:1px solid color-mix(in srgb,var(--fk-brand) 32%,var(--fk-border));border-radius:9px;color:var(--fk-brand-hover);background:var(--fk-brand-soft);font-size:10px;font-weight:600;text-decoration:none}
        @media(max-width:1080px){.leads-crm-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.lead-filter-bar{grid-template-columns:1fr 1fr}.lead-select-button{width:100%}.lead-search{grid-column:1/-1}}
        @media(max-width:780px){.lead-edit-grid,.campaign-group-builder{grid-template-columns:1fr}.wide{grid-column:auto}.campaign-group-list article{align-items:stretch;flex-direction:column}.campaign-group-list article>div:last-child,.group-builder-actions,.group-type-toggle{display:grid;grid-template-columns:1fr}.lead-select-button{width:100%;justify-content:center}.lead-filter-bar{grid-template-columns:1fr}.lead-search{grid-column:auto}.lead-filter-bar>label{min-height:44px}.lead-select-button{min-height:44px}.admin-record-summary{grid-template-columns:auto minmax(0,1fr);align-items:start}.admin-record-summary-meta{grid-column:2;justify-self:start;flex-wrap:wrap}.lead-card-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.lead-card-actions>*{min-height:44px!important}.lead-card-bottom{align-items:flex-start;flex-direction:column;gap:5px}}
        @media(max-width:430px){.leads-crm-summary{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.leads-crm-summary>div{padding:12px}.leads-crm-summary strong{font-size:22px}.lead-card-actions{grid-template-columns:1fr}.campaign-group-list article>div:last-child{grid-template-columns:1fr 1fr}.campaign-group-list a{justify-content:center}}
        @media(prefers-reduced-motion:reduce){.lead-select-button,.lead-card-actions button,.campaign-group-builder button,.campaign-group-list button,.lead-compact-card{transition:none!important;transform:none!important}}
      `}</style>
    </div>
  );
}
