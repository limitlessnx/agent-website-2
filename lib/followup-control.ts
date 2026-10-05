import { isServerSupabaseConfigured, supabaseServerRequest } from "@/lib/supabase-server-rest";

export type LegacyFollowup = { id:string; organization_id:string; lead_id:string; scheduled_at:string; message_sent:string|null; status:string; sent_at:string|null; stage:number; channel:string; agent_key:string; template_name:string|null };

async function load(org:string, limit=100) {
  return isServerSupabaseConfigured()
    ? supabaseServerRequest<LegacyFollowup[]>(`follow_ups?organization_id=eq.${encodeURIComponent(org)}&select=*&order=scheduled_at.asc&limit=${limit}`)
    : [];
}

export async function getFollowupControlSummary(organizationId="limitless-realty") {
  const rows = await load(organizationId);
  const now = Date.now();
  const active = rows.filter(r => ["pending","scheduled","queued"].includes(r.status));
  const due = active.filter(r => new Date(r.scheduled_at).getTime() <= now);
  const upcoming = active.filter(r => new Date(r.scheduled_at).getTime() > now);
  const overdue = due.filter(r => now - new Date(r.scheduled_at).getTime() >= 24*60*60*1000);
  const failed = rows.filter(r => r.status === "failed");
  const cancelled = rows.filter(r => r.status === "cancelled");
  const workflows = [];
  const executions = [];
  return {
    configured: isServerSupabaseConfigured(),
    sequences: [],
    steps: [],
    enrollments: active.map(r => ({
      id:r.id, organization_id:r.organization_id, sequence_id:"legacy-follow-up", lead_id:r.lead_id,
      lead_name:null, lead_phone:null, status:r.status === "pending" ? "active" : r.status,
      current_step:r.stage, next_run_at:r.scheduled_at, last_run_at:r.sent_at,
      n8n_execution_id:null, pause_reason:null, created_at:r.scheduled_at, updated_at:r.sent_at || r.scheduled_at,
    })),
    logs: rows.map(r => ({ id:r.id, enrollment_id:r.id, sequence_id:"legacy-follow-up", step_id:String(r.stage), organization_id:r.organization_id, lead_id:r.lead_id, channel:r.channel, status:r.status, n8n_execution_id:null, scheduled_for:r.scheduled_at, executed_at:r.sent_at, error_message:null, created_at:r.scheduled_at })),
    workflows, executions,
    statusSummary: { upcoming:upcoming.length, due:due.length-overdue.length, overdue:overdue.length, completed:rows.filter(r=>r.status==="sent").length, failed:failed.length, cancelled:cancelled.length, paused:0, unscheduled:0 },
  };
}

export async function createSequence(input:{organization_id:string;name:string;description?:string;steps:Array<{channel:string;delay_value:number;delay_unit:string;title?:string|null;message_template?:string|null;workflow_id?:string|null;enabled:boolean}>}) {
  throw new Error("Follow-up sequences are not enabled for the legacy Limitless Realty runtime. Use Maia's built-in 1/3/7/14/21/30-day follow-up sequence.");
}

export async function enrollLeads() {
  throw new Error("Follow-up enrollment is not enabled for the legacy Limitless Realty runtime. Maia creates tenant-scoped follow-ups automatically.");
}

export async function updateEnrollment(id:string, action:string, value?:string) {
  const now = new Date().toISOString();
  const payload:Record<string,unknown> = {};
  if (action==="cancel") Object.assign(payload,{status:"cancelled"});
  else if (action==="complete") Object.assign(payload,{status:"sent",sent_at:now});
  else if (action==="reschedule") Object.assign(payload,{status:"pending",scheduled_at:value});
  else if (action==="pause") Object.assign(payload,{status:"cancelled"});
  else if (action==="resume") Object.assign(payload,{status:"pending",scheduled_at:value || now});
  else if (action==="skip") Object.assign(payload,{status:"sent",sent_at:now});
  else throw new Error("Unsupported follow-up action.");
  return supabaseServerRequest<LegacyFollowup[]>(`follow_ups?id=eq.${encodeURIComponent(id)}`, { method:"PATCH", body:JSON.stringify(payload) });
}
