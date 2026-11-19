import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSameOriginAdminRequest } from "@/lib/admin-request-origin";
import { isOrganizationId } from "@/lib/organization-context-catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Same-origin request required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
    const reservationId = typeof body?.reservationId === "string" ? body.reservationId.trim() : "";
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!isOrganizationId(organizationId) || !isOrganizationId(reservationId) || reason.length < 15 || reason.length > 500 || body?.confirmed !== true) {
      return NextResponse.json({ error: "Select an organization and reservation, confirm review, and provide a reason of 15–500 characters." }, { status: 400 });
    }
    const { data, error } = await createAdminClient().rpc("reconcile_flux_credit_capacity", {
      p_organization_id: organizationId, p_reservation_id: reservationId,
      p_actor_email: session.email, p_actor_user_id: session.userId || null, p_reason: reason,
    });
    if (error || !data || data.organization_id !== organizationId || data.id !== reservationId) {
      return NextResponse.json({ error: "Reconciliation could not be verified. Refresh the reservation before retrying." }, { status: 503 });
    }
    if (["settled", "already_settled"].includes(data.outcome) && data.status === "settled") {
      return NextResponse.json({ ok: true, status: "settled", duplicate: data.outcome === "already_settled" });
    }
    const blockers: Record<string, string> = {
      evidence_incomplete: "Saved result, usage and completion evidence must agree. Review the execution records.",
      organization_inactive: "The organization is inactive. Review its access state before reconciliation.",
      unsupported_unit: "This reservation does not have a supported Web AI unit or execution identifier. Manual evidence review is required.",
      reservation_released: "This reservation was already released and cannot be settled.",
      accounting_needs_attention: "Review the original billing period, plan and wallet eligibility before settlement.",
    };
    const blocker = blockers[String(data.code)] || "Matching completion evidence and the original billing agreement are required.";
    return NextResponse.json({ error: "Reservation remains in review. " + blocker + " No provider was replayed or reservation released.", status: data.status }, { status: 409 });
  } catch {
    return NextResponse.json({ error: "Reconciliation is unavailable. Refresh the reservation before retrying." }, { status: 503 });
  }
}
