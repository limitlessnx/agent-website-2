import { createAdminClient } from "@/lib/supabase/admin";
import type { SystemEventEnvelope } from "@/lib/system-orchestrator";

export type SystemWorkflowAdapterInput = {
  event: SystemEventEnvelope;
  routeId: string;
  targetSystemId: string;
  configuration?: Record<string, unknown> | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function safeIso(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function findExistingTask(input: SystemWorkflowAdapterInput) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("crm_tasks")
    .select("id,status,task_type,due_at,metadata")
    .eq("organization_id", input.event.organizationId)
    .contains("metadata", {
      system_event_id: input.event.id,
      system_event_route_id: input.routeId,
    })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function createTask(input: SystemWorkflowAdapterInput, values: {
  taskType: string;
  title: string;
  description: string;
  dueAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const existing = await findExistingTask(input);
  if (existing) {
    return {
      adapter: values.taskType,
      duplicate: true,
      task_id: existing.id,
      task_status: existing.status,
    };
  }

  const payload = record(input.event.payload);
  const leadId = text(payload.lead_id) || null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      organization_id: input.event.organizationId,
      customer_id: input.event.customerId || null,
      lead_id: leadId,
      assigned_agent_id: null,
      task_type: values.taskType,
      title: values.title,
      description: values.description,
      status: values.dueAt ? "scheduled" : "pending",
      due_at: values.dueAt || null,
      metadata: {
        system_event_id: input.event.id,
        system_event_route_id: input.routeId,
        source_system_id: input.event.sourceSystemId,
        target_system_id: input.targetSystemId,
        event_type: input.event.eventType,
        correlation_id: input.event.correlationId,
        causation_id: input.event.causationId || null,
        conversation_id: input.event.conversationId || null,
        contract_version: "1",
        ...(values.metadata || {}),
      },
    })
    .select("id,status,task_type,due_at")
    .single();
  if (error) throw error;

  return {
    adapter: values.taskType,
    duplicate: false,
    task_id: data.id,
    task_status: data.status,
    due_at: data.due_at,
  };
}

async function appointmentAdapter(input: SystemWorkflowAdapterInput) {
  const payload = record(input.event.payload);
  const requestedAt =
    safeIso(payload.requested_start_at)
    || safeIso(payload.requested_at)
    || safeIso(payload.preferred_at);

  return createTask(input, {
    taskType: "appointment_request",
    title: text(payload.title) || "Appointment request",
    description: text(payload.reason) || text(payload.notes) || "Appointment request received from another installed Fluxknight system.",
    dueAt: requestedAt,
    metadata: {
      appointment_type: text(payload.appointment_type) || null,
      requested_start_at: requestedAt,
      timezone: text(payload.timezone) || null,
      location: text(payload.location) || null,
    },
  });
}

async function followUpAdapter(input: SystemWorkflowAdapterInput) {
  const payload = record(input.event.payload);
  const dueAt =
    safeIso(payload.next_follow_up_at)
    || safeIso(payload.follow_up_at)
    || safeIso(payload.due_at);

  return createTask(input, {
    taskType: "sales_follow_up",
    title: text(payload.title) || (input.event.eventType === "appointment.booked" ? "Appointment follow-up" : "Customer follow-up"),
    description: text(payload.reason) || text(payload.message_context) || "Follow-up requested by another installed Fluxknight system.",
    dueAt,
    metadata: {
      channel: text(payload.channel) || null,
      trigger: input.event.eventType,
      appointment_id: text(payload.appointment_id) || null,
    },
  });
}

export async function executeSystemWorkflowAdapter(input: SystemWorkflowAdapterInput) {
  const adapter = text(input.configuration?.adapter);
  if (adapter === "appointment") return appointmentAdapter(input);
  if (adapter === "follow_up") return followUpAdapter(input);
  throw new Error(`Unsupported system workflow adapter: ${adapter || "missing"}`);
}
