import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";
import { bookLimitlessInspection, listLimitlessInspections, updateLimitlessInspectionStatus, type LimitlessInspectionStatus } from "@/lib/limitless-inspections";

function authorized(request: NextRequest, session: Awaited<ReturnType<typeof getAdminSession>>) {
  const apiAuth = requireAutomationApiKey(request);
  return Boolean(session || apiAuth.ok);
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!authorized(request, session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const leadId = url.searchParams.get("leadId") || undefined;
    const status = (url.searchParams.get("status") || undefined) as LimitlessInspectionStatus | undefined;
    const inspections = await listLimitlessInspections({ leadId, status });
    return NextResponse.json({ inspections }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load inspections." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!authorized(request, session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const inspection = await bookLimitlessInspection({
      leadId: String(body.leadId || body.lead_id || ""),
      scheduledAt: String(body.scheduledAt || body.scheduled_at || ""),
      propertyId: body.propertyId || body.property_id,
      propertyName: body.propertyName || body.property_name,
      timezone: body.timezone,
      source: body.source || "dashboard",
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, inspection }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to book inspection.";
    const status = /required|valid|future|not found/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!authorized(request, session)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const allowed = new Set<LimitlessInspectionStatus>(["booked", "confirmed", "completed", "cancelled", "rescheduled", "no_show"]);
    const status = String(body.status || "") as LimitlessInspectionStatus;
    if (!allowed.has(status)) return NextResponse.json({ error: "Invalid inspection status." }, { status: 400 });
    const inspection = await updateLimitlessInspectionStatus({ inspectionId: String(body.inspectionId || body.inspection_id || ""), status, notes: body.notes });
    return NextResponse.json({ ok: true, inspection });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update inspection.";
    return NextResponse.json({ error: message }, { status: /not found/i.test(message) ? 404 : 500 });
  }
}
