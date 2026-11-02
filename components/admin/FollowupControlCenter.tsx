"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock3, Pause, Play, RotateCcw, XCircle } from "@/components/admin/ServerIcons";
import type { FollowupEnrollment, FollowupLog } from "@/lib/followup-control";

type LeadOption = { id: string; name: string; phone: string };
type PropertyOption = { id: string; title: string; type?: string | null; location_city?: string | null; location_area?: string | null; price?: number | null; size_sqm?: number | null; bedrooms?: number | null; bathrooms?: number | null; status?: string | null; features?: string | null; estate?: { name?: string | null } | null };
type Props = {
  leads: LeadOption[];
  sequences: unknown[];
  steps: unknown[];
  enrollments: FollowupEnrollment[];
  logs: FollowupLog[];
  configured: boolean;
  automationIssues: number;
  now: number;
  loadError?: string;
};
type StatusFilter = "active" | "paused" | "failed" | "unknown" | "completed" | "cancelled" | "stopped" | "opted_out" | "closed" | "all";
type LogStatus = "all" | "success" | "failed" | "blocked";
type LogWindow = "24h" | "7d" | "30d" | "all";
const failureStatuses = new Set(["failed", "error"]);
const warningStatuses = new Set(["failed", "error", "blocked", "unknown"]);

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
}

function statusFilterKey(item: FollowupEnrollment): StatusFilter {
  if (item.sequence_status === "opted_out" || item.consent_state === "opted_out") return "opted_out";
  if (item.status === "unknown" || item.consent_state === "unknown") return "unknown";
  if (item.sequence_status === "paused") return "paused";
  if (item.sequence_status === "stopped") return "stopped";
  if (item.sequence_status === "completed" && item.stop_reason === "deal_closed") return "closed";
  return item.status as StatusFilter;
}

function statusLabel(item: FollowupEnrollment) {
  const status = statusFilterKey(item);
  if (status === "opted_out") return "Customer opted out";
  if (status === "unknown") return "Needs review";
  if (status === "paused") return "Admin paused";
  if (status === "stopped") return "Admin stopped";
  if (status === "closed") return "Deal closed";
  if (status === "active") return "Scheduled";
  return status;
}

export default function FollowupControlCenter(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Array<Record<string, any>>>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [templateReady, setTemplateReady] = useState(false);
  const [templateStatus, setTemplateStatus] = useState("unverified");
  const [selectedLeadId, setSelectedLeadId] = useState(props.leads[0]?.id || "");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [draftReason, setDraftReason] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [deliveryHistory, setDeliveryHistory] = useState<Array<Record<string, any>>>([]);
  const [draftBusy, setDraftBusy] = useState("");
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [logStatus, setLogStatus] = useState<LogStatus>("all");
  const [logWindow, setLogWindow] = useState<LogWindow>("7d");
  useEffect(() => {
    let active = true;
    fetch("/api/limitless/followup-drafts").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load drafts.");
      if (active) { setProperties(data.properties || []); setTemplateReady(Boolean(data.templateReady)); setTemplateStatus(String(data.templateStatus || "unverified")); setDrafts((data.drafts || []).filter((draft: Record<string, any>) => draft.status === "draft")); setDeliveryHistory((data.drafts || []).filter((draft: Record<string, any>) => ["sent","failed"].includes(draft.status))); }
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Unable to load follow-up drafts."); })
      .finally(() => { if (active) setDraftsLoading(false); });
    return () => { active = false; };
  }, []);
  const selectedProperty = properties.find(property => property.id === selectedPropertyId) || null;
  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLeadId || !selectedPropertyId || !draftReason.trim()) {
      setMessage("Choose a lead, choose a property, and enter a follow-up reason.");
      return;
    }
    setDraftBusy("create"); setMessage("");
    try {
      const response = await fetch("/api/limitless/followup-drafts", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({lead_id:selectedLeadId,property_id:selectedPropertyId,reason:draftReason.trim(),message_context:draftNotes.trim()})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create follow-up draft.");
      setDrafts(current => [data.draft, ...current]);
      setDraftReason(""); setDraftNotes("");
      setMessage("Property-specific follow-up draft created. Confirm genuine customer permission before sending.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create follow-up draft."); }
    finally { setDraftBusy(""); }
  }
  async function reviewDraft(id: string, consentReceived: boolean) {
    setDraftBusy(id); setMessage("");
    try {
      const response = await fetch("/api/limitless/followup-drafts", {
        method:"PATCH",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({id,action:"confirm_consent",consent_received:consentReceived})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save consent confirmation.");
      setDrafts(current => current.map(draft => draft.id === id ? data.draft : draft));
      setMessage(data.note || "Consent confirmation saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save consent confirmation."); }
    finally { setDraftBusy(""); }
  }
  async function sendDraft(id: string) {
    setDraftBusy(id); setMessage("");
    try {
      const response = await fetch("/api/limitless/followup-drafts", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action:"send"})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send follow-up template.");
      setDrafts(current => current.filter(draft => draft.id !== id));
      setDeliveryHistory(current => [data.draft, ...current]);
      setMessage(data.note || "Follow-up template sent.");
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send follow-up."); }
    finally { setDraftBusy(""); }
  }
  const sequenceName = (item: FollowupEnrollment) => item.current_step
    ? `Maia follow-up · step ${item.current_step}`
    : "Maia follow-up";
  const filtered = useMemo(
    () => props.enrollments.filter((entry) => statusFilter === "all" || statusFilterKey(entry) === statusFilter),
    [props.enrollments, statusFilter],
  );
  const logs = useMemo(() => {
    const windows = { "24h": 86_400_000, "7d": 604_800_000, "30d": 2_592_000_000 };
    return props.logs.filter((entry) => {
      const status = String(entry.status || "").toLowerCase();
      const statusMatches = logStatus === "all"
        || (logStatus === "success" && ["success", "sent", "delivered", "completed"].includes(status))
        || (logStatus === "failed" && failureStatuses.has(status))
        || (logStatus === "blocked" && status === "blocked");
      if (!statusMatches) return false;
      if (logWindow === "all") return true;
      const timestamp = new Date(entry.created_at).getTime();
      return Number.isFinite(timestamp) && props.now - timestamp <= windows[logWindow];
    }).slice(0, 25);
  }, [props.logs, props.now, logStatus, logWindow]);

  async function request(action: string, item: FollowupEnrollment, scheduledAt?: string, reason?: string) {
    setBusy(true);
    setMessage("");
    try {
      if (!item.customer_id || !item.sequence_id || item.sequence_id === "legacy-follow-up") {
        throw new Error("Exact customer and sequence identity is required for this control.");
      }
      const controlReason = reason || `operator_${action}`;
      const response = await fetch("/api/admin/followups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: item.customer_id,
          property_id: item.property_id,
          sequence_id: item.sequence_id,
          step_id: item.id,
          action,
          reason: controlReason,
          scheduled_at: scheduledAt,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update follow-up.");
      setMessage(action === "stop"
        ? "Follow-up sequence stopped."
        : action === "close" ? "Deal marked closed; future follow-ups cancelled." : "Follow-up updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update follow-up.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="followup-center" aria-busy={draftsLoading}>
    {props.loadError ? <section className="admin-panel" role="alert"><div className="admin-list-row compact attention-danger"><div><strong>Live follow-up data is unavailable</strong><span>{props.loadError} Draft review and sequence controls are disabled until the records load correctly.</span></div><em>Read-only fallback</em></div></section> : null}
    {!props.configured ? <section className="admin-panel"><div className="admin-list-row compact"><div><strong>Follow-up setup needs attention</strong><span>Supabase configuration is required before Maia follow-ups can be managed.</span></div><em>Setup required</em></div></section> : null}
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Maia follow-up engine</h2><p>Maia creates follow-ups on days 1, 3, 7, 14, 21 and 30 at the tenant&apos;s preferred Africa/Lagos send time, then checks in every 14 days until consent is withdrawn or an authorized operator stops/closes the deal.</p></div><span className="admin-status live">Maia managed</span></div>
      <div className="admin-list-row compact"><div><strong>Runtime-aligned controls</strong><span>Manual sequence creation and enrollment are hidden because Maia owns this tenant&apos;s follow-up schedule.</span></div></div>
    </section>
    {props.automationIssues > 0 ? <section className="admin-panel"><div className="admin-list-row compact attention-danger"><div><strong>Automation needs attention</strong><span>{props.automationIssues} recent follow-up action(s) failed or were blocked.</span></div><em>{props.automationIssues} issue(s)</em></div></section> : null}
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Create property-specific follow-up</h2><p>Select the lead and the exact property to include in the reminder. Property details are loaded from the Limitless Realty catalogue.</p></div></div>
      <form className="followup-record" onSubmit={createDraft}>
        <div style={{padding:"14px",display:"grid",gap:"12px"}}>
          <label>Customer
            <select value={selectedLeadId} onChange={event=>setSelectedLeadId(event.target.value)} required>
              <option value="">Select a lead</option>
              {props.leads.map(lead=><option key={lead.id} value={lead.id}>{lead.name} · {lead.phone}</option>)}
            </select>
          </label>
          <label>Property to include in the reminder
            <select value={selectedPropertyId} onChange={event=>setSelectedPropertyId(event.target.value)} required>
              <option value="">Select a Limitless Realty property</option>
              {properties.map(property=><option key={property.id} value={property.id}>{property.title}{property.location_city ? " · " + property.location_city : ""}</option>)}
            </select>
          </label>
          {selectedProperty ? <div className="admin-list-row compact"><div>
            <strong>{selectedProperty.title}</strong>
            <span>{[selectedProperty.type,selectedProperty.estate?.name,[selectedProperty.location_area,selectedProperty.location_city].filter(Boolean).join(", "),selectedProperty.price!==null&&selectedProperty.price!==undefined?"₦"+Number(selectedProperty.price).toLocaleString("en-NG"):null,selectedProperty.size_sqm?selectedProperty.size_sqm+" sqm":null,selectedProperty.status].filter(Boolean).join(" · ")}</span>
            {selectedProperty.features ? <small>{selectedProperty.features}</small> : null}
          </div></div> : null}
          <label>Follow-up reason
            <input value={draftReason} onChange={event=>setDraftReason(event.target.value)} placeholder="e.g. Customer requested details about this property" required />
          </label>
          <label>Message context for the customer (optional)
            <textarea value={draftNotes} onChange={event=>setDraftNotes(event.target.value)} rows={3} placeholder="Add context you want included in the customer-facing follow-up" />
          </label>
          <div className="followup-actions"><button type="submit" disabled={Boolean(draftBusy)||!props.leads.length||!properties.length}>{draftBusy==="create"?"Creating draft…":"Create follow-up draft"}</button></div>
          {!properties.length ? <small>No properties are currently available in this organisation.</small> : null}
          {!props.leads.length ? <small>No leads are available to select.</small> : null}
        </div>
      </form>
    </section>
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Manual follow-up drafts</h2><p>Before activation, confirm whether the customer genuinely gave permission to receive follow-up messages. This records the admin attestation; it does not itself send a message.</p></div><span className="admin-status warning">{drafts.length} pending</span></div>
      {!templateReady ? <div className="admin-list-row compact attention-danger"><div><strong>WhatsApp template verification required</strong><span>Sending is disabled because limitless_realty_reminder is currently marked {templateStatus}, or its approved four-variable order has not been verified.</span></div></div> : null}
      <div className="followup-records">
        {drafts.map(draft => <article key={draft.id} className="followup-record"><div style={{padding:"14px"}}>
          <strong>{draft.leads?.name || "Lead"} · {draft.properties?.title || "Property"}</strong>
          <p><b>Reason:</b> {draft.reason}</p>{draft.notes ? <p><b>Notes:</b> {draft.notes}</p> : null}
          <small>System assessment: {draft.eligibility_snapshot?.system_recommendation || "Review required"} · Created {formatDate(draft.created_at)}</small>
          {draft.eligibility_snapshot?.opted_out ? <p role="alert">Customer opt-out is recorded. Neither answer can override the opt-out.</p> : null}
          {draft.eligibility_snapshot?.consent_confirmation ? <small>Last confirmation: {draft.eligibility_snapshot.consent_confirmation.received ? "Yes, permission received" : "No, permission not received"} · {formatDate(draft.eligibility_snapshot.consent_confirmation.confirmed_at)}</small> : null}
          <p><b>Was customer permission received for follow-up messages?</b></p>
          <div className="followup-actions">
            <button disabled={Boolean(draftBusy)||Boolean(draft.eligibility_snapshot?.opted_out)} onClick={()=>reviewDraft(String(draft.id),true)}>Yes, permission was received</button>
            <button disabled={Boolean(draftBusy)||Boolean(draft.eligibility_snapshot?.opted_out)} onClick={()=>reviewDraft(String(draft.id),false)}>No, permission was not received</button>
          </div>
          <small>Choose Yes only when the customer actually agreed, including verbally. The system records who confirmed and when. No keeps the draft inactive.</small>
          {draft.eligibility_snapshot?.consent_confirmation?.received === true && !draft.eligibility_snapshot?.opted_out ? <div className="followup-actions"><button disabled={Boolean(draftBusy)||!templateReady} onClick={()=>sendDraft(String(draft.id))}>Send follow-up template</button></div> : null}
        </div></article>)}
        {draftsLoading ? <p className="admin-empty" role="status">Loading manual follow-up drafts…</p> : null}
        {!draftsLoading && !drafts.length ? <p className="admin-empty">No pending manual follow-up drafts.</p> : null}
      </div>
    </section>
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Manual follow-up delivery history</h2><p>Sent messages leave Drafts. Failed attempts remain visible for review.</p></div><span className="admin-status live">{deliveryHistory.filter(item=>item.status==="sent").length} sent</span></div>
      <div className="followup-records">
        {deliveryHistory.map(item => <article key={item.id} className="followup-record"><div style={{padding:"14px"}}>
          <strong>{item.leads?.name || "Lead"} · {item.properties?.title || "Property"}</strong>
          <p><span className={item.status==="sent"?"admin-status live":"admin-status warning"}>{item.status==="sent"?"Sent":"Failed"}</span> · {formatDate(item.sent_at || item.updated_at)}</p>
          {item.provider_message_id ? <small>Provider message ID: {item.provider_message_id}</small> : null}
          {item.delivery_error ? <p role="alert">{item.delivery_error}</p> : null}
        </div></article>)}
        {!deliveryHistory.length ? <p className="admin-empty">No manual follow-up messages sent or failed yet.</p> : null}
      </div>
    </section>
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Client-property follow-ups</h2><p>Review each property-specific sequence, consent state, next action, delivery attempts and safe error summary. Pause/resume is temporary; Close deal records a terminal business outcome.</p></div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
          <option value="active">Active</option><option value="paused">Paused</option><option value="failed">Failed · eligible for retry</option><option value="unknown">Needs review · no retry</option><option value="opted_out">Customer opted out</option><option value="stopped">Admin stopped</option><option value="closed">Deal closed</option><option value="completed">Completed step</option><option value="cancelled">Cancelled</option><option value="all">All</option>
        </select>
      </div>
      <div className="followup-records">
        {filtered.map((item) => {
          const hasExactSequence = item.sequence_id !== "legacy-follow-up" && Boolean(item.customer_id && item.property_id);
          const sequenceMutable = ["active", "paused"].includes(String(item.sequence_status));
          return <details key={item.id} className="followup-record">
            <summary><span><strong>{item.lead_name || "Unnamed lead"}</strong><small>{sequenceName(item)} · {item.property_title || "Property not identified"} · {statusLabel(item)}</small></span><span><time>{item.next_run_at ? formatDate(item.next_run_at) : "No next action"}</time><ChevronDown size={16}/></span></summary>
            <div className="followup-record-body">
              <dl>
                <div><dt>Property</dt><dd>{item.property_title || item.property_id || "Not linked"}</dd></div>
                <div><dt>Consent</dt><dd>{item.consent_state || "Unknown"}</dd></div>
                <div><dt>Sequence state</dt><dd>{item.sequence_status || item.status}</dd></div>
                <div><dt>Next follow-up</dt><dd>{formatDate(item.next_run_at)}</dd></div>
                <div><dt>Last attempt</dt><dd>{formatDate(item.last_run_at)}</dd></div>
                <div><dt>Attempts</dt><dd>{item.attempt_count}</dd></div>
                <div><dt>Reason</dt><dd>{item.stop_reason || item.control_reason || item.pause_reason || "-"}</dd></div>
                <div><dt>Actor</dt><dd>{item.stop_actor || "-"}</dd></div>
                <div><dt>Safe error summary</dt><dd>{item.error_summary || "-"}</dd></div>
              </dl>
              <div className="followup-actions">
                {hasExactSequence && sequenceMutable ? <>
                  {item.sequence_status === "active" ? <button disabled={busy} onClick={() => request("pause", item, undefined, "admin_pause")}><Pause size={14}/> Pause sequence</button> : null}
                  {item.sequence_status === "paused" && item.consent_state === "opted_in" ? <button disabled={busy} onClick={() => request("resume", item, undefined, "admin_resume")}><Play size={14}/> Resume sequence</button> : null}
                  <button disabled={busy} onClick={() => request("stop", item, undefined, "admin_manual_stop")}><XCircle size={14}/> Stop sequence</button>
                  <button disabled={busy} onClick={() => request("close", item, undefined, "deal_closed")}><XCircle size={14}/> Close deal</button>
                  {item.status === "active" ? <label title="Reschedule"><Clock3 size={14}/><input type="datetime-local" disabled={busy} onChange={(event) => event.target.value && request("reschedule", item, new Date(event.target.value).toISOString(), "operator_reschedule")}/></label> : null}
                </> : null}
                {hasExactSequence && sequenceMutable && item.status === "failed" ? <button disabled={busy} onClick={() => request("retry", item, undefined, "manual_retry")}><RotateCcw size={14}/> Retry failed step</button> : null}
                {!hasExactSequence ? <span>Legacy follow-up: sequence controls unavailable</span> : null}
                {(item.sequence_status === "opted_out" || item.consent_state === "opted_out") ? <span>Customer opt-out is active. A new explicit consent event is required; Resume is disabled.</span> : null}
              </div>
            </div>
          </details>;
        })}
        {!filtered.length ? <p className="admin-empty">No follow-ups match this view.</p> : null}
      </div>
    </section>
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Execution log</h2><p>Recent Maia follow-up activity and sanitized failure summaries.</p></div><div className="followup-log-filters"><select aria-label="Execution status" value={logStatus} onChange={(event) => setLogStatus(event.target.value as LogStatus)}><option value="all">All statuses</option><option value="success">Successful</option><option value="failed">Failed</option><option value="blocked">Blocked</option></select><select aria-label="Execution time range" value={logWindow} onChange={(event) => setLogWindow(event.target.value as LogWindow)}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All available</option></select></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Lead</th><th>Property / step</th><th>Channel</th><th>Status</th><th>Attempts</th><th>Safe error summary</th><th>Time (Lagos)</th></tr></thead><tbody>
        {logs.map((entry) => <tr key={entry.id}><td><strong>{props.enrollments.find((enrollment) => enrollment.lead_id === entry.lead_id)?.lead_name || "Unknown lead"}</strong></td><td>{props.enrollments.find((enrollment) => enrollment.id === entry.enrollment_id)?.property_title || "Property"} · {entry.step_id}</td><td>{entry.channel || "-"}</td><td><span className={`admin-status ${warningStatuses.has(String(entry.status).toLowerCase()) ? "warning" : "live"}`}>{entry.status || "unknown"}</span></td><td>{entry.attempt_count}</td><td>{entry.error_message || "-"}</td><td>{formatDate(entry.executed_at || entry.created_at)}</td></tr>)}
        {!logs.length ? <tr><td colSpan={7}>No execution records match this view.</td></tr> : null}
      </tbody></table></div><p className="admin-empty">Showing up to 25 matching records. Provider IDs and raw response payloads are not displayed.</p>
    </section>
    {message ? <p className="admin-form-message">{message}</p> : null}
    <style jsx>{`.followup-center{display:grid;gap:16px;min-width:0;min-height:320px}.followup-records{min-width:0}.followup-log-filters{display:flex;gap:8px;flex-wrap:wrap}.followup-log-filters select{min-width:150px}.admin-table td{vertical-align:top;max-width:320px;word-break:break-word}@media(max-width:760px){.followup-log-filters{width:100%}.followup-log-filters select{width:100%}}`}</style>
  </div>;
}
