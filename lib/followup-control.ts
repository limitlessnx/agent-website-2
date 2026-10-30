import { isServerSupabaseConfigured, supabaseServerRequest } from "@/lib/supabase-server-rest";
import { LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/limitless-data";
import { followupErrorSummary } from "@/lib/limitless-followup-contract";

export type FollowupStep = {
  id: string;
  sequence_id: string;
  position: number;
  channel: "whatsapp" | "email" | "call" | "telegram" | "task";
  delay_value: number;
  delay_unit: string;
  title: string | null;
  message_template: string | null;
  workflow_id: string | null;
  enabled: boolean;
};

export type FollowupSequence = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type FollowupEnrollment = {
  id: string;
  organization_id: string;
  sequence_id: string;
  lead_id: string;
  customer_id: string | null;
  property_id: string | null;
  property_title: string | null;
  lead_name: string | null;
  lead_phone: string | null;
  status: string;
  sequence_status: string | null;
  consent_state: string | null;
  stop_reason: string | null;
  stop_actor: string | null;
  control_reason: string | null;
  error_summary: string | null;
  attempt_count: number;
  current_step: number;
  next_run_at: string | null;
  next_execution_status: string;
  last_run_at: string | null;
  n8n_execution_id: string | null;
  pause_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type FollowupLog = {
  id: string;
  enrollment_id: string;
  sequence_id: string;
  step_id: string;
  organization_id: string;
  lead_id: string;
  channel: string | null;
  status: string | null;
  n8n_execution_id: string | null;
  scheduled_for: string | null;
  executed_at: string | null;
  error_message: string | null;
  attempt_count: number;
  created_at: string;
};

export type LegacyFollowup = {
  id: string;
  organization_id: string;
  lead_id: string;
  customer_id: string | null;
  property_id: string | null;
  sequence_id: string | null;
  scheduled_at: string;
  due_at?: string | null;
  sent_at?: string | null;
  last_attempt_at?: string | null;
  attempt_count?: number | null;
  last_error?: string | null;
  control_reason?: string | null;
  message_sent: string | null;
  status: string;
  stage: number;
  channel: string;
  agent_key: string;
  template_name: string | null;
  created_at: string | null;
};

type FollowupSequenceState = {
  id: string;
  status: string;
  consent_state: string;
  stop_reason: string | null;
  stop_actor: string | null;
  paused_at: string | null;
  stopped_at: string | null;
  completed_at: string | null;
};

type FollowupStepState = { id: string; status: string; scheduled_at: string };
type LeadDetails = { id: string; name: string | null; phone: string | null };
type PropertyDetails = { id: string; title: string | null };

async function load(organizationId: string, limit = 100) {
  if (!isServerSupabaseConfigured()) return [] as LegacyFollowup[];
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return supabaseServerRequest<LegacyFollowup[]>(
    `follow_ups?organization_id=eq.${encodeURIComponent(organizationId)}&select=*&order=scheduled_at.asc&limit=${safeLimit}`,
  );
}

export async function getFollowupControlSummary(organizationId = LIMITLESS_REALTY_ORGANIZATION_ID) {
  const rows = await load(organizationId);
  const leadIds = [...new Set(rows.map((row) => row.lead_id).filter(Boolean))];
  const propertyIds = [...new Set(rows.map((row) => row.property_id).filter((id): id is string => Boolean(id)))];
  const sequenceIds = [...new Set(rows.map((row) => row.sequence_id).filter((id): id is string => Boolean(id)))];
  const organizationFilter = `organization_id=eq.${encodeURIComponent(organizationId)}`;
  const [leads, properties, sequences] = await Promise.all([
    leadIds.length
      ? supabaseServerRequest<LeadDetails[]>(`leads?id=in.(${leadIds.map(encodeURIComponent).join(",")})&${organizationFilter}&select=id,name,phone&limit=100`)
      : Promise.resolve([] as LeadDetails[]),
    propertyIds.length
      ? supabaseServerRequest<PropertyDetails[]>(`properties?id=in.(${propertyIds.map(encodeURIComponent).join(",")})&${organizationFilter}&select=id,title&limit=100`)
      : Promise.resolve([] as PropertyDetails[]),
    sequenceIds.length
      ? supabaseServerRequest<FollowupSequenceState[]>(`limitless_maia_followup_sequences?id=in.(${sequenceIds.map(encodeURIComponent).join(",")})&${organizationFilter}&select=id,status,consent_state,stop_reason,stop_actor,paused_at,stopped_at,completed_at&limit=100`)
      : Promise.resolve([] as FollowupSequenceState[]),
  ]);
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const sequenceById = new Map(sequences.map((sequence) => [sequence.id, sequence]));
  const now = Date.now();
  const activeRows = rows.filter((row) => ["pending", "scheduled", "queued"].includes(row.status)
    && (!row.sequence_id || sequenceById.get(row.sequence_id)?.status === "active"));
  const dueRows = activeRows.filter((row) => new Date(row.scheduled_at).getTime() <= now);
  const overdueRows = dueRows.filter((row) => now - new Date(row.scheduled_at).getTime() >= 86_400_000);

  const enrollments = rows.map((row) => {
    const lead = leadById.get(row.lead_id);
    const property = row.property_id ? propertyById.get(row.property_id) : undefined;
    const sequence = row.sequence_id ? sequenceById.get(row.sequence_id) : undefined;
    const activeStep = ["pending", "scheduled", "queued"].includes(row.status);
    let status = row.status === "pending" || row.status === "scheduled" || row.status === "queued"
      ? "active"
      : row.status === "sent" ? "completed" : row.status;
    if (sequence?.consent_state === "opted_out" || sequence?.status === "opted_out") status = "opted_out";
    else if (sequence?.status === "paused") status = "paused";
    else if (sequence?.status === "stopped") status = "stopped";
    else if (sequence?.status === "completed") status = "closed";
    const runnable = activeStep && (!sequence || sequence.status === "active");
    const reason = row.control_reason || sequence?.stop_reason || null;
    return {
      id: row.id,
      organization_id: row.organization_id,
      sequence_id: row.sequence_id || "legacy-follow-up",
      lead_id: row.lead_id,
      customer_id: row.customer_id || null,
      property_id: row.property_id || null,
      property_title: property?.title || null,
      lead_name: lead?.name || null,
      lead_phone: lead?.phone || null,
      status,
      sequence_status: sequence?.status || null,
      consent_state: sequence?.consent_state || null,
      stop_reason: sequence?.stop_reason || null,
      stop_actor: sequence?.stop_actor || null,
      control_reason: row.control_reason || null,
      error_summary: followupErrorSummary(row.last_error),
      attempt_count: Number(row.attempt_count || 0),
      current_step: row.stage || 0,
      next_run_at: runnable ? row.scheduled_at : null,
      next_execution_status: runnable ? "scheduled" : status,
      last_run_at: row.last_attempt_at || row.sent_at || null,
      n8n_execution_id: null,
      pause_reason: sequence?.status === "paused" ? reason : null,
      created_at: row.created_at || row.scheduled_at,
      updated_at: row.last_attempt_at || row.sent_at || row.created_at || row.scheduled_at,
    } satisfies FollowupEnrollment;
  });
  const logs: FollowupLog[] = rows.map((row) => ({
    id: row.id,
    enrollment_id: row.id,
    sequence_id: row.sequence_id || "legacy-follow-up",
    step_id: String(row.stage || 0),
    organization_id: row.organization_id,
    lead_id: row.lead_id,
    channel: row.channel,
    status: row.status,
    n8n_execution_id: null,
    scheduled_for: row.scheduled_at,
    executed_at: row.last_attempt_at || row.sent_at || null,
    error_message: followupErrorSummary(row.last_error),
    attempt_count: Number(row.attempt_count || 0),
    created_at: row.last_attempt_at || row.sent_at || row.created_at || row.scheduled_at,
  })).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    configured: isServerSupabaseConfigured(),
    asOf: now,
    sequences: [] as FollowupSequence[],
    steps: [] as FollowupStep[],
    enrollments,
    logs,
    workflows: [] as unknown[],
    executions: [] as unknown[],
    statusSummary: {
      upcoming: enrollments.filter((entry) => entry.status === "active" && entry.next_run_at && new Date(entry.next_run_at).getTime() > now).length,
      due: Math.max(0, dueRows.length - overdueRows.length),
      overdue: overdueRows.length,
      completed: rows.filter((row) => row.status === "sent").length,
      failed: enrollments.filter((entry) => entry.status === "failed").length,
      cancelled: enrollments.filter((entry) => entry.status === "cancelled").length,
      paused: enrollments.filter((entry) => entry.status === "paused").length,
      optedOut: enrollments.filter((entry) => entry.status === "opted_out").length,
      stopped: enrollments.filter((entry) => entry.status === "stopped").length,
      closed: enrollments.filter((entry) => entry.status === "closed").length,
      unknown: enrollments.filter((entry) => entry.status === "unknown").length,
      draft: enrollments.filter((entry) => entry.status === "draft").length,
      unscheduled: rows.filter((row) => !row.scheduled_at).length,
    },
  };
}

export async function createSequence(input: {
  organization_id: string;
  name: string;
  description?: string;
  steps: Array<{ channel: string; delay_value: number; delay_unit: string; title?: string | null; message_template?: string | null; workflow_id?: string | null; enabled: boolean }>;
}): Promise<FollowupSequence> {
  void input;
  throw new Error("Custom follow-up sequences are not enabled for Limitless Realty. Maia owns the built-in 1/3/7/14/21/30-day sequence.");
}

export async function enrollLeads(input: {
  organization_id: string;
  sequence_id: string;
  start_at?: string;
  leads: Array<{ id: string; name: string; phone: string }>;
}): Promise<FollowupEnrollment[]> {
  void input;
  throw new Error("Manual follow-up enrollment is not enabled for Limitless Realty. Maia creates tenant-scoped follow-ups automatically.");
}

export async function updateEnrollment(input: {
  organizationId: string;
  customerId: string;
  propertyId: string | null;
  sequenceId: string;
  stepId: string;
  action: string;
  reason: string;
  actor: string;
  scheduledAt?: string;
}) {
  if (!input.organizationId || !input.customerId || !input.propertyId || !input.sequenceId || !input.stepId || !input.reason?.trim() || !input.actor?.trim()) {
    throw new Error("Exact tenant, customer, property, sequence, step, actor, and reason are required.");
  }
  if (!isServerSupabaseConfigured()) throw new Error("Supabase is not configured for follow-up controls.");
  const allowed = new Set(["pause", "resume", "stop", "close", "cancel", "complete", "reschedule", "retry"]);
  if (!allowed.has(input.action)) throw new Error("Unsupported exact follow-up action.");
  let scheduledAt: string | null = null;
  if (input.action === "reschedule") {
    const parsed = input.scheduledAt ? new Date(input.scheduledAt) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) throw new Error("A future schedule time is required.");
    scheduledAt = parsed.toISOString();
  }
  const step: FollowupStepState = { id: input.stepId, status: input.action, scheduled_at: scheduledAt || new Date().toISOString() };
  let changed: FollowupStepState[] = [];
  try {
    const result = await supabaseServerRequest<{ sequence_status?: string; changed?: FollowupStepState[] }>("rpc/control_limitless_maia_followup_sequence", {
      method: "POST",
      body: JSON.stringify({
        p_organization_id: input.organizationId,
        p_customer_id: input.customerId,
        p_property_id: input.propertyId,
        p_sequence_id: input.sequenceId,
        p_step_id: input.stepId,
        p_action: input.action,
        p_reason: input.reason.trim(),
        p_actor: input.actor.trim(),
        p_scheduled_at: scheduledAt,
      }),
    });
    changed = Array.isArray(result.changed) ? result.changed : [];
  } catch {
    throw new Error("The follow-up control could not be committed; no partial state or audit change was saved.");
  }
  return changed.length ? changed : [{ id: step.id, status: input.action, scheduled_at: step.scheduled_at }];
}
