import { NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const access = await authorizeXposureTenantAccess("customers.view");
  if (!access.ok) return access.response;
  const { data, error } = await createAdminClient().from("xposure_bookings")
    .select("id,customer_name,customer_phone,service_type,package_name,service_details,requested_start_at,requested_end_at,timezone,amount_minor,currency,booking_status,payment_status,receipt_url,payment_reference,payment_verified_at,confirmed_at,follow_up_state,created_at,updated_at")
    .eq("organization_id", access.organizationId).order("created_at", { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: "Bookings could not be loaded. Apply the Xposure booking/payment migration." }, { status: 503 });
  return NextResponse.json({ bookings: data || [] });
}

export async function PATCH(request: Request) {
  const access = await authorizeXposureTenantAccess("customers.manage");
  if (!access.ok) return access.response;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Booking id is required." }, { status: 400 });
  const admin = createAdminClient();
  const { data: current, error: readError } = await admin.from("xposure_bookings")
    .select("id,booking_status,payment_status,requested_start_at,requested_end_at,service_type,service_details")
    .eq("organization_id", access.organizationId).eq("id", body.id).maybeSingle();
  if (readError) return NextResponse.json({ error: "Unable to load booking." }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Booking not found in Xposure." }, { status: 404 });

  const action = typeof body.action === "string" ? body.action : "";
  const now = new Date().toISOString();
  let updates: Record<string, unknown> = { updated_at: now };
  if (action === "verify_payment") {
    if (current.payment_status !== "receipt_submitted") return NextResponse.json({ error: "Only a submitted receipt can be verified." }, { status: 409 });
    updates = { ...updates, payment_status: "verified", payment_verified_by: access.actorUserId, payment_verified_at: now, booking_status: "awaiting_payment" === current.booking_status ? "awaiting_payment" : current.booking_status };
  } else if (action === "reject_payment") {
    if (current.payment_status !== "receipt_submitted") return NextResponse.json({ error: "Only a submitted receipt can be rejected." }, { status: 409 });
    updates = { ...updates, payment_status: "rejected", booking_status: "awaiting_payment", follow_up_state: "awaiting_payment" };
  } else if (action === "confirm_booking") {
    if (current.payment_status !== "verified") return NextResponse.json({ error: "Verify payment before confirming the booking." }, { status: 409 });
    if (!current.requested_start_at || !current.requested_end_at) return NextResponse.json({ error: "A requested date and time are required before confirmation." }, { status: 409 });
    if (["wedding", "videography", "custom"].includes(current.service_type) && !(current.service_details as Record<string, unknown>)?.staff_approved_quote) return NextResponse.json({ error: "A staff-approved custom quote is required before confirming this service." }, { status: 409 });
    updates = { ...updates, booking_status: "confirmed", confirmed_by: access.actorUserId, confirmed_at: now, follow_up_state: "completed" };
  } else if (action === "request_information") {
    updates = { ...updates, follow_up_state: "paused" };
  } else if (action === "cancel_booking") {
    if (current.booking_status === "completed") return NextResponse.json({ error: "Completed bookings cannot be cancelled." }, { status: 409 });
    updates = { ...updates, booking_status: "cancelled", follow_up_state: "completed" };
  } else if (action === "resume_follow_up") {
    updates = { ...updates, follow_up_state: current.payment_status === "receipt_submitted" ? "receipt_review" : "awaiting_payment" };
  } else {
    return NextResponse.json({ error: "Unsupported booking action." }, { status: 400 });
  }

  const { data, error } = await admin.from("xposure_bookings").update(updates)
    .eq("organization_id", access.organizationId).eq("id", body.id)
    .select("id,booking_status,payment_status,follow_up_state,confirmed_at,payment_verified_at").single();
  if (error) return NextResponse.json({ error: "Booking update failed. Refresh and reconcile before retrying." }, { status: 500 });
  return NextResponse.json({ updated: true, booking: data });
}
