import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { requireHotelOrganization, loadHotelAudience, processDueHotelFollowups } from "@/lib/hotel-communications";
import { HOTEL_BOOKING_STATES, hotelFollowupSuppression } from "@/lib/hotel-communication-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await requirePortalPermission(session, ["customers.view", "customers.manage"]); await requireHotelOrganization(session.organizationId); }
  catch { return NextResponse.json({ error: "Hotel customer access required." }, { status: 403 }); }
  const admin = createAdminClient();
  const results = await Promise.all(["hotel_guest_profiles", "hotel_booking_enquiries", "hotel_followups"].map(table => admin.from(table).select("*").eq("organization_id", session.organizationId).order("created_at", { ascending: false }).limit(200)));
  if (results.some(result => result.error)) return NextResponse.json({ error: "Unable to load hotel records." }, { status: 503 });
  return NextResponse.json({ guests: results[0].data, enquiries: results[1].data, followups: results[2].data });
}

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  try {
    await requirePortalPermission(session, ["customers.manage"]);
    if (["schedule_followup", "dispatch_followups"].includes(String(body.action))) await requirePortalPermission(session, ["conversations.reply"]);
    await requireHotelOrganization(session.organizationId);
  } catch { return NextResponse.json({ error: "Hotel manager permissions required." }, { status: 403 }); }
  const organizationId = session.organizationId; // Never accept a tenant ID from request data.
  const admin = createAdminClient();
  try {
    if (body.action === "dispatch_followups") return NextResponse.json(await processDueHotelFollowups(organizationId));
    if (!uuid(body.customerId)) throw new Error("A valid customerId is required.");
    const customer = await admin.from("crm_customers").select("id").eq("organization_id", organizationId).eq("id", body.customerId).single();
    if (customer.error || !customer.data) throw new Error("Customer is unavailable in this organization.");
    if (body.action === "save_guest") {
      const consent = (value: unknown) => ["unknown", "opted_in", "opted_out"].includes(String(value));
      if (!consent(body.marketingConsent) || !consent(body.serviceConsent) || typeof body.optedOut !== "boolean" || typeof body.humanHandoff !== "boolean") throw new Error("Explicit consent and handover values are required.");
      const result = await admin.from("hotel_guest_profiles").upsert({ organization_id: organizationId, customer_id: body.customerId,
        marketing_consent: body.marketingConsent, service_consent: body.serviceConsent, opted_out: body.optedOut, human_handoff: body.humanHandoff,
        consent_source: String(body.consentSource || "manager").slice(0, 180), updated_by: session.userId,
      }, { onConflict: "organization_id,customer_id" }).select().single();
      if (result.error) throw result.error;
      return NextResponse.json({ guest: result.data });
    }
    if (body.action === "save_enquiry") {
      if (!HOTEL_BOOKING_STATES.includes(body.status as typeof HOTEL_BOOKING_STATES[number])) throw new Error("Invalid booking state.");
      const values = { status: String(body.status), arrival_date: body.arrivalDate || null, departure_date: body.departureDate || null, updated_by: session.userId };
      let query;
      if (body.bookingId) {
        if (!uuid(body.bookingId) || !Number.isInteger(body.revision)) throw new Error("Booking ID and current revision are required.");
        query = admin.from("hotel_booking_enquiries").update(values).eq("organization_id", organizationId).eq("customer_id", body.customerId).eq("id", body.bookingId).eq("revision", body.revision);
      } else query = admin.from("hotel_booking_enquiries").insert({ ...values, organization_id: organizationId, customer_id: body.customerId });
      const result = await query.select().single();
      if (result.error) throw result.error;
      return NextResponse.json({ enquiry: result.data });
    }
    if (body.action === "schedule_followup") {
      await assertFluxFeatureAccess(organizationId, "follow_ups");
      if (!uuid(body.bookingId) || !uuid(body.requestId)) throw new Error("Booking ID and unique request ID are required.");
      const scheduledAt = Date.parse(String(body.scheduledAt || ""));
      if (!Number.isFinite(scheduledAt) || scheduledAt <= Date.now()) throw new Error("A future scheduledAt is required.");
      const audience = await loadHotelAudience(organizationId, [body.customerId]);
      const booking = audience.bookings.find(row => row.id === body.bookingId) || null;
      const reason = hotelFollowupSuppression({ organizationId, customerId: body.customerId, guest: audience.guests[0] || null, booking, bookingRevision: booking?.revision || 0, purpose: String(body.purpose) });
      if (reason) throw new Error(reason);
      const message = String(body.message || "").trim();
      if (!message || message.length > 4000) throw new Error("A message of up to 4000 characters is required.");
      const result = await admin.from("hotel_followups").insert({ organization_id: organizationId, customer_id: body.customerId, booking_id: booking!.id,
        booking_revision: booking!.revision, purpose: body.purpose, scheduled_at: new Date(scheduledAt).toISOString(),
        request_id: body.requestId, message, template_name: String(body.templateName || "").slice(0, 180) || null,
        variables: {},
      }).select().single();
      if (result.error) throw result.error;
      return NextResponse.json({ followup: result.data });
    }
    throw new Error("Unknown hotel action.");
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Hotel operation failed." }, { status: 400 }); }
}
