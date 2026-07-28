"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Clock3, Pause, Play, Plus, RotateCcw, Send, SkipForward, XCircle } from "lucide-react";
import type { FollowupEnrollment, FollowupSequence, FollowupStep } from "@/lib/followup-control";

type LeadOption = { id:string; name:string; phone:string };
type WorkflowOption = { id:string; name:string; active:boolean };
type ExecutionOption = { id:string; workflowId:string; status?:string; startedAt?:string; stoppedAt?:string };
type Props = { leads:LeadOption[]; sequences:FollowupSequence[]; steps:FollowupStep[]; enrollments:FollowupEnrollment[]; workflows:WorkflowOption[]; executions:ExecutionOption[]; configured:boolean };
type DraftStep = { channel:string; delay_value:number; delay_unit:string; title:string; message_template:string; workflow_id:string };

const blankStep = ():DraftStep => ({ channel:"whatsapp", delay_value:1, delay_unit:"days", title:"", message_template:"", workflow_id:"" });

export default function FollowupControlCenter(props:Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [sequenceId, setSequenceId] = useState(props.sequences[0]?.id || "");
  const [startAt, setStartAt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<DraftStep[]>([blankStep()]);
  const [statusFilter, setStatusFilter] = useState("active");

  const filteredEnrollments = useMemo(() => props.enrollments.filter((item) => statusFilter === "all" || item.status === statusFilter), [props.enrollments,statusFilter]);
  const sequenceName = (id:string) => props.sequences.find((item)=>item.id===id)?.name || "Unknown sequence";

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
    await request("POST", { type:"sequence", organization_id:"limitless-realty", name:String(data.get("name")||""), description:String(data.get("description")||""), steps:steps.map((step,index)=>({ ...step, position:index+1, enabled:true })) });
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
    {!props.configured ? <section className="admin-panel"><div className="admin-list-row compact"><div><strong>Follow-up schema is not active</strong><span>Run the latest Supabase migration before saving sequences or enrollments.</span></div><em>Setup required</em></div></section> : null}

    <section className="admin-panel followup-toolbar">
      <div className="admin-panel-header"><div><h2>Assign follow-up</h2><p>Select any leads, choose a sequence and schedule the start.</p></div><span className="admin-status live">{selected.length} selected</span></div>
      <details className="followup-details" open>
        <summary><span>Lead selection</span><ChevronDown size={16}/></summary>
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
      <div className="admin-panel-header"><div><h2>Active reminders and follow-ups</h2><p>Pause, resume, reschedule, skip or cancel without opening n8n.</p></div><select value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value)}><option value="active">Active</option><option value="paused">Paused</option><option value="failed">Failed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="all">All</option></select></div>
      <div className="followup-records">
        {filteredEnrollments.map((item)=><details key={item.id} className="followup-record">
          <summary><span><strong>{item.lead_name || "Unnamed lead"}</strong><small>{sequenceName(item.sequence_id)} · step {item.current_step} · {item.status}</small></span><span><time>{item.next_run_at ? new Date(item.next_run_at).toLocaleString("en-NG") : "No next run"}</time><ChevronDown size={16}/></span></summary>
          <div className="followup-record-body">
            <dl><div><dt>Phone</dt><dd>{item.lead_phone || "-"}</dd></div><div><dt>Last run</dt><dd>{item.last_run_at ? new Date(item.last_run_at).toLocaleString("en-NG") : "Never"}</dd></div><div><dt>n8n execution</dt><dd>{item.n8n_execution_id || "Not linked"}</dd></div></dl>
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
      <details className="followup-details">
        <summary><span><Plus size={16}/> Create editable sequence</span><ChevronDown size={16}/></summary>
        <form className="followup-builder" onSubmit={createSequence}>
          <div className="admin-form-grid"><input name="name" placeholder="Sequence name" required/><input name="description" placeholder="Short description"/></div>
          <div className="followup-steps">
            {steps.map((step,index)=><article key={index}><header><strong>Step {index+1}</strong>{steps.length>1?<button type="button" onClick={()=>setSteps((current)=>current.filter((_,i)=>i!==index))}>Remove</button>:null}</header><div className="admin-form-grid compact">
              <select value={step.channel} onChange={(e)=>updateStep(index,"channel",e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="call">Outbound call</option><option value="telegram">Telegram</option><option value="task">Manual task</option></select>
              <select value={step.workflow_id} onChange={(e)=>updateStep(index,"workflow_id",e.target.value)}><option value="">No linked n8n workflow</option>{props.workflows.map((workflow)=><option key={workflow.id} value={workflow.id}>{workflow.name}{workflow.active?" · active":" · inactive"}</option>)}</select>
              <input type="number" min="0" value={step.delay_value} onChange={(e)=>updateStep(index,"delay_value",Number(e.target.value))}/><select value={step.delay_unit} onChange={(e)=>updateStep(index,"delay_unit",e.target.value)}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select>
              <input value={step.title} onChange={(e)=>updateStep(index,"title",e.target.value)} placeholder="Step title"/><textarea value={step.message_template} onChange={(e)=>updateStep(index,"message_template",e.target.value)} placeholder="Message or instructions"/>
            </div></article>)}
          </div>
          <div className="followup-builder-actions"><button type="button" className="admin-button secondary" onClick={()=>setSteps((current)=>[...current,blankStep()])}><Plus size={14}/> Add step</button><button className="admin-button" disabled={busy || !props.configured}>Save sequence</button></div>
        </form>
      </details>
    </section>

    <section className="admin-panel"><details className="followup-details"><summary><span>n8n reminders and executions</span><ChevronDown size={16}/></summary><div className="admin-list">
      {props.workflows.map((workflow)=><div className="admin-list-row compact" key={workflow.id}><div><strong>{workflow.name}</strong><span>Workflow ID: {workflow.id}</span></div><em>{workflow.active?"active":"inactive"}</em></div>)}
      {props.executions.map((execution)=><div className="admin-list-row compact" key={execution.id}><div><strong>Execution {execution.id}</strong><span>Workflow {execution.workflowId} · {execution.startedAt ? new Date(execution.startedAt).toLocaleString("en-NG") : "time unavailable"}</span></div><em>{execution.status || "unknown"}</em></div>)}
      {!props.workflows.length && !props.executions.length ? <p className="admin-empty">No follow-up or reminder workflows were discovered in n8n.</p> : null}
    </div></details></section>
    {message ? <p className="admin-form-message">{message}</p> : null}
  </div>;
}
