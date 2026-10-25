import { realEstateDateTimeToIso, validateTimeZone } from "@/lib/real-estate-timezone";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishSystemEvent } from "@/lib/system-orchestrator";
import { selectAppointmentResource } from "@/lib/appointment-scheduling";
import { addCanonicalTimelineEvent, resolveCanonicalCustomer } from "@/lib/canonical-customer";
import {
  appointmentEventCanConfirm,
  asFutureIso,
  assertBookingPrerequisites,
  assertTransition,
  assertVerifiedActiveProperty,
  inspectionLeadStatus,
  optionalFutureIso,
  propertyVerificationForInput,
  type RealEstateInspectionStatus,
} from "@/lib/real-estate-inspection-policy";

export type RealEstateInspection = {
  id: string;
  organization_id: string;
  legacy_lead_id?: string | null;
  crm_lead_id?: string | null;
  customer_id?: string | null;
  property_id?: string | null;
  property_query_text?: string | null;
  property_verification_status: "unresolved" | "verified";
  requested_start_at?: string | null;
  requested_end_at?: string | null;
  timezone: string;
  status: RealEstateInspectionStatus;
  source: string;
  notes?: string | null;
  booking_idempotency_key?: string | null;
  booking_request_event_id?: string | null;
  canonical_appointment_id?: string | null;
  appointment_external_event_id?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  unavailable_reason?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type SingleQuery = { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> };

function text(value: unknown, max = 1000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function admin() { return createAdminClient(); }
function isRealEstateInspection(value: unknown): value is RealEstateInspection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.organization_id === "string" && typeof row.timezone === "string" && typeof row.status === "string" && typeof row.source === "string";
}

async function one<T>(query: SingleQuery, message: string, isRow: (value: unknown) => value is T): Promise<T> {
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!isRow(data)) throw new Error(message);
  return data;
}

export async function loadRealEstateInspection(organizationId: string, inspectionId: string): Promise<RealEstateInspection> {
  return one(
    admin().from("real_estate_inspections").select("*").eq("organization_id", organizationId).eq("id", inspectionId),
    "Inspection was not found in this organization.",
    isRealEstateInspection,
  );
}

async function transition(input: {
  organizationId: string;
  inspectionId: string;
  status: RealEstateInspectionStatus;
  propertyId?: string | null;
  requestedStartAt?: string | null;
  requestedEndAt?: string | null;
  bookingRequestEventId?: string | null;
  canonicalAppointmentId?: string | null;
  appointmentExternalEventId?: string | null;
  approvedBy?: string | null;
  actorId?: string | null;
  timezone?: string | null;
  unavailableReason?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await admin().rpc("transition_real_estate_inspection_with_audit", {
    p_organization_id: input.organizationId,
    p_inspection_id: input.inspectionId,
    p_status: input.status,
    p_property_id: input.propertyId || null,
    p_requested_start_at: input.requestedStartAt || null,
    p_requested_end_at: input.requestedEndAt || null,
    p_booking_request_event_id: input.bookingRequestEventId || null,
    p_canonical_appointment_id: input.canonicalAppointmentId || null,
    p_appointment_external_event_id: input.appointmentExternalEventId || null,
    p_approved_by: input.approvedBy || null,
    p_unavailable_reason: input.unavailableReason || null,
    p_notes: input.notes || null,
    p_actor_id: text(input.actorId||input.approvedBy,320)||"system:real_estate",
    p_timezone: input.timezone || null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("Inspection transition returned no row.");
  return row as RealEstateInspection;
}

async function projectLegacyLead(organizationId: string, inspection: Partial<RealEstateInspection>, status: RealEstateInspectionStatus) {
  if (!inspection.legacy_lead_id) return;
  const { error } = await admin().from("leads").update({
    status: inspectionLeadStatus(status),
    viewing_booked: ["booked", "rescheduled"].includes(status),
    viewing_datetime: inspection.requested_start_at || null,
    updated_at: new Date().toISOString(),
  }).eq("organization_id", organizationId).eq("id", inspection.legacy_lead_id);
  if (error) throw error;
}

async function activeProperty(organizationId: string, propertyId: string) {
  const { data, error } = await admin().from("properties").select("id,status,title").eq("organization_id", organizationId).eq("id", propertyId).maybeSingle();
  if (error) throw error;
  return data as { id: string; status: string; name?: string | null; title?: string | null; address?: string | null } | null;
}

async function validCustomer(organizationId: string, customerId: string) {
  const { data, error } = await admin().from("crm_customers").select("id,status").eq("organization_id", organizationId).eq("id", customerId).maybeSingle();
  if (error) throw error;
  if (!data || data.status === "blocked" || data.status === "archived") throw new Error("Canonical customer was not found or is not schedulable in this organization.");
  return data;
}

async function validLeadReferences(input: { organizationId: string; legacyLeadId?: string | null; crmLeadId?: string | null; customerId?: string | null }) {
  const client = admin();
  if (!input.legacyLeadId && !input.crmLeadId && !input.customerId) throw new Error("A tenant-scoped lead or canonical customer is required.");
  let customerId = text(input.customerId, 100) || null;
  if (input.legacyLeadId) {
    const { data, error } = await client.from("leads").select("id,name,email,phone").eq("organization_id", input.organizationId).eq("id", input.legacyLeadId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Legacy lead was not found in this organization.");
    const resolved = await resolveCanonicalCustomer({
      organizationId: input.organizationId,
      fullName: data.name,
      email: data.email,
      phone: data.phone,
      externalKey: `legacy-lead:${input.legacyLeadId}`,
      source: "real_estate_inspection",
    });
    customerId = resolved.customerId;
  }
  if (input.crmLeadId) {
    const { data, error } = await client.from("crm_leads").select("id,customer_id").eq("organization_id", input.organizationId).eq("id", input.crmLeadId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("CRM lead was not found in this organization.");
    if (customerId && customerId !== String(data.customer_id)) throw new Error("CRM lead and customer do not belong to the same canonical identity.");
    customerId = data.customer_id ? String(data.customer_id) : null;
  }
  if (customerId) await validCustomer(input.organizationId, customerId);
  if (!customerId) throw new Error("A canonical customer is required before scheduling.");
  return customerId;
}

export async function resolveLimitlessSourceSystemId(organizationId: string): Promise<string> {
  const client = admin();
  const { data: installations, error } = await client.from("organization_systems")
    .select("id,system_id,status,created_at")
    .eq("organization_id", organizationId).eq("status", "active")
    .order("created_at", { ascending: true }).limit(100);
  if (error) throw error;
  for (const installation of installations || []) {
    const { data: catalog, error: catalogError } = await client.from("system_catalog").select("slug").eq("id", installation.system_id).maybeSingle();
    if (catalogError) throw catalogError;
    if (text(catalog?.slug) === "limitless-realty" || text(catalog?.slug) === "real-estate") return String(installation.id);
  }
  throw new Error("An active Limitless Realty source system installation is required.");
}

export async function requestRealEstateInspection(input: {
  organizationId: string;
  legacyLeadId?: string | null;
  crmLeadId?: string | null;
  customerId?: string | null;
  propertyId?: string | null;
  propertyQueryText?: string | null;
  requestedStartAt?: string | null;
  requestedEndAt?: string | null;
  timezone?: string | null;
  source?: string | null;
  notes?: string | null;
  idempotencyKey?: string | null;
}) {
  const organizationId = text(input.organizationId, 100);
  if (!organizationId) throw new Error("organizationId is required.");
  const legacyLeadId = text(input.legacyLeadId, 100) || null;
  const crmLeadId = text(input.crmLeadId, 100) || null;
  const customerId = await validLeadReferences({ organizationId, legacyLeadId, crmLeadId, customerId: input.customerId });
  const timezone=validateTimeZone(text(input.timezone,80)||"Africa/Lagos");
  const requestedStartAt = optionalFutureIso(input.requestedStartAt?realEstateDateTimeToIso(input.requestedStartAt,timezone):null);
  const requestedEndAt = optionalFutureIso(input.requestedEndAt?realEstateDateTimeToIso(input.requestedEndAt,timezone):null);
  if (requestedStartAt && requestedEndAt && new Date(requestedEndAt).getTime() <= new Date(requestedStartAt).getTime()) throw new Error("Inspection end must be after inspection start.");

  let propertyId: string | null = null;
  let propertyStatus: "unresolved" | "verified" = "unresolved";
  let propertyQueryText = text(input.propertyQueryText, 500) || null;
  const suppliedPropertyId = text(input.propertyId, 100);
  if (suppliedPropertyId) {
    const property = await activeProperty(organizationId, suppliedPropertyId);
    const resolved = propertyVerificationForInput({ propertyId: suppliedPropertyId, propertyQueryText, propertyIsActive: property?.status === "active" });
    propertyId = resolved.propertyId;
    propertyStatus = resolved.status;
    propertyQueryText = resolved.queryText;
  }
  const status: RealEstateInspectionStatus = propertyStatus === "verified" ? "requested" : "requested_verification";
  const idempotencyKey = text(input.idempotencyKey, 240) || null;
  if (idempotencyKey) {
    const existing = await admin().from("real_estate_inspections").select("*").eq("organization_id", organizationId).eq("booking_idempotency_key", idempotencyKey).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data as RealEstateInspection;
  }
  const { data, error } = await admin().rpc("create_real_estate_inspection_request_with_audit",{
    p_organization_id:organizationId,p_actor_id:`customer:${customerId}`,p_legacy_lead_id:legacyLeadId,p_crm_lead_id:crmLeadId,
    p_customer_id:customerId,p_property_id:propertyId,p_property_query_text:propertyQueryText,p_property_verification_status:propertyStatus,
    p_requested_start_at:requestedStartAt,p_requested_end_at:requestedEndAt,p_timezone:timezone,p_status:status,
    p_source:text(input.source,120)||"real_estate",p_idempotency_key:idempotencyKey,p_notes:text(input.notes,4000)||null,p_metadata:{customer_request:true},
  });
  if (error) {
    if (idempotencyKey && String(error.code || "") === "23505") {
      const recovered = await admin().from("real_estate_inspections").select("*").eq("organization_id", organizationId).eq("booking_idempotency_key", idempotencyKey).maybeSingle();
      if (recovered.error) throw recovered.error;
      if (recovered.data) return recovered.data as RealEstateInspection;
    }
    throw error;
  }
  const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error("Inspection request returned no row.");
  await projectLegacyLead(organizationId, row, status);
  return row as RealEstateInspection;
}

export async function listRealEstateInspections(input: { organizationId: string; customerId?: string | null; status?: RealEstateInspectionStatus; limit?: number } ) {
  let query = admin().from("real_estate_inspections").select("*").eq("organization_id", input.organizationId).order("created_at", { ascending: false }).limit(Math.max(1, Math.min(250, Number(input.limit) || 100)));
  if (input.customerId) query = query.eq("customer_id", input.customerId);
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as RealEstateInspection[];
}

export async function approveRealEstateInspection(input: {
  organizationId: string;
  inspectionId: string;
  approvedBy: string;
  sourceSystemId: string;
  propertyId?: string | null;
  requestedStartAt?: string | null;
  requestedEndAt?: string | null;
  requestedResourceId?: string | null;
  requestedMembershipId?: string | null;
  durationMinutes?: number | null;
  serviceKey?: string | null;
  branchKey?: string | null;
  departmentKey?: string | null;
}) {
  if (!text(input.approvedBy, 320)) throw new Error("Admin approval identity is required.");
  if (!text(input.sourceSystemId, 100)) throw new Error("An active source system is required before approval.");
  const inspection = await loadRealEstateInspection(input.organizationId, input.inspectionId);
  assertTransition(inspection.status, "booking_pending");
  const propertyId = text(input.propertyId, 100) || text(inspection.property_id, 100);
  const property = propertyId ? await activeProperty(input.organizationId, propertyId) : null;
  const verifiedPropertyId = assertVerifiedActiveProperty({ requestedPropertyId: input.propertyId, existingPropertyId: inspection.property_id, propertyStatus: property?.status });
  if (inspection.customer_id) await validCustomer(input.organizationId, inspection.customer_id);
  const requestedStartAt = assertBookingPrerequisites({ customerId: inspection.customer_id, requestedStartAt: input.requestedStartAt ? realEstateDateTimeToIso(input.requestedStartAt,inspection.timezone) : inspection.requested_start_at, sourceSystemId: input.sourceSystemId, propertyId: verifiedPropertyId });
  const requestedEndAt = optionalFutureIso(input.requestedEndAt?realEstateDateTimeToIso(input.requestedEndAt,inspection.timezone):inspection.requested_end_at);
  if (requestedEndAt && new Date(requestedEndAt).getTime() <= new Date(requestedStartAt).getTime()) throw new Error("Inspection end must be after inspection start.");
  const routing = await selectAppointmentResource({
    organizationId: input.organizationId, startAt: requestedStartAt, requestedEndAt,
    requestedDurationMinutes: input.durationMinutes || null,
    requestedResourceId: text(input.requestedResourceId, 100) || null,
    requestedMembershipId: text(input.requestedMembershipId, 100) || null,
    serviceKey: text(input.serviceKey, 100) || null,
    branchKey: text(input.branchKey, 100) || null,
    departmentKey: text(input.departmentKey, 100) || null,
  });
  if (!routing.resource || !routing.endAt) {
    const unavailable = await transition({ organizationId: input.organizationId, inspectionId: inspection.id, status: "unavailable", propertyId: verifiedPropertyId, requestedStartAt, requestedEndAt, unavailableReason: routing.reason || "No active staff/resource is available at the requested time.",actorId:input.approvedBy });
    await projectLegacyLead(input.organizationId, unavailable, "unavailable");
    return { inspection: unavailable, eventId: null, status: "unavailable" as const, routing };
  }
  const pending = await transition({ organizationId: input.organizationId, inspectionId: inspection.id, status: "booking_pending", propertyId: verifiedPropertyId, requestedStartAt, requestedEndAt: requestedEndAt || routing.endAt, approvedBy: input.approvedBy,actorId:input.approvedBy, notes: "Admin approval recorded; awaiting canonical appointment external calendar event." });
  await projectLegacyLead(input.organizationId, pending, "booking_pending");
  const eventId = await publishSystemEvent({
    organizationId: input.organizationId, sourceSystemId: input.sourceSystemId, eventType: "appointment.requested",
    customerId: inspection.customer_id || null, correlationId: inspection.id,
    idempotencyKey: `real-estate-inspection:${inspection.id}:appointment-request`, source: "real_estate_inspection",
    payload: {
      inspectionId: inspection.id, requestedStart: requestedStartAt, requestedEnd: requestedEndAt || routing.endAt,
      timezone: inspection.timezone, title: "Property inspection", propertyId: verifiedPropertyId,
      customerId: inspection.customer_id, lead_id: inspection.crm_lead_id || null,
      calendarResourceId: routing.resource.id, assignedMembershipId: routing.resource.assigned_membership_id || null,
      serviceKey: text(input.serviceKey, 100) || "property_inspection", durationMinutes: input.durationMinutes || null,
      sourceIntent: "real_estate_inspection",
    },
  });
  const withEvent = await transition({ organizationId: input.organizationId, inspectionId: inspection.id, status: "booking_pending", propertyId: verifiedPropertyId, requestedStartAt, requestedEndAt: requestedEndAt || routing.endAt, bookingRequestEventId: eventId,actorId:input.approvedBy });
  return { inspection: withEvent, eventId, status: "booking_pending" as const, routing };
}

async function replaceReminderJobs(organizationId: string, inspection: RealEstateInspection) {
  if (!inspection.requested_start_at) return [];
  const { data, error } = await admin().rpc("replace_real_estate_inspection_reminders", {
    p_organization_id: organizationId, p_inspection_id: inspection.id, p_requested_start_at: inspection.requested_start_at,
    p_customer_id: inspection.customer_id || null, p_canonical_appointment_id: inspection.canonical_appointment_id || null,
  });
  if (!error && data) return Array.isArray(data) ? data : [data];
  if(error)throw error;
  throw new Error("Transactional reminder scheduling is unavailable; the reviewed migration is required.");
}

async function createOutcomeFollowupJob(organizationId: string, inspection: RealEstateInspection) {
  if (!inspection.requested_start_at || !["completed", "no_show"].includes(inspection.status)) return null;
  const dueAt = new Date(new Date(inspection.requested_start_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
  const key=`real-estate-inspection:${inspection.id}:outcome_followup:${inspection.status}`;
  const existing=await admin().from("real_estate_inspection_jobs").select("id,job_type,due_at,status").eq("organization_id",organizationId).eq("idempotency_key",key).maybeSingle();if(existing.error)throw existing.error;if(existing.data)return existing.data;
  const {data,error}=await admin().from("real_estate_inspection_jobs").insert({organization_id:organizationId,inspection_id:inspection.id,job_type:"outcome_followup",status:"scheduled",due_at:dueAt,idempotency_key:key,payload:{inspection_id:inspection.id,customer_id:inspection.customer_id||null,outcome:inspection.status}}).select("id,job_type,due_at").single();
  if(error){if(error.code==="23505"){const recovered=await admin().from("real_estate_inspection_jobs").select("id,job_type,due_at,status").eq("organization_id",organizationId).eq("idempotency_key",key).maybeSingle();if(recovered.error)throw recovered.error;return recovered.data;}throw error;}
  return data;
}

export async function reconcileRealEstateInspectionFromAppointment(input: {
  organizationId: string;
  inspectionId: string;
  appointmentId: string;
  eventType: "appointment.booked" | "appointment.rescheduled" | "appointment.cancelled";
  eventId?: string | null;
}) {
  const inspection = await loadRealEstateInspection(input.organizationId, input.inspectionId);
  const { data: appointment, error } = await admin().from("appointments").select("id,status,customer_id,external_event_id,start_at,end_at,metadata").eq("organization_id", input.organizationId).eq("id", input.appointmentId).maybeSingle();
  if (error) throw error;
  if (!appointment) throw new Error("Canonical appointment was not found in this organization.");
  if (inspection.customer_id && String(appointment.customer_id || "") !== String(inspection.customer_id)) throw new Error("Canonical appointment customer does not match inspection customer.");
  if (input.eventType === "appointment.cancelled") {
    if (appointment.status !== "cancelled") return { inspection, status: "awaiting_canonical_cancellation", jobs: [] };
    const cancelled = await transition({ organizationId: input.organizationId, inspectionId: inspection.id, status: "cancelled", canonicalAppointmentId: appointment.id, notes: "Canonical appointment cancellation observed.",actorId:"system:calendar_provider" });
    await admin().from("real_estate_inspection_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("organization_id", input.organizationId).eq("inspection_id", inspection.id).in("status", ["scheduled", "processing"]);
    await projectLegacyLead(input.organizationId, cancelled, "cancelled");
    return { inspection: cancelled, status: "cancelled" as const, jobs: [] };
  }
  if (!appointmentEventCanConfirm({ eventType: input.eventType, appointmentStatus: appointment.status, externalEventId: appointment.external_event_id })) return { inspection, status: "awaiting_external_calendar_event" as const, jobs: [] };
  const nextStatus: RealEstateInspectionStatus = input.eventType === "appointment.rescheduled" ? "rescheduled" : "booked";
  const confirmed = await transition({ organizationId: input.organizationId, inspectionId: inspection.id, status: nextStatus, canonicalAppointmentId: appointment.id, appointmentExternalEventId: appointment.external_event_id, requestedStartAt: appointment.start_at, requestedEndAt: appointment.end_at, notes: "Canonical appointment external calendar event observed.",actorId:"system:calendar_provider" });
  const jobs = await replaceReminderJobs(input.organizationId, confirmed);
  await projectLegacyLead(input.organizationId, confirmed, nextStatus);
  return { inspection: confirmed, status: nextStatus, jobs, eventId: input.eventId || null };
}

export async function rescheduleRealEstateInspection(input: { organizationId: string; inspectionId: string; sourceSystemId: string; requestedStartAt: string; requestedEndAt?: string | null; timezone?: string | null; reason?: string | null;actorId?:string|null }) {
  const inspection = await loadRealEstateInspection(input.organizationId, input.inspectionId);
  if (!["booked", "rescheduled"].includes(inspection.status) || !inspection.canonical_appointment_id) throw new Error("Only a canonical booked inspection can be rescheduled.");
  const schedulingTimezone=validateTimeZone(text(input.timezone,80)||inspection.timezone);
  const startAt = asFutureIso(realEstateDateTimeToIso(input.requestedStartAt,schedulingTimezone));
  const endAt = optionalFutureIso(input.requestedEndAt?realEstateDateTimeToIso(input.requestedEndAt,schedulingTimezone):null);
  if (endAt && new Date(endAt).getTime() <= new Date(startAt).getTime()) throw new Error("Inspection end must be after inspection start.");
  const timezone = text(input.timezone, 80);
  const pendingWithTimezone = await transition({ organizationId: input.organizationId, inspectionId: inspection.id, status: "reschedule_pending", requestedStartAt: startAt, requestedEndAt: endAt, notes: input.reason || "Reschedule requested; awaiting canonical appointment event.",actorId:input.actorId||"system:real_estate",timezone:timezone||null });
  await admin().from("real_estate_inspection_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("organization_id", input.organizationId).eq("inspection_id", inspection.id).in("status", ["scheduled", "processing"]).in("job_type", ["reminder_24h", "reminder_2h"]);
  const eventId = await publishSystemEvent({ organizationId: input.organizationId, sourceSystemId: input.sourceSystemId, eventType: "appointment.reschedule_requested", customerId: inspection.customer_id || null, correlationId: inspection.id, idempotencyKey: `real-estate-inspection:${inspection.id}:reschedule:${startAt}`, source: "real_estate_inspection", payload: { inspectionId: inspection.id, appointmentId: inspection.canonical_appointment_id, requestedStart: startAt, requestedEnd: endAt || null, timezone:schedulingTimezone } });
  return { inspection: pendingWithTimezone, eventId, status: "reschedule_pending" as const };
}

export async function cancelRealEstateInspection(input: { organizationId: string; inspectionId: string; sourceSystemId?: string | null; reason?: string | null;actorId?:string|null }) {
  const inspection = await loadRealEstateInspection(input.organizationId, input.inspectionId);
  if (!inspection.canonical_appointment_id || !input.sourceSystemId) {
    const cancelled = await admin().rpc("cancel_real_estate_inspection_with_audit", { p_organization_id: input.organizationId, p_inspection_id: input.inspectionId, p_reason: input.reason || null,p_actor_id:input.actorId||"system:real_estate" });
    if (cancelled.error) throw cancelled.error;
    const row = Array.isArray(cancelled.data) ? cancelled.data[0] : cancelled.data;
    await projectLegacyLead(input.organizationId, row, "cancelled");
    return { inspection: row as RealEstateInspection, eventId: null, status: "cancelled" as const };
  }
  const pending = await transition({ organizationId: input.organizationId, inspectionId: inspection.id, status: "cancellation_pending", notes: input.reason || "Cancellation requested; awaiting canonical appointment event.",actorId:input.actorId||"system:real_estate" });
  const eventId = await publishSystemEvent({ organizationId: input.organizationId, sourceSystemId: input.sourceSystemId, eventType: "appointment.cancel_requested", customerId: inspection.customer_id || null, correlationId: inspection.id, idempotencyKey: `real-estate-inspection:${inspection.id}:cancel`, source: "real_estate_inspection", payload: { inspectionId: inspection.id, appointmentId: inspection.canonical_appointment_id, reason: input.reason || null } });
  return { inspection: pending, eventId, status: "cancellation_pending" as const };
}

export async function recordRealEstateInspectionOutcome(input: { organizationId: string; inspectionId: string; outcome: "completed" | "no_show"; notes?: string | null;actorId?:string|null }) {
  const inspection = await loadRealEstateInspection(input.organizationId, input.inspectionId);
  assertTransition(inspection.status, input.outcome);
  const updated = await transition({ organizationId: input.organizationId, inspectionId: inspection.id, status: input.outcome, notes: input.notes || null,actorId:input.actorId||"system:real_estate" });
  await admin().from("real_estate_inspection_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("organization_id", input.organizationId).eq("inspection_id", inspection.id).in("status", ["scheduled", "processing"]).in("job_type", ["reminder_24h", "reminder_2h"]);
  await projectLegacyLead(input.organizationId, updated, input.outcome);
  const followup = await createOutcomeFollowupJob(input.organizationId, updated);
  if (updated.customer_id) {
    const stageKey = input.outcome === "completed" ? "negotiation" : "qualified";
    const configuredStage = await admin().from("organization_customer_stages").select("id,key,name").eq("organization_id", input.organizationId).eq("key", stageKey).eq("status", "active").limit(1).maybeSingle();
    if (configuredStage.error) throw configuredStage.error;
    if (configuredStage.data?.id) {
      const stageUpdate = await admin().from("crm_customers").update({ current_stage_id: configuredStage.data.id, updated_at: new Date().toISOString() }).eq("organization_id", input.organizationId).eq("id", updated.customer_id);
      if (stageUpdate.error) throw stageUpdate.error;
    }
    await addCanonicalTimelineEvent({
      organizationId: input.organizationId, customerId: updated.customer_id,
      eventType: `real_estate_inspection.${input.outcome}`, title: input.outcome === "completed" ? "Inspection completed" : "Inspection marked no-show",
      summary: input.notes || null, channel: "internal", sourceTable: "real_estate_inspections", sourceId: updated.id,
      actorType: "system", actorId: "real_estate_inspection", metadata: { outcome: input.outcome, stage_key: stageKey, stage_id: configuredStage.data?.id || null },
    });
  }
  return { inspection: updated, followup };
}
