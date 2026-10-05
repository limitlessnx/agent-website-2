"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock3, Pause, Play, RotateCcw, XCircle } from "@/components/admin/ServerIcons";
import type { FollowupEnrollment, FollowupLog } from "@/lib/followup-control";

type LeadOption={id:string;name:string;phone:string};
type Props={leads:LeadOption[];sequences:unknown[];steps:unknown[];enrollments:FollowupEnrollment[];logs:FollowupLog[];configured:boolean;automationIssues:number};
type StatusFilter="active"|"paused"|"failed"|"completed"|"cancelled"|"all";
type LogStatus="all"|"success"|"failed"|"blocked";
type LogWindow="24h"|"7d"|"30d"|"all";
const failureStatuses=new Set(["failed","error"]);
function formatDate(value:string|null){if(!value)return "-";const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleString("en-NG");}

export default function FollowupControlCenter(props:Props){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[statusFilter,setStatusFilter]=useState<StatusFilter>("active"),[logStatus,setLogStatus]=useState<LogStatus>("all"),[logWindow,setLogWindow]=useState<LogWindow>("7d");
 const sequenceName=(item:FollowupEnrollment)=>item.current_step?"Maia follow-up · step "+item.current_step:"Maia follow-up";
 const filtered=useMemo(()=>props.enrollments.filter(x=>statusFilter==="all"||x.status===statusFilter),[props.enrollments,statusFilter]);
 const logs=useMemo(()=>{const now=Date.now(),windows={"24h":86400000,"7d":604800000,"30d":2592000000};return props.logs.filter(x=>{const s=String(x.status||"").toLowerCase();const ok=logStatus==="all"||(logStatus==="success"&&["success","sent","delivered","completed"].includes(s))||(logStatus==="failed"&&failureStatuses.has(s))||(logStatus==="blocked"&&s==="blocked");if(!ok)return false;if(logWindow==="all")return true;const t=new Date(x.created_at).getTime();return Number.isFinite(t)&&now-t<=windows[logWindow];}).slice(0,25);},[props.logs,logStatus,logWindow]);
 async function request(action:string,id:string,value?:string){setBusy(true);setMessage("");try{const res=await fetch("/api/admin/followups",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({organization_id:"limitless-realty",id,action,value})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Unable to update follow-up.");setMessage("Follow-up updated.");router.refresh();}catch(e){setMessage(e instanceof Error?e.message:"Unable to update follow-up.");}finally{setBusy(false);}}
 return <div className="followup-center">
  {!props.configured?<section className="admin-panel"><div className="admin-list-row compact"><div><strong>Follow-up setup needs attention</strong><span>Supabase configuration is required before Maia follow-ups can be managed.</span></div><em>Setup required</em></div></section>:null}
  <section className="admin-panel"><div className="admin-panel-header"><div><h2>Maia follow-up engine</h2><p>Maia automatically creates the built-in 1, 3, 7, 14, 21 and 30-day follow-ups. This dashboard manages scheduled actions already in the runtime.</p></div><span className="admin-status live">Maia managed</span></div><div className="admin-list-row compact"><div><strong>Runtime-aligned controls</strong><span>Manual sequence creation and enrollment are intentionally hidden because Maia owns this tenant's follow-up schedule.</span></div></div></section>
  {props.automationIssues>0?<section className="admin-panel"><div className="admin-list-row compact attention-danger"><div><strong>Automation needs attention</strong><span>{props.automationIssues} recent follow-up action(s) failed or were blocked.</span></div><em>{props.automationIssues} issue(s)</em></div></section>:null}
  <section className="admin-panel"><div className="admin-panel-header"><div><h2>Follow-ups</h2><p>Reschedule, pause, complete or cancel an individual Maia follow-up.</p></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as StatusFilter)}><option value="active">Active</option><option value="paused">Paused</option><option value="failed">Needs attention</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="all">All</option></select></div>
   <div className="followup-records">{filtered.map(item=><details key={item.id} className="followup-record"><summary><span><strong>{item.lead_name||"Unnamed lead"}</strong><small>{sequenceName(item)} · {item.status}</small></span><span><time>{item.next_run_at?formatDate(item.next_run_at):"No next action"}</time><ChevronDown size={16}/></span></summary>
    <div className="followup-record-body"><dl><div><dt>Phone</dt><dd>{item.lead_phone||"-"}</dd></div><div><dt>Last action</dt><dd>{formatDate(item.last_run_at)}</dd></div><div><dt>Status</dt><dd>{item.status}</dd></div></dl><div className="followup-actions">
     {item.status==="active"?<button disabled={busy} onClick={()=>request("pause",item.id)}><Pause size={14}/> Pause</button>:item.status==="paused"?<button disabled={busy} onClick={()=>request("resume",item.id)}><Play size={14}/> Resume</button>:null}
     {item.status==="active"||item.status==="paused"?<label title="Reschedule"><Clock3 size={14}/><input type="datetime-local" disabled={busy} onChange={e=>e.target.value&&request("reschedule",item.id,new Date(e.target.value).toISOString())}/></label>:null}
     {item.status==="active"||item.status==="paused"?<button disabled={busy} onClick={()=>request("complete",item.id)}><RotateCcw size={14}/> Mark complete</button>:null}
     {item.status!=="completed"&&item.status!=="cancelled"?<button disabled={busy} onClick={()=>request("cancel",item.id)}><XCircle size={14}/> Cancel</button>:null}
    </div></div></details>)}{!filtered.length?<p className="admin-empty">No follow-ups match this view.</p>:null}</div>
  </section>
  <section className="admin-panel"><div className="admin-panel-header"><div><h2>Execution log</h2><p>Recent Maia follow-up activity and failures.</p></div><div className="followup-log-filters"><select aria-label="Execution status" value={logStatus} onChange={e=>setLogStatus(e.target.value as LogStatus)}><option value="all">All statuses</option><option value="success">Successful</option><option value="failed">Failed</option><option value="blocked">Blocked</option></select><select aria-label="Execution time range" value={logWindow} onChange={e=>setLogWindow(e.target.value as LogWindow)}><option value="24h">Last 24 hours</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="all">All available</option></select></div></div>
   <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Lead</th><th>Stage</th><th>Channel</th><th>Status</th><th>Time</th></tr></thead><tbody>{logs.map(x=><tr key={x.id}><td><strong>{props.enrollments.find(e=>e.lead_id===x.lead_id)?.lead_name||"Unknown lead"}</strong></td><td>{x.step_id}</td><td>{x.channel||"-"}</td><td><span className={"admin-status "+(failureStatuses.has(String(x.status).toLowerCase())||String(x.status).toLowerCase()==="blocked"?"warning":"live")}>{x.status||"unknown"}</span></td><td>{formatDate(x.executed_at||x.created_at)}</td></tr>)}{!logs.length?<tr><td colSpan={5}>No execution records match this view.</td></tr>:null}</tbody></table></div><p className="admin-empty">Showing up to 25 matching records.</p>
  </section>
  {message?<p className="admin-form-message">{message}</p>:null}
  <style jsx>{\`.followup-log-filters{display:flex;gap:8px;flex-wrap:wrap}.followup-log-filters select{min-width:150px}.admin-table td{vertical-align:top;max-width:320px;word-break:break-word}@media(max-width:760px){.followup-log-filters{width:100%}.followup-log-filters select{width:100%}}\`}
 </div>;
}
