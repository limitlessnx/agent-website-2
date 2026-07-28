import { isServerSupabaseConfigured, supabaseServerRequest } from "@/lib/supabase-server-rest";
import { isN8nApiConfigured, listN8nExecutions, listN8nWorkflows } from "@/lib/n8n-api";

export type FollowupSequence = { id:string; organization_id:string; name:string; description:string|null; status:"draft"|"active"|"paused"|"archived"; stop_on_reply:boolean; stop_on_qualified:boolean; stop_on_appointment:boolean; created_at:string; updated_at:string };
export type FollowupStep = { id:string; sequence_id:string; position:number; channel:"whatsapp"|"email"|"call"|"telegram"|"task"; delay_value:number; delay_unit:"minutes"|"hours"|"days"; title:string|null; message_template:string|null; workflow_id:string|null; enabled:boolean };
export type FollowupEnrollment = { id:string; organization_id:string; sequence_id:string; lead_id:string; lead_name:string|null; lead_phone:string|null; status:"active"|"paused"|"completed"|"cancelled"|"failed"; current_step:number; next_run_at:string|null; last_run_at:string|null; n8n_execution_id:string|null; pause_reason:string|null; created_at:string; updated_at:string };
export type FollowupLog = { id:string; enrollment_id:string|null; sequence_id:string|null; step_id:string|null; organization_id:string; lead_id:string|null; channel:string|null; status:string; n8n_execution_id:string|null; scheduled_for:string|null; executed_at:string|null; error_message:string|null; created_at:string };

async function safe<T>(promise: Promise<T>, fallback: T) { try { return await promise; } catch { return fallback; } }

export async function getFollowupControlSummary(organizationId = "limitless-realty") {
  const configured = isServerSupabaseConfigured();
  const [sequences, steps, enrollments, logs, workflows, executions] = await Promise.all([
    configured ? safe(supabaseServerRequest<FollowupSequence[]>(`followup_sequences?organization_id=eq.${encodeURIComponent(organizationId)}&select=*&order=updated_at.desc`), []) : [],
    configured ? safe(supabaseServerRequest<FollowupStep[]>("followup_sequence_steps?select=*&order=sequence_id,position"), []) : [],
    configured ? safe(supabaseServerRequest<FollowupEnrollment[]>(`followup_enrollments?organization_id=eq.${encodeURIComponent(organizationId)}&select=*&order=next_run_at.asc.nullslast`), []) : [],
    configured ? safe(supabaseServerRequest<FollowupLog[]>(`followup_execution_log?organization_id=eq.${encodeURIComponent(organizationId)}&select=*&order=created_at.desc&limit=100`), []) : [],
    isN8nApiConfigured() ? safe(listN8nWorkflows(250), []) : [],
    isN8nApiConfigured() ? safe(listN8nExecutions({ limit:100, includeData:false }), []) : [],
  ]);
  const followupWorkflows = workflows.filter((item) => /follow|remind|sequence|nurture/i.test(item.name));
  const relevantIds = new Set(followupWorkflows.map((item) => item.id));
  const n8nExecutions = executions.filter((item) => relevantIds.has(item.workflowId) || item.status === "waiting" || item.status === "running");
  return { configured, sequences, steps, enrollments, logs, workflows: followupWorkflows, executions: n8nExecutions };
}

export async function createSequence(input:{organization_id:string;name:string;description?:string;steps:Array<Omit<FollowupStep,"id"|"sequence_id">>}) {
  const rows = await supabaseServerRequest<FollowupSequence[]>("followup_sequences", { method:"POST", body:JSON.stringify({ organization_id:input.organization_id, name:input.name, description:input.description || null, status:"active" }) });
  const sequence = rows[0];
  if (!sequence) throw new Error("Sequence could not be created.");
  if (input.steps.length) await supabaseServerRequest<FollowupStep[]>("followup_sequence_steps", { method:"POST", body:JSON.stringify(input.steps.map((step,index)=>({ ...step, sequence_id:sequence.id, position:index+1 }))) });
  return sequence;
}

export async function enrollLeads(input:{organization_id:string;sequence_id:string;leads:Array<{id:string;name?:string;phone?:string}>;start_at?:string}) {
  if (!input.leads.length) throw new Error("Select at least one lead.");
  return supabaseServerRequest<FollowupEnrollment[]>("followup_enrollments", { method:"POST", body:JSON.stringify(input.leads.map((lead)=>({ organization_id:input.organization_id, sequence_id:input.sequence_id, lead_id:lead.id, lead_name:lead.name || null, lead_phone:lead.phone || null, status:"active", current_step:1, next_run_at:input.start_at || new Date().toISOString() }))) });
}

export async function updateEnrollment(id:string, action:string, value?:string) {
  const now = new Date().toISOString();
  const payload:Record<string,unknown> = {};
  if (action === "pause") Object.assign(payload,{status:"paused",pause_reason:value || "Paused from dashboard"});
  if (action === "resume") Object.assign(payload,{status:"active",pause_reason:null,next_run_at:value || now});
  if (action === "cancel") Object.assign(payload,{status:"cancelled",next_run_at:null});
  if (action === "complete") Object.assign(payload,{status:"completed",next_run_at:null});
  if (action === "reschedule") Object.assign(payload,{status:"active",next_run_at:value});
  if (action === "skip") Object.assign(payload,{current_step: value ? Number(value) : 1,last_run_at:now});
  return supabaseServerRequest<FollowupEnrollment[]>(`followup_enrollments?id=eq.${encodeURIComponent(id)}`, { method:"PATCH", body:JSON.stringify(payload) });
}
