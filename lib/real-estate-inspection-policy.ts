export type RealEstateInspectionStatus =
  | "requested"
  | "requested_verification"
  | "booking_pending"
  | "unavailable"
  | "booked"
  | "reschedule_pending"
  | "rescheduled"
  | "cancellation_pending"
  | "completed"
  | "cancelled"
  | "no_show"
  | "failed";

export type LegacyInspectionLeadStatus =
  | "inspection_requested"
  | "inspection"
  | "negotiation"
  | "qualified";

const TERMINAL = new Set<RealEstateInspectionStatus>(["completed", "cancelled", "no_show"]);

export function asFutureIso(value: unknown, now = new Date()): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const parsed = new Date(raw);
  if (!raw || Number.isNaN(parsed.getTime())) throw new Error("A valid inspection date and time is required.");
  if (parsed.getTime() <= now.getTime()) throw new Error("Inspection date and time must be in the future.");
  return parsed.toISOString();
}

export function optionalFutureIso(value: unknown, now = new Date()): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return asFutureIso(value, now);
}

export function inspectionLeadStatus(status: RealEstateInspectionStatus): LegacyInspectionLeadStatus {
  if (status === "requested" || status === "requested_verification") return "inspection_requested";
  if (status === "completed") return "negotiation";
  if (["cancelled", "no_show", "unavailable", "failed"].includes(status)) return "qualified";
  return "inspection";
}

export function canTransitionInspection(from: RealEstateInspectionStatus, to: RealEstateInspectionStatus): boolean {
  if (from === to) return true;
  if (TERMINAL.has(from)) return false;
  const allowed: Record<RealEstateInspectionStatus, RealEstateInspectionStatus[]> = {
    requested: ["requested_verification", "booking_pending", "unavailable", "cancelled", "failed"],
    requested_verification: ["requested", "booking_pending", "unavailable", "cancelled", "failed"],
    booking_pending: ["booked", "reschedule_pending", "cancellation_pending", "unavailable", "cancelled", "failed"],
    unavailable: ["requested", "requested_verification", "booking_pending", "cancelled", "failed"],
    booked: ["reschedule_pending", "cancellation_pending", "completed", "cancelled", "no_show", "failed"],
    reschedule_pending: ["rescheduled", "cancellation_pending", "cancelled", "unavailable", "failed"],
    rescheduled: ["reschedule_pending", "cancellation_pending", "completed", "cancelled", "no_show", "failed"],
    cancellation_pending: ["cancelled", "failed"],
    completed: [],
    cancelled: [],
    no_show: [],
    failed: [],
  };
  return allowed[from].includes(to);
}

export function assertTransition(from: RealEstateInspectionStatus, to: RealEstateInspectionStatus): void {
  if (!canTransitionInspection(from, to)) throw new Error(`Invalid inspection transition: ${from} -> ${to}.`);
}

export function assertVerifiedActiveProperty(input: {
  requestedPropertyId?: string | null;
  existingPropertyId?: string | null;
  propertyStatus?: string | null;
}): string {
  const requested = String(input.requestedPropertyId || "").trim();
  const existing = String(input.existingPropertyId || "").trim();
  if (requested && existing && requested !== existing) throw new Error("Approval property must exactly match the inspection property.");
  const propertyId = requested || existing;
  if (!propertyId) throw new Error("An exact verified property is required before approval.");
  if (input.propertyStatus !== "active") throw new Error("The exact verified property must be active before approval.");
  return propertyId;
}

export function assertBookingPrerequisites(input: {
  customerId?: string | null;
  requestedStartAt?: string | null;
  sourceSystemId?: string | null;
  propertyId?: string | null;
}, now = new Date()): string {
  if (!String(input.customerId || "").trim()) throw new Error("A canonical customer is required before scheduling.");
  if (!String(input.sourceSystemId || "").trim()) throw new Error("An active source system is required before publishing appointment.requested.");
  if (!String(input.propertyId || "").trim()) throw new Error("An exact verified property is required before scheduling.");
  return asFutureIso(input.requestedStartAt, now);
}

export function reminderSchedule(startAt: string, now = new Date()) {
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) throw new Error("Cannot schedule reminders for an invalid inspection time.");
  const jobs = [
    { jobType: "reminder_24h" as const, dueAt: new Date(start.getTime() - 24 * 60 * 60 * 1000) },
    { jobType: "reminder_2h" as const, dueAt: new Date(start.getTime() - 2 * 60 * 60 * 1000) },
    { jobType: "outcome_followup" as const, dueAt: new Date(start.getTime() + 24 * 60 * 60 * 1000) },
  ];
  return jobs.map((job) => ({ ...job, dueAt: job.dueAt.toISOString(), eligible: job.jobType === "outcome_followup" || job.dueAt.getTime() > now.getTime() }));
}

export function appointmentEventCanConfirm(input: {
  eventType: string;
  appointmentStatus?: string | null;
  externalEventId?: string | null;
}): boolean {
  return (input.eventType === "appointment.booked" || input.eventType === "appointment.rescheduled")
    && ["confirmed", "rescheduled"].includes(String(input.appointmentStatus || ""))
    && Boolean(String(input.externalEventId || "").trim());
}

export function propertyVerificationForInput(input: { propertyId?: string | null; propertyQueryText?: string | null; propertyIsActive?: boolean }) {
  const suppliedId = String(input.propertyId || "").trim();
  if (suppliedId && input.propertyIsActive) return { propertyId: suppliedId, status: "verified" as const, queryText: null };
  return {
    propertyId: null,
    status: "unresolved" as const,
    queryText: String(input.propertyQueryText || suppliedId || "").trim().slice(0, 500) || null,
  };
}
