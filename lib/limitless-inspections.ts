import { createAdminClient } from "@/lib/supabase/admin";
import {
  approveRealEstateInspection,
  cancelRealEstateInspection,
  listRealEstateInspections,
  loadRealEstateInspection,
  recordRealEstateInspectionOutcome,
  requestRealEstateInspection,
  resolveLimitlessSourceSystemId,
  rescheduleRealEstateInspection,
  type RealEstateInspection,
} from "@/lib/real-estate-inspections";
import type { RealEstateInspectionStatus } from "@/lib/real-estate-inspection-policy";

export const LIMITLESS_REALTY_ORGANIZATION_ID = process.env.LIMITLESS_REALTY_ORGANIZATION_ID || "b15f21b4-5697-4d21-9421-8a34eae3476d";
export type LimitlessInspectionStatus = RealEstateInspectionStatus | "confirmed";
export type LimitlessInspection = {
  id: string;
  organization_id: string;
  lead_id: string;
  legacy_lead_id?: string | null;
  crm_lead_id?: string | null;
  customer_id?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  property_query_text?: string | null;
  scheduled_at: string | null;
  requested_start_at?: string | null;
  requested_end_at?: string | null;
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

type FacadeInput = { organizationId?: string | null };
function clean(value: unknown, max = 1000) { return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max); }
function organizationId(input?: FacadeInput) { return clean(input?.organizationId, 100) || LIMITLESS_REALTY_ORGANIZATION_ID; }
function scheduledAt(row: RealEstateInspection) { return row.requested_start_at || null; }

async function propertyName(organization: string, propertyId?: string | null) {
  if (!propertyId) return null;
  const { data, error } = await createAdminClient().from("properties").select("title").eq("organization_id", organization).eq("id", propertyId).maybeSingle();
  if (error) throw error;
  return clean(data?.title, 240) || null;
}

async function reminderIds(organization: string, inspectionId: string) {
  const { data, error } = await createAdminClient().from("real_estate_inspection_jobs").select("id,job_type,status").eq("organization_id", organization).eq("inspection_id", inspectionId).in("job_type", ["reminder_24h", "reminder_2h", "outcome_followup"]);
  if (error) throw error;
  const byType = new Map((data || []).map((row: { job_type: unknown; id: unknown }) => [String(row.job_type), String(row.id)]));
  return { reminder_24h_task_id: byType.get("reminder_24h") || null, reminder_2h_task_id: byType.get("reminder_2h") || null, post_followup_task_id: byType.get("outcome_followup") || null };
}

async function toFacade(row: RealEstateInspection): Promise<LimitlessInspection> {
  const organization = String(row.organization_id);
  const [name, tasks] = await Promise.all([propertyName(organization, row.property_id), reminderIds(organization, row.id)]);
  return {
    id: row.id, organization_id: organization,
    lead_id: String(row.legacy_lead_id || row.crm_lead_id || ""),
    legacy_lead_id: row.legacy_lead_id || null, crm_lead_id: row.crm_lead_id || null,
    customer_id: row.customer_id || null, property_id: row.property_id || null,
    property_name: name || row.property_query_text || null,
    property_query_text: row.property_query_text || null,
    scheduled_at: scheduledAt(row), requested_start_at: row.requested_start_at || null, requested_end_at: row.requested_end_at || null,
    timezone: row.timezone, status: row.status, source: row.source, notes: row.notes || null,
    ...tasks, created_at: row.created_at, updated_at: row.updated_at,
  };
}

export async function listLimitlessInspections(input: { organizationId?: string | null; leadId?: string; customerId?: string; status?: LimitlessInspectionStatus; limit?: number } = {}) {
  const rows = await listRealEstateInspections({ organizationId: organizationId(input), customerId: input.customerId, status: input.status === "confirmed" ? "booked" : input.status, limit: input.limit });
  const filtered = input.leadId ? rows.filter((row) => row.legacy_lead_id === input.leadId || row.crm_lead_id === input.leadId) : rows;
  return Promise.all(filtered.map(toFacade));
}

export async function requestLimitlessInspection(input: {
  organizationId?: string;
  leadId: string;
  requestedAt?: string | null;
  requestedEndAt?: string | null;
  propertyId?: string;
  propertyName?: string;
  propertyQueryText?: string;
  timezone?: string;
  source?: string;
  notes?: string;
  idempotencyKey?: string;
}) {
  const org = organizationId(input);
  const row = await requestRealEstateInspection({
    organizationId: org, legacyLeadId: clean(input.leadId, 100), propertyId: clean(input.propertyId, 100) || null,
    propertyQueryText: clean(input.propertyQueryText || input.propertyName, 500) || null,
    requestedStartAt: input.requestedAt || null, requestedEndAt: input.requestedEndAt || null,
    timezone: input.timezone, source: input.source || "limitless_automation", notes: input.notes, idempotencyKey: input.idempotencyKey,
  });
  return toFacade(row);
}

export async function bookLimitlessInspection(input: {
  organizationId?: string;
  inspectionId?: string;
  leadId?: string;
  scheduledAt: string;
  requestedEndAt?: string | null;
  propertyId?: string;
  propertyName?: string;
  timezone?: string;
  source?: string;
  notes?: string;
  approvedBy?: string;
  sourceSystemId?: string;
  idempotencyKey?: string;
}) {
  const org = organizationId(input);
  let inspection: RealEstateInspection;
  if (input.inspectionId) {
    inspection = await loadRealEstateInspection(org, clean(input.inspectionId, 100));
  } else {
    if (!input.leadId) throw new Error("leadId is required.");
    inspection = await requestRealEstateInspection({
      organizationId: org, legacyLeadId: clean(input.leadId, 100), propertyId: clean(input.propertyId, 100) || null,
      propertyQueryText: clean(input.propertyName, 500) || null,
      requestedStartAt: input.scheduledAt, requestedEndAt: input.requestedEndAt || null,
      timezone: input.timezone, source: input.source || "limitless_admin", notes: input.notes, idempotencyKey: input.idempotencyKey,
    });
  }
  if (!clean(input.approvedBy,320)) throw new Error("Verified admin approval identity is required.");
  const sourceSystemId = await resolveLimitlessSourceSystemId(org);
  const approved = await approveRealEstateInspection({
    organizationId: org, inspectionId: inspection.id, approvedBy: clean(input.approvedBy, 320),
    sourceSystemId, propertyId: input.propertyId || null, requestedStartAt: input.scheduledAt,
    requestedEndAt: input.requestedEndAt || null,
  });
  return toFacade(approved.inspection);
}

export async function updateLimitlessInspectionStatus(input: {
  organizationId?: string;
  inspectionId: string;
  status: LimitlessInspectionStatus;
  notes?: string;
  scheduledAt?: string;
  timezone?: string;
  sourceSystemId?: string;
  approvedBy?: string;
}) {
  const org = organizationId(input);
  const existing = await loadRealEstateInspection(org, clean(input.inspectionId, 100));
  if (input.status === "cancelled") {
    const result = await cancelRealEstateInspection({ organizationId: org, inspectionId: existing.id, sourceSystemId: input.sourceSystemId || null, reason: input.notes,actorId:clean(input.approvedBy,320)||"system:limitless" });
    return toFacade(result.inspection);
  }
  if (input.status === "rescheduled") {
    if (!input.scheduledAt) throw new Error("Rescheduling requires a future scheduledAt.");
    const result = await rescheduleRealEstateInspection({ organizationId: org, inspectionId: existing.id, sourceSystemId: await resolveLimitlessSourceSystemId(org), requestedStartAt: input.scheduledAt, timezone: input.timezone || null, reason: input.notes,actorId:clean(input.approvedBy,320)||"system:limitless" });
    return toFacade(result.inspection);
  }
  if (input.status === "completed" || input.status === "no_show") {
    const result = await recordRealEstateInspectionOutcome({ organizationId: org, inspectionId: existing.id, outcome: input.status, notes: input.notes,actorId:clean(input.approvedBy,320)||"system:limitless" });
    return toFacade(result.inspection);
  }
  if (["booked", "confirmed"].includes(input.status)) throw new Error("An inspection becomes booked only after the canonical appointment external event is observed.");
  if (input.status === "booking_pending") throw new Error("Use the admin booking operation to approve and request an appointment.");
  throw new Error(`Status ${input.status} is not directly writable through the Limitless facade.`);
}
