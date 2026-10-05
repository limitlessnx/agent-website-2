export type FollowupStep = { id:string; sequence_id:string; position:number; channel:"whatsapp"|"email"|"call"|"telegram"|"task"; delay_value:number; delay_unit:string; title:string|null; message_template:string|null; workflow_id:string|null; enabled:boolean };
export type FollowupSequence = { id:string; organization_id:string; name:string; description:string|null; status:string; created_at:string; updated_at:string };
export type FollowupEnrollment = { id:string; organization_id:string; sequence_id:string; lead_id:string; lead_name:string|null; lead_phone:string|null; status:string; current_step:number; next_run_at:string|null; last_run_at:string|null; n8n_execution_id:string|null; pause_reason:string|null; created_at:string; updated_at:string };
export type FollowupLog = { id:string; enrollment_id:string; sequence_id:string; step_id:string; organization_id:string; lead_id:string; channel:string|null; status:string|null; n8n_execution_id:string|null; scheduled_for:string|null; executed_at:string|null; error_message:string|null; created_at:string };
export type LegacyFollowup = { id:string; organization_id:string; lead_id:string; scheduled_at:string; message_sent:string|null; status:string; sent_at:string|null; stage:number; channel:string; agent_key:string; template_name:string|null; created_at:string|null };

import { isServerSupabaseConfigured, supabaseServerRequest } from "@/lib/supabase-server-rest";
async function load(org:string,limit=100){return isServerSupabaseConfigured()?supabaseServerRequest<LegacyFollowup[]>(`follow_ups?organization_id=eq.${encodeURIComponent(org)}&select=*&order=scheduled_at.asc&limit=${limit}`):[];}

export async function getFollowupControlSummary(organizationId="limitless-realty"){
  const rows=await load(organizationId);
  const leadIds=[...new Set(rows.map(r=>r.lead_id).filter(Boolean))];
  const leads=leadIds.length?await supabaseServerRequest<Array<{id:string;name:string|null;phone:string|null}>>(`leads?id=in.(${leadIds.map(encodeURIComponent).join(",")})&organization_id=eq.${encodeURIComponent(organizationId)}&select=id,name,phone`):[];
  const leadById=new Map(leads.map(l=>[l.id,l]));
  const now=Date.now();
  const status=(r:LegacyFollowup)=>r.status==="pending"||r.status==="scheduled"||r.status==="queued"?"active":r.status==="sent"?"completed":r.status;
  const active=rows.filter(r=>["pending","scheduled","queued"].includes(r.status));
  const due=active.filter(r=>new Date(r.scheduled_at).getTime()<=now);
  const upcoming=active.filter(r=>new Date(r.scheduled_at).getTime()>now);
  const overdue=due.filter(r=>now-new Date(r.scheduled_at).getTime()>=86400000);
  const failed=rows.filter(r=>r.status==="failed");
  const cancelled=rows.filter(r=>r.status==="cancelled");
  const enrollments=rows.map(r=>{const lead=leadById.get(r.lead_id);return {id:r.id,organization_id:r.organization_id,sequence_id:"legacy-follow-up",lead_id:r.lead_id,lead_name:lead?.name||null,lead_phone:lead?.phone||null,status:status(r),current_step:r.stage||0,next_run_at:["pending","scheduled","queued"].includes(r.status)?r.scheduled_at:null,last_run_at:r.sent_at,n8n_execution_id:null,pause_reason:null,created_at:r.created_at||r.scheduled_at,updated_at:r.sent_at||r.created_at||r.scheduled_at};}) as FollowupEnrollment[];
  return {
    configured:isServerSupabaseConfigured(),sequences:[] as FollowupSequence[],steps:[] as FollowupStep[],
    enrollments,
    logs:rows.map(r=>({id:r.id,enrollment_id:r.id,sequence_id:"legacy-follow-up",step_id:String(r.stage||0),organization_id:r.organization_id,lead_id:r.lead_id,channel:r.channel,status:r.status,n8n_execution_id:null,scheduled_for:r.scheduled_at,executed_at:r.sent_at,error_message:null,created_at:r.created_at||r.scheduled_at})) as FollowupLog[],
    workflows:[] as unknown[],executions:[] as unknown[],
    statusSummary:{upcoming:upcoming.length,due:due.length-overdue.length,overdue:overdue.length,completed:rows.filter(r=>r.status==="sent").length,failed:failed.length,cancelled:cancelled.length,paused:rows.filter(r=>r.status==="paused").length,unscheduled:rows.filter(r=>!r.scheduled_at).length}
  };
}
export async function createSequence(input:{organization_id:string;name:string;description?:string;steps:Array<{channel:string;delay_value:number;delay_unit:string;title?:string|null;message_template?:string|null;workflow_id?:string|null;enabled:boolean}>}):Promise<FollowupSequence>{void input;throw new Error("Custom follow-up sequences are not enabled for Limitless Realty. Maia owns the built-in 1/3/7/14/21/30-day sequence.");}
export async function enrollLeads(input:{organization_id:string;sequence_id:string;start_at?:string;leads:Array<{id:string;name:string;phone:string}>}):Promise<FollowupEnrollment[]>{void input;throw new Error("Manual follow-up enrollment is not enabled for Limitless Realty. Maia creates tenant-scoped follow-ups automatically.");}
export async function updateEnrollment(id:string,action:string,value?:string,organizationId?:string){
  const now=new Date().toISOString(),payload:Record<string,unknown>={};
  if(action==="cancel")Object.assign(payload,{status:"cancelled"});
  else if(action==="complete")Object.assign(payload,{status:"sent",sent_at:now});
  else if(action==="reschedule")Object.assign(payload,{status:"pending",scheduled_at:value});
  else if(action==="pause")Object.assign(payload,{status:"paused"});
  else if(action==="resume")Object.assign(payload,{status:"pending",scheduled_at:value||now});
  else if(action==="skip")Object.assign(payload,{status:"cancelled"});
  else throw new Error("Unsupported follow-up action.");
  const orgFilter=organizationId?`&organization_id=eq.${encodeURIComponent(organizationId)}`:"";return supabaseServerRequest<LegacyFollowup[]>(`follow_ups?id=eq.${encodeURIComponent(id)}${orgFilter}`,{method:"PATCH",body:JSON.stringify(payload)});
}
