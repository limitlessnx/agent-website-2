import { NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";

const terminalStatuses = new Set(["completed", "cancelled", "expired"]);

export async function GET() {
  const access = await authorizeXposureTenantAccess("customers.view");
  if (!access.ok) return access.response;
  const { data, error } = await createAdminClient().from("xposure_bookings")
    .select("id,customer_name,customer_phone,service_type,package_name,service_details,requested_start_at,requested_end_at,timezone,amount_minor,currency,booking_status,payment_status,payment_reference,payment_verified_by,payment_verified_at,confirmed_at,follow_up_state,created_at,updated_at")
    .eq("organization_id", access.organizationId).order("created_at", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: "Bookings unavailable. Apply the Xposure booking lifecycle migration." }, { status: 503 });
  return NextResponse.json({ bookings: data || [] });
}

export async function PATCH(request: Request) {
  const access = await authorizeXposureTenantAccess("customers.manage");
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Booking id is required." }, { status: 400 });
  const admin = createAdminClient();
  const { data: current, error: readError } = await admin.from("xposure_bookings")
    .select("id,booking_status,payment_status,requested_start_at,requested_end_at,service_type,service_details,organization_id")
    .eq("organization_id", access.organizationId).eq("id", body.id).maybeSingle();
  if (readError) return NextResponse.json({ error: "Unable to load booking." }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Booking not found in Xposure." }, { status: 404 });
  const action = typeof body.action === "string" ? body.action : "";
  const now = new Date().toISOString();
  let updates: Record<string, unknown> = { updated_at: now };

  if (action === "payment_received" || action === "verify_payment") {
    if (terminalStatuses.has(current.booking_status) || ["verified", "refunded"].includes(current.payment_status)) {
      return NextResponse.json({ error: "Payment cannot be changed for this booking state." }, { status: 409 });
    }
    updates = { ...updates, payment_status: "verified", payment_verified_by: access.actorUserId, payment_verified_at: now, booking_status: current.booking_status === "pending" ? "awaiting_payment" : current.booking_status };
  } else if (action === "reject_payment") {
    if (terminalStatuses.has(current.booking_status) || current.payment_status === "verified" || current.payment_status === "refunded") {
      return NextResponse.json({ error: "Payment cannot be rejected for this booking state." }, { status: 409 });
    }
    updates = { ...updates, payment_status: "rejected", booking_status: "awaiting_payment", follow_up_state: "awaiting_payment" };
  } else if (action === "confirm_booking") {
    if (current.payment_status !== "verified") return NextResponse.json({ error: "An authorized staff member must record Payment Received first." }, { status: 409 });
    if (!["pending", "awaiting_payment", "payment_review"].includes(current.booking_status)) return NextResponse.json({ error: "Only an active, unconfirmed booking can be confirmed." }, { status: 409 });
    if (!current.requested_start_at || !current.requested_end_at) return NextResponse.json({ error: "A requested date and time are required before confirmation." }, { status: 409 });
    if (new Date(current.requested_end_at).getTime() <= new Date(current.requested_start_at).getTime()) return NextResponse.json({ error: "The booking time range is invalid." }, { status: 409 });
    if (["wedding", "videography", "custom"].includes(current.service_type) && (current.service_details as Record<string, unknown>)?.staff_approved_quote !== true) {
      return NextResponse.json({ error: "A staff-approved custom quote is required before confirming this service." }, { status: 409 });
    }
    const { data: conflicts, error: conflictError } = await admin.from("xposure_bookings")
      .select("id").eq("organization_id", access.organizationId).eq("booking_status", "confirmed")
      .lt("requested_start_at", current.requested_end_at).gt("requested_end_at", current.requested_start_at)
      .neq("id", current.id).limit(1);
    if (conflictError) return NextResponse.json({ error: "Unable to verify studio availability. Refresh and retry." }, { status: 503 });
    if (conflicts?.length) return NextResponse.json({ error: "This time overlaps another confirmed booking. Reschedule before confirming." }, { status: 409 });
    updates = { ...updates, booking_status: "confirmed", confirmed_by: access.actorUserId, confirmed_at: now, follow_up_state: "completed" };
  } else if (action === "request_information") {
    if (terminalStatuses.has(current.booking_status)) return NextResponse.json({ error: "This booking is closed." }, { status: 409 });
    updates = { ...updates, follow_up_state: "paused" };
  } else if (action === "cancel_booking") {
    if (current.booking_status === "completed" || current.booking_status === "cancelled" || current.booking_status === "expired") {
      return NextResponse.json({ error: "This booking is already closed." }, { status: 409 });
    }
    updates = { ...updates, booking_status: "cancelled", follow_up_state: "completed" };
  } else if (action === "resume_follow_up") {
    if (terminalStatuses.has(current.booking_status)) return NextResponse.json({ error: "This booking is closed." }, { status: 409 });
    updates = { ...updates, follow_up_state: current.payment_status === "receipt_submitted" ? "receipt_review" : "awaiting_payment" };
  } else {
    return NextResponse.json({ error: "Unsupported booking action." }, { status: 400 });
  }

  const { data, error } = await admin.from("xposure_bookings").update(updates)
    .eq("organization_id", access.organizationId).eq("id", body.id)
    .select("id,booking_status,payment_status,follow_up_state,confirmed_at,payment_verified_at,payment_verified_by").single();
  if (error) return NextResponse.json({ error: "Booking update failed. Refresh and reconcile before retrying." }, { status: 500 });
  return NextResponse.json({ updated: true, booking: data });
}
