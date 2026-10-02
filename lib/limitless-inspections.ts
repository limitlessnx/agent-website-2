import { createAdminClient } from "@/lib/supabase/admin";

const LIMITLESS_REALTY_ORGANIZATION_ID = process.env.LIMITLESS_REALTY_ORGANIZATION_ID || "b15f21b4-5697-4d21-9421-8a34eae3476d";

export type LimitlessInspectionStatus = "requested" | "booked" | "confirmed" | "completed" | "cancelled" | "rescheduled" | "no_show";
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
function dueBefore(date: Date, hours: number) { return new Date(date.getTime() - hours * 60 * 60 * 1000).toISOString(); }
function dueAfter(date: Date, hours: number) { return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString(); }

async function createReminderTask(input: { leadId: string; assignedAgentId?: string | null; title: string; description: string; dueAt: string; kind: string }) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("crm_tasks").insert({
    organization_id: LIMITLESS_REALTY_ORGANIZATION_ID,
    lead_id: input.leadId,
    assigned_agent_id: input.assignedAgentId || null,
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

export async function requestLimitlessInspection(input: {
  leadId: string;
  requestedAt: string;
  propertyId?: string;
  propertyName?: string;
  timezone?: string;
  source?: string;
  notes?: string;
}) {
  const leadId = clean(input.leadId, 100);
  if (!leadId) throw new Error("leadId is required.");
  const requested = new Date(input.requestedAt);
  if (Number.isNaN(requested.getTime())) throw new Error("A valid requested inspection date and time is required.");
  if (requested.getTime() <= Date.now()) throw new Error("Requested inspection time must be in the future.");

  const admin = createAdminClient();
  const { data: lead, error: leadError } = await admin.from("leads")
    .select("id,name,phone,status")
    .eq("id", leadId)
    .eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID)
    .maybeSingle();
  if (leadError) throw leadError;
  if (!lead) throw new Error("Limitless Realty lead was not found.");

  const requestedIso = requested.toISOString();
  const now = new Date().toISOString();
  const propertyName = clean(input.propertyName, 240) || null;
  const { data: inspection, error } = await admin.from("limitless_inspections").insert({
    organization_id: LIMITLESS_REALTY_ORGANIZATION_ID,
    lead_id: leadId,
    customer_id: null,
    property_id: clean(input.propertyId, 100) || null,
    property_name: propertyName,
    scheduled_at: requestedIso,
    timezone: clean(input.timezone, 80) || "Africa/Lagos",
    status: "requested",
    source: clean(input.source, 80) || "maia_whatsapp",
    notes: [clean(input.notes, 2000), "Customer requested inspection. Admin confirmation required before booking."].filter(Boolean).join("\n"),
    updated_at: now,
  }).select("*").single();
  if (error) throw error;

  const leadUpdate = await admin.from("leads").update({
    status: "inspection_requested",
    viewing_booked: false,
    viewing_datetime: requestedIso,
    property_interest: propertyName,
    notes: [String(lead.status || ""), propertyName ? `Inspection requested for ${propertyName} at ${requestedIso}. Awaiting admin confirmation.` : `Inspection requested at ${requestedIso}. Awaiting admin confirmation.`].filter(Boolean).join("\n"),
    updated_at: now,
  }).eq("id", leadId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID);
  if (leadUpdate.error) throw leadUpdate.error;

  return inspection as LimitlessInspection;
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
  let lead: { id: string; customer_id?: string | null; stage?: string | null; assigned_agent_id?: string | null } | null = null;
  if (LIMITLESS_REALTY_ORGANIZATION_ID === "b15f21b4-5697-4d21-9421-8a34eae3476d") {
    const { data, error } = await admin.from("leads").select("id,name,phone,status").eq("id", leadId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Limitless Realty lead was not found.");
    lead = { id: data.id, customer_id: null, stage: data.status || null, assigned_agent_id: null };
  } else {
    const { data, error } = await admin.from("crm_leads").select("id,customer_id,stage,assigned_agent_id").eq("id", leadId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Limitless CRM lead was not found.");
    lead = data;
  }

  const propertyName = clean(input.propertyName, 240) || null;
  const timezone = clean(input.timezone, 80) || "Africa/Lagos";
  const scheduledIso = scheduled.toISOString();
  const reminder24Due = dueBefore(scheduled, 24);
  const reminder2Due = dueBefore(scheduled, 2);
  const postDue = dueAfter(scheduled, 24);
  const assignedAgentId = lead.assigned_agent_id || null;

  const reminder24TaskId = reminder24Due > new Date().toISOString()
    ? await createReminderTask({ leadId, assignedAgentId, kind: "inspection_reminder", title: "Inspection reminder: 24 hours", description: `Remind the client about the ${propertyName || "property"} inspection scheduled for ${scheduledIso}.`, dueAt: reminder24Due })
    : null;
  const reminder2TaskId = reminder2Due > new Date().toISOString()
    ? await createReminderTask({ leadId, assignedAgentId, kind: "inspection_reminder", title: "Inspection reminder: 2 hours", description: `Remind the client that the ${propertyName || "property"} inspection is in about 2 hours.`, dueAt: reminder2Due })
    : null;
  const postTaskId = await createReminderTask({ leadId, assignedAgentId, kind: "inspection_follow_up", title: "Post-inspection follow-up", description: `Follow up after the ${propertyName || "property"} inspection and record the outcome.`, dueAt: postDue });

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
  const current = LIMITLESS_REALTY_ORGANIZATION_ID === "b15f21b4-5697-4d21-9421-8a34eae3476d"
    ? await admin.from("leads").select("notes").eq("id", leadId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).maybeSingle()
    : await admin.from("crm_leads").select("details").eq("id", leadId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).maybeSingle();
  if (current.error) throw current.error;
  const leadUpdate = LIMITLESS_REALTY_ORGANIZATION_ID === "b15f21b4-5697-4d21-9421-8a34eae3476d"
    ? await admin.from("leads").update({
        status: "inspection",
        viewing_booked: true,
        viewing_datetime: scheduledIso,
        property_interest: propertyName,
        notes: [String((current.data as any)?.notes || ""), propertyName ? `Inspection booked for ${propertyName} at ${scheduledIso}` : `Inspection booked at ${scheduledIso}`].filter(Boolean).join("\n"),
        updated_at: now,
      }).eq("id", leadId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID)
    : await admin.from("crm_leads").update({
        stage: "inspection",
        details: { ...(current.data?.details || {}), ...detailsPatch },
        updated_at: now,
      }).eq("id", leadId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID);
  if (leadUpdate.error) throw leadUpdate.error;

  return inspection as LimitlessInspection;
}

export async function updateLimitlessInspectionStatus(input: { inspectionId: string; status: LimitlessInspectionStatus; notes?: string; scheduledAt?: string; timezone?: string }) {
  const admin = createAdminClient();
  const inspectionId = clean(input.inspectionId, 100);
  const { data: existing, error: existingError } = await admin.from("limitless_inspections").select("id,lead_id,notes,scheduled_at,timezone,property_name,reminder_24h_task_id,reminder_2h_task_id,post_followup_task_id").eq("id", inspectionId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new Error("Inspection was not found.");
  const scheduled = input.scheduledAt ? new Date(input.scheduledAt) : new Date(existing.scheduled_at);
  if (Number.isNaN(scheduled.getTime()) || scheduled.getTime() <= Date.now()) throw new Error("A valid future inspection date and time is required.");
  const now = new Date().toISOString();
  let reminder24TaskId = existing.reminder_24h_task_id || null;
  let reminder2TaskId = existing.reminder_2h_task_id || null;
  let postTaskId = existing.post_followup_task_id || null;
  if (["booked","confirmed"].includes(input.status) && (!reminder24TaskId || !reminder2TaskId || !postTaskId)) {
    const leadRow = await admin.from("leads").select("id").eq("id", existing.lead_id).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).maybeSingle();
    if (leadRow.error) throw leadRow.error;
    if (!leadRow.data) throw new Error("Limitless Realty lead was not found.");
    const reminder24Due = dueBefore(scheduled, 24);
    const reminder2Due = dueBefore(scheduled, 2);
    const postDue = dueAfter(scheduled, 24);
    reminder24TaskId = !reminder24TaskId && reminder24Due > now ? await createReminderTask({ leadId: existing.lead_id, kind: "inspection_reminder", title: "Inspection reminder: 24 hours", description: `Remind the client about the ${existing.property_name || "property"} inspection scheduled for ${scheduled.toISOString()}.`, dueAt: reminder24Due }) : reminder24TaskId;
    reminder2TaskId = !reminder2TaskId && reminder2Due > now ? await createReminderTask({ leadId: existing.lead_id, kind: "inspection_reminder", title: "Inspection reminder: 2 hours", description: `Remind the client that the ${existing.property_name || "property"} inspection is in about 2 hours.`, dueAt: reminder2Due }) : reminder2TaskId;
    postTaskId = !postTaskId ? await createReminderTask({ leadId: existing.lead_id, kind: "inspection_follow_up", title: "Post-inspection follow-up", description: `Follow up after the ${existing.property_name || "property"} inspection and record the outcome.`, dueAt: postDue }) : postTaskId;
  }
  const { data, error } = await admin.from("limitless_inspections").update({
    status: input.status,
    scheduled_at: scheduled.toISOString(),
    timezone: clean(input.timezone, 80) || existing.timezone || "Africa/Lagos",
    notes: clean(input.notes, 2000) || existing.notes || null,
    reminder_24h_task_id: reminder24TaskId,
    reminder_2h_task_id: reminder2TaskId,
    post_followup_task_id: postTaskId,
    updated_at: now
  }).eq("id", inspectionId).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID).select("*").single();
  if (error) throw error;
  const leadStage = input.status === "completed" ? "negotiation" : input.status === "cancelled" || input.status === "no_show" ? "qualified" : input.status === "requested" ? "inspection_requested" : "inspection";
  const leadUpdate = LIMITLESS_REALTY_ORGANIZATION_ID === "b15f21b4-5697-4d21-9421-8a34eae3476d"
    ? await admin.from("leads").update({
        status: leadStage,
        viewing_booked: ["booked","confirmed"].includes(input.status),
        viewing_datetime: scheduled.toISOString(),
        property_interest: existing.property_name || null,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.lead_id).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID)
    : await admin.from("crm_leads").update({ stage: leadStage, updated_at: new Date().toISOString() }).eq("id", existing.lead_id).eq("organization_id", LIMITLESS_REALTY_ORGANIZATION_ID);
  if (leadUpdate.error) throw leadUpdate.error;
  return data as LimitlessInspection;
}
