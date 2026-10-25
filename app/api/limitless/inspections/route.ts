import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";
import type { LeoIdentity } from "@/lib/leo-core";
import { consumeLeoActionApproval, createLeoActionApproval } from "@/lib/leo-action-approval";
import {
  bookLimitlessInspection,
  listLimitlessInspections,
  requestLimitlessInspection,
  updateLimitlessInspectionStatus,
  type LimitlessInspectionStatus,
  LIMITLESS_REALTY_ORGANIZATION_ID,
} from "@/lib/limitless-inspections";

function bodyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function field(body: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = body[name];
    if (value === null || value === undefined || value === "") continue;
    if (typeof value !== "string") throw new Error(`${name} must be a valid text value.`);
    return value.trim() || undefined;
  }
  return undefined;
}
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
function statusFor(error: unknown) { const value=message(error,"");if(/single-use appointment approval was rejected/i.test(value))return 409;return /required|valid|future|not found|scope|workspace|active|canonical|status|customer|property|source system|reschedul/i.test(value) ? 400 : 500; }

async function authorize(request: NextRequest, mode: "read" | "request" | "admin") {
  const session = await getAdminSession();
  if (session) {
    const scope = await resolveAdminOrganizationScope();
    if (scope.kind !== "system" || scope.systemId !== "limitless-realty" || scope.organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID) {
      return { ok: false as const, status: 403, reason: "Switch to the Limitless Realty workspace before using inspections." };
    }
    return { ok: true as const, kind: "admin" as const, organizationId: scope.organizationId, actorId: session.email, sessionIssuedAt: session.issuedAt };
  }
  if (mode === "admin") return { ok: false as const, status: 403, reason: "Verified Limitless Realty admin scope is required for this operation." };
  const apiAuth = requireAutomationApiKey(request);
  if (!apiAuth.ok) return { ok: false as const, status: apiAuth.status, reason: apiAuth.message };
  return { ok: true as const, kind: "automation" as const, organizationId: LIMITLESS_REALTY_ORGANIZATION_ID, actorId: null };
}

async function authorizeLegacyInspectionMutation(
  auth: { organizationId: string; actorId: string; sessionIssuedAt: number },
  operation: "book" | "status_change",
  arguments_: Record<string, unknown>,
) {
  const identity: LeoIdentity = {
    scope: "tenant",
    role: "tenant_admin",
    userId: auth.actorId.trim().toLowerCase(),
    email: auth.actorId,
    organizationId: auth.organizationId,
    organizationSlug: "limitless-realty",
    permissions: ["appointments.manage"],
    channel: "api",
    globalScope: false,
  };
  const sessionId = `limitless-inspections:${auth.actorId.trim().toLowerCase()}:${auth.sessionIssuedAt}`;
  const cleanArguments = Object.fromEntries(Object.entries(arguments_).filter(([, value]) => value !== undefined));
  const exactArguments = { operation, organization_id: auth.organizationId, ...cleanArguments };
  const issued = await createLeoActionApproval({
    identity,
    organizationId: auth.organizationId,
    sessionId,
    channel: "api",
    toolKey: "leo.appointment.manage",
    arguments: exactArguments,
    realEstateOptIn: true,
  });
  const consumed = await consumeLeoActionApproval({
    identity,
    organizationId: auth.organizationId,
    sessionId,
    channel: "api",
    toolKey: "leo.appointment.manage",
    arguments: exactArguments,
    approvalId: issued.approvalId,
    token: issued.token,
    realEstateOptIn: true,
  });
  if (!consumed.accepted) throw new Error("The single-use appointment approval was rejected; no inspection change was made.");
  return issued.approvalId;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request, "read");
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });
    const url = new URL(request.url);
    const leadId = url.searchParams.get("leadId") || undefined;
    const customerId = url.searchParams.get("customerId") || undefined;
    const status = (url.searchParams.get("status") || undefined) as LimitlessInspectionStatus | undefined;
    const inspections = await listLimitlessInspections({ organizationId: auth.organizationId, leadId, customerId, status });
    return NextResponse.json({ inspections }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: message(error, "Unable to load inspections.") }, { status: statusFor(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = bodyRecord(await request.json());
    const hasScheduledAt = Boolean(String(field(body, "scheduledAt", "scheduled_at") || "").trim());
    const auth = await authorize(request, hasScheduledAt ? "admin" : "request");
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });
    if (auth.kind === "automation") {
      const inspection = await requestLimitlessInspection({
        organizationId: auth.organizationId,
        leadId: String(field(body, "leadId", "lead_id") || ""),
        requestedAt: field(body, "requestedAt", "requested_at") || null,
        requestedEndAt: field(body, "requestedEndAt", "requested_end_at") || null,
        propertyId: field(body, "propertyId", "property_id"),
        propertyName: field(body, "propertyName", "property_name"),
        propertyQueryText: field(body, "propertyQueryText", "property_query_text"),
        timezone: field(body, "timeZone", "timezone"),
        source: field(body, "source") || "limitless_automation",
        notes: field(body, "notes"),
        idempotencyKey: field(body, "idempotencyKey", "idempotency_key"),
      });
      return NextResponse.json({ ok: true, inspection }, { status: 201 });
    }
    if (field(body, "confirmBooking") !== "yes") return NextResponse.json({ error: "Explicitly confirm this exact admin booking before continuing." }, { status: 400 });
    const bookingInput = {
      organizationId: auth.organizationId,
      inspectionId: field(body, "inspectionId", "inspection_id"),
      leadId: field(body, "leadId", "lead_id"),
      scheduledAt: String(field(body, "scheduledAt", "scheduled_at") || ""),
      requestedEndAt: field(body, "requestedEndAt", "requested_end_at"),
      propertyId: field(body, "propertyId", "property_id"),
      propertyName: field(body, "propertyName", "property_name"),
      timezone: field(body, "timeZone", "timezone"),
      source: field(body, "source") || "limitless_admin",
      notes: field(body, "notes"),
      approvedBy: auth.actorId || undefined,
      idempotencyKey: field(body, "idempotencyKey", "idempotency_key"),
    };
    const approvalId = await authorizeLegacyInspectionMutation(auth, "book", bookingInput);
    const inspection = await bookLimitlessInspection(bookingInput);
    return NextResponse.json({ ok: true, inspection, approvalId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: message(error, "Unable to process inspection request.") }, { status: statusFor(error) });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authorize(request, "admin");
    if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status });
    if (auth.kind !== "admin") return NextResponse.json({ error: "Verified Limitless Realty admin scope is required for this operation." }, { status: 403 });
    const body = bodyRecord(await request.json());
    if (field(body, "confirmStatusChange") !== "yes") return NextResponse.json({ error: "Explicitly confirm this admin status change before continuing." }, { status: 400 });
    const status = String(body.status || "") as LimitlessInspectionStatus;
    const allowed = new Set<LimitlessInspectionStatus>([
      "requested", "requested_verification", "booking_pending", "unavailable", "booked", "confirmed",
      "reschedule_pending", "rescheduled", "cancellation_pending", "completed", "cancelled", "no_show", "failed",
    ]);
    if (!allowed.has(status)) return NextResponse.json({ error: "Invalid inspection status." }, { status: 400 });
    const updateInput = {
      organizationId: auth.organizationId,
      inspectionId: String(field(body, "inspectionId", "inspection_id") || ""),
      status,
      notes: field(body, "notes"),
      scheduledAt: field(body, "scheduledAt", "scheduled_at"),
      timezone: field(body, "timeZone", "timezone"),
      sourceSystemId: field(body, "sourceSystemId", "source_system_id"),
      approvedBy: auth.actorId || undefined,
    };
    const approvalId = await authorizeLegacyInspectionMutation(auth, "status_change", updateInput);
    const inspection = await updateLimitlessInspectionStatus(updateInput);
    return NextResponse.json({ ok: true, inspection, approvalId });
  } catch (error) {
    return NextResponse.json({ error: message(error, "Unable to update inspection.") }, { status: statusFor(error) });
  }
}
