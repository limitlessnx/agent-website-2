import { createAdminClient } from "@/lib/supabase/admin";

const LIMITLESS_REALTY_ORGANIZATION_ID = process.env.LIMITLESS_REALTY_ORGANIZATION_ID || "b15f21b4-5697-4d21-9421-8a34eae3476d";

export type LimitlessInspectionStatus = "booked" | "confirmed" | "completed" | "cancelled" | "rescheduled" | "no_show";
export type LimitlessInspection = {
  id: string;
  organization_id: string;
  lead_id: string;
  customer_id?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  scheduled_at: string;
  timezone: string;
  status: LimitlessInspectionStatus;
  source: string;
  notes?: string | null;
  reminder_24h_task_id?: string | null;
  reminder_2h_task_id?: string | null;
  post_followup_task_id?: string | null;
  created_at: string;
  updated_at: string;
};

function clean(value: unknown, max = 1000) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function dueBefore(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000).toISOString();
}
function dueAfter(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

async function createReminderTask(input: { leadId: string; title: string; description: string; dueAt: string; kind: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("crm_tasks").insert({
    organization_id: LIMITLESS_REALTY_ORGANIZATION_ID,
    lead_id: input.leadId,
    assigned_agent_id: null,
    task_type: input.kind,
    title: input.title,
    description: input.description,
    due_at: input.dueAt,
    metadata: { source: "limitless_inspection_booking", reminder_channel: "whatsapp", requires_delivery_workflow: true },
  }).select("id").single();
  if (error) throw error;
  return String(data.id);
}

export async function listLimitlessInspections(input: { leadId?: string; status?: LimitlessInspectionStatus; limit?: number } = {}) {
  const admin = createAdminClient();
  let query = admin.from("limitless_inspections")
    .select("*")
    .eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID)
    .order("scheduled_at", { ascending: true })
    .limit(Math.max(1, Math.min(Number(input.limit) || 100, 500)));
  if (input.leadId) query = query.eq("lead_id", input.leadId);
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as LimitlessInspection[];
}

export async function bookLimitlessInspection(input: {
  leadId: string;
  scheduledAt: string;
  propertyId?: string;
  propertyName?: string;
  timezone?: string;
  source?: string;
  notes?: string;
}) {
  const leadId = clean(input.leadId, 100);
  if (!leadId) throw new Error("leadId is required.");
  const scheduled = new Date(input.scheduledAt);
  if (Number.isNaN(scheduled.getTime())) throw new Error("A valid inspection date and time is required.");
  if (scheduled.getTime() <= Date.now()) throw new Error("Inspection must be scheduled in the future.");

  const admin = createAdminClient();
  const { data: lead, error: leadError } = await admin.from("crm_leads")
    .select("id,customer_id,stage")
    .eq("id", leadId)
    .eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID)
    .maybeSingle();
  if (leadError) throw leadError;
  if (!lead) throw new Error("Limitless CRM lead was not found.");

  const propertyName = clean(input.propertyName, 240) || null;
  const timezone = clean(input.timezone, 80) || "Africa/Lagos";
  const scheduledIso = scheduled.toISOString();

  const reminder24Due = dueBefore(scheduled, 24);
  const reminder2Due = dueBefore(scheduled, 2);
  const postDue = dueAfter(scheduled, 24);

  const reminder24TaskId = reminder24Due > new Date().toISOString()
    ? await createReminderTask({ leadId, kind: "inspection_reminder", title: "Inspection reminder: 24 hours", description: `Remind the client about the ${propertyName || "property"} inspection scheduled for ${scheduledIso}.`, dueAt: reminder24Due })
    : null;
  const reminder2TaskId = reminder2Due > new Date().toISOString()
    ? await createReminderTask({ leadId, kind: "inspection_reminder", title: "Inspection reminder: 2 hours", description: `Remind the client that the ${propertyName || "property"} inspection is in about 2 hours.`, dueAt: reminder2Due })
    : null;
  const postTaskId = await createReminderTask({ leadId, kind: "inspection_follow_up", title: "Post-inspection follow-up", description: `Follow up after the ${propertyName || "property"} inspection and record the outcome.`, dueAt: postDue });

  const now = new Date().toISOString();
  const { data: inspection, error } = await admin.from("limitless_inspections").insert({
    organization_id: LIMITLESS_REALTY_ORGANIZATION_ID,
    lead_id: leadId,
    customer_id: lead.customer_id || null,
    property_id: clean(input.propertyId, 100) || null,
    property_name: propertyName,
    scheduled_at: scheduledIso,
    timezone,
    status: "booked",
    source: clean(input.source, 80) || "dashboard",
    notes: clean(input.notes, 2000) || null,
    reminder_24h_task_id: reminder24TaskId,
    reminder_2h_task_id: reminder2TaskId,
    post_followup_task_id: postTaskId,
    updated_at: now,
  }).select("*").single();
  if (error) throw error;

  const detailsPatch = { inspection_id: inspection.id, inspection_status: "booked", inspection_scheduled_at: scheduledIso, inspection_property_name: propertyName };
  const current = await admin.from("crm_leads").select("details").eq("id", leadId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).maybeSingle();
  if (current.error) throw current.error;
  await admin.from("crm_leads").update({
    stage: "inspection",
    details: { ...(current.data?.details || {}), ...detailsPatch },
    updated_at: now,
  }).eq("id", leadId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID);

  return inspection as LimitlessInspection;
}

export async function updateLimitlessInspectionStatus(input: { inspectionId: string; status: LimitlessInspectionStatus; notes?: string }) {
  const admin = createAdminClient();
  const inspectionId = clean(input.inspectionId, 100);
  const { data: existing, error: existingError } = await admin.from("limitless_inspections").select("id,lead_id,notes").eq("id", inspectionId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Inspection was not found.");
  const { data, error } = await admin.from("limitless_inspections").update({ status: input.status, notes: clean(input.notes, 2000) || existing.notes || null, updated_at: new Date().toISOString() }).eq("id", inspectionId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).select("*").single();
  if (error) throw error;
  const leadStage = input.status === "completed" ? "negotiation" : input.status === "cancelled" || input.status === "no_show" ? "qualified" : "inspection";
  await admin.from("crm_leads").update({ stage: leadStage, updated_at: new Date().toISOString() }).eq("id", existing.lead_id).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID);
  return data as LimitlessInspection;
}
