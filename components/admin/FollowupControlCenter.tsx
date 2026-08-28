"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock3, Pause, Play, Plus, RotateCcw, Send, SkipForward, XCircle } from "@/components/admin/ServerIcons";
import type { FollowupEnrollment, FollowupLog, FollowupSequence, FollowupStep } from "@/lib/followup-control";

type LeadOption = { id:string; name:string; phone:string };
type Props = { leads:LeadOption[]; sequences:FollowupSequence[]; steps:FollowupStep[]; enrollments:FollowupEnrollment[]; logs:FollowupLog[]; configured:boolean; automationIssues:number };
type DraftStep = { channel:string; delay_value:number; delay_unit:string; title:string; message_template:string };
type LogStatus = "all" | "success" | "failed" | "blocked";
type LogWindow = "24h" | "7d" | "30d" | "all";

const blankStep = ():DraftStep => ({ channel:"whatsapp", delay_value:1, delay_unit:"days", title:"", message_template:"" });
const failureStatuses = new Set(["failed", "error"]);

function formatDate(value:string|null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-NG");
}

export default function FollowupControlCenter(props:Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [sequenceId, setSequenceId] = useState(props.sequences[0]?.id || "");
  const [startAt, setStartAt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<DraftStep[]>([blankStep()]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [logStatus, setLogStatus] = useState<LogStatus>("all");
  const [logWindow, setLogWindow] = useState<LogWindow>("7d");

  const filteredEnrollments = useMemo(() => props.enrollments.filter((item) => statusFilter === "all" || item.status === statusFilter), [props.enrollments,statusFilter]);
  const sequenceName = (id:string|null) => props.sequences.find((item)=>item.id===id)?.name || "Unknown sequence";
  const leadName = (leadId:string|null) => props.leads.find((item)=>item.id===leadId)?.name || props.enrollments.find((item)=>item.lead_id===leadId)?.lead_name || "Unknown lead";

  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const windows:Record<Exclude<LogWindow,"all">,number> = { "24h":86400000, "7d":604800000, "30d":2592000000 };
    return props.logs.filter((item) => {
      const status = String(item.status || "").toLowerCase();
      const statusMatches = logStatus === "all"
        || (logStatus === "success" && ["success", "sent", "delivered", "completed"].includes(status))
        || (logStatus === "failed" && failureStatuses.has(status))
        || (logStatus === "blocked" && status === "blocked");
      if (!statusMatches) return false;
      if (logWindow === "all") return true;
      const created = new Date(item.created_at).getTime();
      return Number.isFinite(created) && now - created <= windows[logWindow];
    }).slice(0, 25);
  }, [logStatus, logWindow, props.logs]);

  async function request(method:string, body:Record<string,unknown>) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/followups", { method, headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to update follow-ups.");
      setMessage("Saved successfully."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update follow-ups."); }
    finally { setBusy(false); }
  }

  async function createSequence(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await request("POST", { type:"sequence", organization_id:"limitless-realty", name:String(data.get("name")||""), description:String(data.get("description")||""), steps:steps.map((step,index)=>({ ...step, workflow_id:"", position:index+1, enabled:true })) });
  }

  async function enrollSelected() {
    const leads = props.leads.filter((lead)=>selected.includes(lead.id));
    await request("POST", { type:"enroll", organization_id:"limitless-realty", sequence_id:sequenceId, start_at:startAt ? new Date(startAt).toISOString() : undefined, leads });
    setSelected([]);
  }

  function updateStep(index:number, field:keyof DraftStep, value:string|number) {
    setSteps((current)=>current.map((step,i)=>i===index ? {...step,[field]:value} : step));
  }

  return <div className="followup-center">
    {!props.configured ? <section className="admin-panel"><div className="admin-list-row compact"><div><strong>Follow-up setup needs attention</strong><span>Complete the platform setup before saving sequences or enrollments.</span></div><em>Setup required</em></div></section> : null}
    {props.automationIssues > 0 ? <section className="admin-panel"><div className="admin-list-row compact attention-danger"><div><strong>Automation needs attention</strong><span>{props.automationIssues} recent follow-up action(s) failed or were blocked. Review the execution log below before retrying.</span></div><em>{props.automationIssues} issue(s)</em></div></section> : null}

    <section className="admin-panel followup-toolbar">
      <div className="admin-panel-header"><div><h2>Assign follow-up</h2><p>Select any leads, choose a sequence and schedule the start.</p></div><span className="admin-status live">{selected.length} selected</span></div>
      <details className="followup-details">
        <summary><span>Choose leads</span><ChevronDown size={16}/></summary>
        <div className="followup-lead-picker">
          {props.leads.map((lead)=><label key={lead.id}><input type="checkbox" checked={selected.includes(lead.id)} onChange={(event)=>setSelected((current)=>event.target.checked?[...current,lead.id]:current.filter((id)=>id!==lead.id))}/><span><strong>{lead.name || "Unnamed lead"}</strong><small>{lead.phone || "No phone"}</small></span></label>)}
        </div>
      </details>
      <div className="followup-assign-row">
        <select value={sequenceId} onChange={(event)=>setSequenceId(event.target.value)}><option value="">Choose sequence</option>{props.sequences.filter((item)=>item.status==="active").map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <input type="datetime-local" value={startAt} onChange={(event)=>setStartAt(event.target.value)} aria-label="Sequence start time" />
        <button className="admin-button" type="button" disabled={busy || !selected.length || !sequenceId} onClick={enrollSelected}><Send size={15}/> Assign</button>
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-header"><div><h2>Active reminders and follow-ups</h2><p>Pause, resume, reschedule, skip or cancel from one place.</p></div><select value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="failed">Needs attention</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="all">All</option></select></div>
      <div className="followup-records">
        {filteredEnrollments.map((item)=><details key={item.id} className="followup-record">
          <summary><span><strong>{item.lead_name || "Unnamed lead"}</strong><small>{sequenceName(item.sequence_id)} · step {item.current_step} · {item.status}</small></span><span><time>{item.next_run_at ? new Date(item.next_run_at).toLocaleString("en-NG") : "No next action"}</time><ChevronDown size={16}/></span></summary>
          <div className="followup-record-body">
            <dl><div><dt>Phone</dt><dd>{item.lead_phone || "-"}</dd></div><div><dt>Last action</dt><dd>{item.last_run_at ? new Date(item.last_run_at).toLocaleString("en-NG") : "Never"}</dd></div><div><dt>Status</dt><dd>{item.status}</dd></div></dl>
            <div className="followup-actions">
              {item.status === "active" ? <button onClick={()=>request("PATCH",{id:item.id,action:"pause"})}><Pause size={14}/> Pause</button> : <button onClick={()=>request("PATCH",{id:item.id,action:"resume"})}><Play size={14}/> Resume</button>}
              <label><Clock3 size={14}/><input type="datetime-local" onChange={(event)=>event.target.value && request("PATCH",{id:item.id,action:"reschedule",value:new Date(event.target.value).toISOString()})}/></label>
              <button onClick={()=>request("PATCH",{id:item.id,action:"skip",value:String(item.current_step+1)})}><SkipForward size={14}/> Skip step</button>
              <button onClick={()=>request("PATCH",{id:item.id,action:"complete"})}><RotateCcw size={14}/> Complete</button>
              <button onClick={()=>request("PATCH",{id:item.id,action:"cancel"})}><XCircle size={14}/> Cancel</button>
            </div>
          </div>
        </details>)}
        {!filteredEnrollments.length ? <p className="admin-empty">No follow-ups match this view.</p> : null}
      </div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-header">
        <div><h2>Execution log</h2><p>See what Maia attempted, what succeeded, and the exact reason anything failed or was blocked.</p></div>
        <div className="followup-log-filters">
          <select aria-label="Execution status" value={logStatus} onChange={(event)=>setLogStatus(event.target.value as LogStatus)}><option value="all">All statuses</option><option value="success">Successful</option><option value="failed">Failed</option><option value="blocked">Blocked</option></select>
          <select aria-label="Execution time range" value={logWindow} onChange={(event)=>setLogWindow(event.target.value as LogWindow)}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All available</option></select>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Lead</th><th>Sequence</th><th>Channel</th><th>Status</th><th>Reason</th><th>Time</th></tr></thead>
          <tbody>
            {filteredLogs.map((item)=><tr key={item.id}>
              <td><strong>{leadName(item.lead_id)}</strong></td>
              <td>{sequenceName(item.sequence_id)}</td>
              <td>{item.channel || "-"}</td>
              <td><span className={`admin-status ${failureStatuses.has(String(item.status).toLowerCase()) || String(item.status).toLowerCase()==="blocked" ? "warning" : "live"}`}>{item.status || "unknown"}</span></td>
              <td>{item.error_message || "-"}</td>
              <td>{formatDate(item.executed_at || item.created_at)}</td>
            </tr>)}
            {!filteredLogs.length ? <tr><td colSpan={6}>No execution records match this view.</td></tr> : null}
          </tbody>
        </table>
      </div>
      <p className="admin-empty">Showing up to 25 matching execution records from the latest 100 retained by the control reader.</p>
    </section>

    <section className="admin-panel">
      <details className="followup-details">
        <summary><span><Plus size={16}/> Create editable sequence</span><ChevronDown size={16}/></summary>
        <form className="followup-builder" onSubmit={createSequence}>
          <div className="admin-form-grid"><input name="name" placeholder="Sequence name" required/><input name="description" placeholder="Short description"/></div>
          <div className="followup-steps">
            {steps.map((step,index)=><article key={index}><header><strong>Step {index+1}</strong>{steps.length>1?<button type="button" onClick={()=>setSteps((current)=>current.filter((_,i)=>i!==index))}>Remove</button>:null}</header><div className="admin-form-grid compact">
              <select value={step.channel} onChange={(e)=>updateStep(index,"channel",e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="call">Outbound call</option><option value="telegram">Telegram</option><option value="task">Manual task</option></select>
              <input type="number" min="0" value={step.delay_value} onChange={(e)=>updateStep(index,"delay_value",Number(e.target.value))}/><select value={step.delay_unit} onChange={(e)=>updateStep(index,"delay_unit",e.target.value)}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select>
              <input value={step.title} onChange={(e)=>updateStep(index,"title",e.target.value)} placeholder="Step title"/><textarea value={step.message_template} onChange={(e)=>updateStep(index,"message_template",e.target.value)} placeholder="Message or instructions"/>
            </div></article>)}
          </div>
          <div className="followup-builder-actions"><button type="button" className="admin-button secondary" onClick={()=>setSteps((current)=>[...current,blankStep()])}><Plus size={14}/> Add step</button><button className="admin-button" disabled={busy || !props.configured}>Save sequence</button></div>
        </form>
      </details>
    </section>
    {message ? <p className="admin-form-message">{message}</p> : null}
    <style jsx>{`
      .followup-log-filters{display:flex;gap:8px;flex-wrap:wrap}.followup-log-filters select{min-width:150px}.admin-table td{vertical-align:top;max-width:320px;word-break:break-word}@media(max-width:760px){.followup-log-filters{width:100%}.followup-log-filters select{width:100%}}
    `}</style>
  </div>;
}
