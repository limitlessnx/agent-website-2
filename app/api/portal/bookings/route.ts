import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { assertAnyOrganizationPermission, getOrganizationAccessContext } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPhotographerConflict } from "@/lib/photography-booking-conflicts";
import { enqueueAppointmentConfirmation } from "@/lib/appointment-notification-outbox";

export const dynamic = "force-dynamic";

type Body = { status?: string; customerId?: string; catalogueItemId?: string; title?: string; startAt?: string; endAt?: string; shootType?: string; location?: string; depositStatus?: string; deliveryStatus?: string; assignedPhotographerId?: string; clientNotes?: string };
const shootTypes = new Set(["portrait", "wedding", "maternity", "birthday", "family", "creative_set", "other"]);
const depositStatuses = new Set(["not_required", "pending", "partial", "paid", "refunded", "failed"]);
const deliveryStatuses = new Set(["not_started", "in_progress", "delivered", "cancelled"]);
function iso(value: unknown) { const date = new Date(String(value || "")); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  if (profile?.industry !== "photography-studio") return NextResponse.json({ error: "Photography bookings are only available to Xposure workspaces." }, { status: 403 });
  try { const access = await getOrganizationAccessContext(session.organizationId, session.userId); assertAnyOrganizationPermission(access, ["appointments.manage"]); } catch { return NextResponse.json({ error: "appointments.manage permission required." }, { status: 403 }); }
  const body = await request.json().catch(() => ({})) as Body;
  const customerId = String(body.customerId || "").trim();
  const catalogueItemId = String(body.catalogueItemId || "").trim() || null;
  const title = String(body.title || "Studio session").trim().slice(0, 180);
  const startAt = iso(body.startAt);
  const endAt = iso(body.endAt);
  if (!customerId || !startAt) return NextResponse.json({ error: "Client and booking start time are required." }, { status: 400 });
  if (endAt && new Date(endAt) <= new Date(startAt)) return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  if (body.status !== undefined && !["requested", "confirmed"].includes(body.status)) return NextResponse.json({ error: "New bookings must be requested or confirmed." }, { status: 400 });
  const status = body.status === "confirmed" ? "confirmed" : "requested";
  const shootType = shootTypes.has(String(body.shootType)) ? String(body.shootType) : "other";
  const depositStatus = depositStatuses.has(String(body.depositStatus)) ? String(body.depositStatus) : "not_required";
  const deliveryStatus = deliveryStatuses.has(String(body.deliveryStatus)) ? String(body.deliveryStatus) : "not_started";
  const assignedPhotographerId = String(body.assignedPhotographerId || "").trim() || null;
  const admin = createAdminClient();
  const [{ data: customer }, { data: appointmentSystem }] = await Promise.all([
    admin.from("crm_customers").select("id,full_name,email,phone").eq("organization_id", session.organizationId).eq("id", customerId).maybeSingle(),
    admin.from("organization_systems").select("id,system_catalog(slug)").eq("organization_id", session.organizationId).eq("status", "active").eq("system_catalog.slug", "appointment-system").maybeSingle(),
  ]);
  if (!customer) return NextResponse.json({ error: "Client was not found in this workspace." }, { status: 400 });
  if (!appointmentSystem) return NextResponse.json({ error: "The Appointment System is not active for this workspace." }, { status: 409 });
  let packageName: string | null = null;
  if (catalogueItemId) {
    const { data: item } = await admin.from("photography_catalogue_items").select("id,name").eq("organization_id", session.organizationId).eq("id", catalogueItemId).in("status", ["active", "draft"]).maybeSingle();
    if (!item) return NextResponse.json({ error: "Selected catalogue package was not found." }, { status: 400 });
    packageName = item.name;
  }
  if (assignedPhotographerId) {
    const { data: member } = await admin.from("organization_memberships").select("user_id").eq("organization_id", session.organizationId).eq("user_id", assignedPhotographerId).eq("status", "active").maybeSingle();
    if (!member) return NextResponse.json({ error: "Selected photographer is not an active workspace member." }, { status: 400 });
    const effectiveEndAt = endAt || new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString();
    const conflict = await findPhotographerConflict({ admin, organizationId: session.organizationId, photographerUserId: assignedPhotographerId, startAt, endAt: effectiveEndAt });
    if (conflict) return NextResponse.json({ error: `Photographer is already assigned to “${conflict.title || "another session"}” during this time.`, conflict: { appointmentId: conflict.id, startAt: conflict.start_at, endAt: conflict.end_at } }, { status: 409 });
  }
  const { data: appointment, error: appointmentError } = await admin.from("appointments").insert({ organization_id: session.organizationId, customer_id: customerId, appointment_system_id: appointmentSystem.id, status, title: title || packageName || "Studio session", start_at: startAt, end_at: endAt, customer_name: customer.full_name, customer_email: customer.email, customer_phone: customer.phone, location: String(body.location || "").trim().slice(0, 240) || null, notes: String(body.clientNotes || "").trim().slice(0, 2000) || null, provider: "dashboard", metadata: { source: "exposure_booking_form", catalogue_item_id: catalogueItemId, shoot_type: shootType } }).select("id,metadata").single();
  if (appointmentError || !appointment) return NextResponse.json({ error: appointmentError?.message || "Unable to create booking." }, { status: 400 });
  const { error: metadataError } = await admin.from("photography_booking_metadata").insert({ organization_id: session.organizationId, appointment_id: appointment.id, shoot_type: shootType, catalogue_item_id: catalogueItemId, assigned_photographer_id: assignedPhotographerId, studio_location: String(body.location || "").trim().slice(0, 240) || null, deposit_status: depositStatus, delivery_status: deliveryStatus, client_notes: String(body.clientNotes || "").trim().slice(0, 2000) });
  if (metadataError) return NextResponse.json({ ok: true, appointment, warning: "Booking created, but photography metadata could not be attached." });
  let whatsappWarning: string | undefined;
  if (status === "confirmed" && customer.phone) {
    try {
      const start = new Date(startAt);
      const date = new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeZone: "Africa/Lagos" }).format(start);
      const time = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(start);
      await enqueueAppointmentConfirmation({
        organizationId: session.organizationId,
        appointmentId: appointment.id,
        recipient: customer.phone,
        variables: {
          customer_name: customer.full_name || "there", business_name: "Xposure Studios",
          service_name: packageName || title || "Studio session", appointment_date: date,
          appointment_time: time, booking_reference: appointment.id,
        },
      });
    } catch (error) {
      whatsappWarning = error instanceof Error ? error.message : "WhatsApp confirmation could not be queued.";
    }
  } else if (status === "confirmed" && !customer.phone) {
    whatsappWarning = "Booking confirmed, but client has no phone number for WhatsApp confirmation.";
  }
  return NextResponse.json({ ok: true, appointment, ...(whatsappWarning ? { warning: "Booking saved, but WhatsApp confirmation was not sent: " + whatsappWarning } : {}) }, { status: 201 });
}
