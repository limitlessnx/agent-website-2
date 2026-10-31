"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock3, Pause, Play, RotateCcw, XCircle } from "@/components/admin/ServerIcons";
import type { FollowupEnrollment, FollowupLog } from "@/lib/followup-control";

type LeadOption = { id: string; name: string; phone: string };
type Props = {
  leads: LeadOption[];
  sequences: unknown[];
  steps: unknown[];
  enrollments: FollowupEnrollment[];
  logs: FollowupLog[];
  configured: boolean;
  automationIssues: number;
  now: number;
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
  const [draftBusy, setDraftBusy] = useState("");
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [logStatus, setLogStatus] = useState<LogStatus>("all");
  const [logWindow, setLogWindow] = useState<LogWindow>("7d");
  useEffect(() => {
    let active = true;
    fetch("/api/limitless/followup-drafts").then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load drafts.");
      if (active) setDrafts((data.drafts || []).filter((draft: Record<string, any>) => draft.status === "draft"));
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : "Unable to load follow-up drafts."); });
    return () => { active = false; };
  }, []);
  async function reviewDraft(id: string, action: "approve" | "reject") {
    setDraftBusy(id); setMessage("");
    try {
      const response = await fetch("/api/limitless/followup-drafts", {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to review draft.");
      setDrafts(current => current.filter(draft => draft.id !== id));
      setMessage(data.note || "Draft review saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to review draft."); }
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

  return <div className="followup-center">
    {!props.configured ? <section className="admin-panel"><div className="admin-list-row compact"><div><strong>Follow-up setup needs attention</strong><span>Supabase configuration is required before Maia follow-ups can be managed.</span></div><em>Setup required</em></div></section> : null}
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Maia follow-up engine</h2><p>Maia creates follow-ups on days 1, 3, 7, 14, 21 and 30 at the tenant&apos;s preferred Africa/Lagos send time, then checks in every 14 days until consent is withdrawn or an authorized operator stops/closes the deal.</p></div><span className="admin-status live">Maia managed</span></div>
      <div className="admin-list-row compact"><div><strong>Runtime-aligned controls</strong><span>Manual sequence creation and enrollment are hidden because Maia owns this tenant&apos;s follow-up schedule.</span></div></div>
    </section>
    {props.automationIssues > 0 ? <section className="admin-panel"><div className="admin-list-row compact attention-danger"><div><strong>Automation needs attention</strong><span>{props.automationIssues} recent follow-up action(s) failed or were blocked.</span></div><em>{props.automationIssues} issue(s)</em></div></section> : null}
    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Manual follow-up drafts</h2><p>Review drafts created from individual lead cards. Approval records your decision; it does not bypass customer consent or start messaging.</p></div><span className="admin-status warning">{drafts.length} pending</span></div>
      <div className="followup-records">
        {drafts.map(draft => <article key={draft.id} className="followup-record"><div style={{padding:"14px"}}>
          <strong>{draft.leads?.name || "Lead"} · {draft.properties?.title || "Property"}</strong>
          <p><b>Reason:</b> {draft.reason}</p>{draft.notes ? <p><b>Notes:</b> {draft.notes}</p> : null}
          <small>System assessment: {draft.eligibility_snapshot?.system_recommendation || "Review required"} · Created {formatDate(draft.created_at)}</small>
          {draft.eligibility_snapshot?.opted_out ? <p role="alert">Customer opt-out is recorded. Approval cannot authorize messaging.</p> : null}
          <div className="followup-actions"><button disabled={Boolean(draftBusy)} onClick={()=>reviewDraft(String(draft.id),"approve")}>Approve draft</button><button disabled={Boolean(draftBusy)} onClick={()=>reviewDraft(String(draft.id),"reject")}>Reject</button></div>
        </div></article>)}
        {!drafts.length ? <p className="admin-empty">No pending manual follow-up drafts.</p> : null}
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
    <style jsx>{`.followup-log-filters{display:flex;gap:8px;flex-wrap:wrap}.followup-log-filters select{min-width:150px}.admin-table td{vertical-align:top;max-width:320px;word-break:break-word}@media(max-width:760px){.followup-log-filters{width:100%}.followup-log-filters select{width:100%}}`}</style>
  </div>;
}
