import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { requireHotelOrganization } from "@/lib/hotel-communications";
import { HotelWorkspaceError, hotelUuid, loadHotelReservation, loadHotelWorkspace, mutateHotelWorkspace } from "@/lib/hotel-booking-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Hotel workspace unavailable." }, { status: error instanceof HotelWorkspaceError ? error.status : 503 });
}
export async function GET(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let access;
  try {
    access = session.isAdminPreview ? { permissions: new Set(["customers.view", "billing.view"]) } : await requirePortalPermission(session, ["customers.view", "customers.manage"]);
    await requireHotelOrganization(session.organizationId);
  }
  catch { return NextResponse.json({ error: "Hotel customer access required." }, { status: 403 }); }
  const canViewPayments = access.permissions.has("billing.view") || access.permissions.has("billing.manage");
  try {
    const params = new URL(request.url).searchParams;
    if (params.has("bookingId")) return NextResponse.json(await loadHotelReservation(session.organizationId, hotelUuid(params.get("bookingId"), "Reservation"), canViewPayments));
    return NextResponse.json(await loadHotelWorkspace(session.organizationId, { arrival: params.get("arrival") || "", departure: params.get("departure") || "", guests: Number(params.get("guests") || 1),arrivalDay:params.get("arrivalDay")||undefined,departureDay:params.get("departureDay")||undefined,status:params.get("filter")||undefined,query:params.get("query")||undefined,page:Number(params.get("page")||0),pendingOnly:params.get("view")==="payments", canViewPayments, canManage: !session.isAdminPreview && access.permissions.has("customers.manage"), canManagePayments: !session.isAdminPreview && access.permissions.has("customers.manage") && access.permissions.has("billing.manage") }));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "A valid form is required." }, { status: 400 });
  try {
    await requirePortalPermission(session, ["customers.manage"]);
    if (["record_payment", "verify_payment", "reject_payment", "void_payment"].includes(body.action)) await requirePortalPermission(session, ["billing.manage"]);
    await requireHotelOrganization(session.organizationId);
  } catch { return NextResponse.json({ error: "Hotel manager permissions required for this action." }, { status: 403 }); }
  try { return NextResponse.json(await mutateHotelWorkspace(session.organizationId, session.userId, body)); }
  catch (error) { return failure(error); }
}
