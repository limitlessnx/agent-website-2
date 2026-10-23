import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import { assertAnyOrganizationPermission, getOrganizationAccessContext } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { findPhotographerConflict } from "@/lib/photography-booking-conflicts";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

const appointmentStatuses = new Set(["requested", "confirmed", "rescheduled", "cancelled"]);
const depositStatuses = new Set(["not_required", "pending", "partial", "paid", "refunded", "failed"]);
const deliveryStatuses = new Set(["not_started", "in_progress", "delivered", "cancelled"]);
function iso(value: unknown) { if (value === null || value === undefined || value === "") return null; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? null : date.toISOString(); }

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getClientOnboardingProfile(session.organizationId).catch(() => null);
  if (profile?.industry !== "photography-studio") return NextResponse.json({ error: "Photography bookings are only available to Xposure workspaces." }, { status: 403 });
  try { const access = await getOrganizationAccessContext(session.organizationId, session.userId); assertAnyOrganizationPermission(access, ["appointments.manage"]); } catch { return NextResponse.json({ error: "appointments.manage permission required." }, { status: 403 }); }
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const admin = createAdminClient();
  const { data: appointment } = await admin.from("appointments").select("id,start_at,end_at,status,title,customer_name,customer_phone,metadata").eq("organization_id", session.organizationId).eq("id", id).maybeSingle();
  if (!appointment) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const startAt = Object.prototype.hasOwnProperty.call(body, "startAt") ? iso(body.startAt) : undefined;
  const endAt = Object.prototype.hasOwnProperty.call(body, "endAt") ? iso(body.endAt) : undefined;
  if (startAt === null || endAt === null) return NextResponse.json({ error: "Booking times must be valid." }, { status: 400 });
  if (startAt && endAt && new Date(endAt) <= new Date(startAt)) return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  const status = Object.prototype.hasOwnProperty.call(body, "status") ? String(body.status || "") : undefined;
  const depositStatus = Object.prototype.hasOwnProperty.call(body, "depositStatus") ? String(body.depositStatus || "") : undefined;
  const deliveryStatus = Object.prototype.hasOwnProperty.call(body, "deliveryStatus") ? String(body.deliveryStatus || "") : undefined;
  const assignedPhotographerId = Object.prototype.hasOwnProperty.call(body, "assignedPhotographerId") ? String(body.assignedPhotographerId || "").trim() || null : undefined;
  if (status && !appointmentStatuses.has(status)) return NextResponse.json({ error: "Invalid booking status." }, { status: 400 });
  if (depositStatus && !depositStatuses.has(depositStatus)) return NextResponse.json({ error: "Invalid deposit status." }, { status: 400 });
  if (deliveryStatus && !deliveryStatuses.has(deliveryStatus)) return NextResponse.json({ error: "Invalid delivery status." }, { status: 400 });
  if (assignedPhotographerId) {
    const { data: member } = await admin.from("organization_memberships").select("user_id").eq("organization_id", session.organizationId).eq("user_id", assignedPhotographerId).eq("status", "active").maybeSingle();
    if (!member) return NextResponse.json({ error: "Selected photographer is not an active workspace member." }, { status: 400 });
  }
  const { data: currentMetadata } = await admin.from("photography_booking_metadata").select("assigned_photographer_id").eq("organization_id", session.organizationId).eq("appointment_id", id).maybeSingle();
  const effectivePhotographerId = assignedPhotographerId !== undefined ? assignedPhotographerId : currentMetadata?.assigned_photographer_id || null;
  const effectiveStartAt = startAt !== undefined ? startAt : appointment.start_at;
  const effectiveEndAt = endAt !== undefined ? endAt : appointment.end_at;
  if (effectivePhotographerId) {
    const conflict = await findPhotographerConflict({ admin, organizationId: session.organizationId, photographerUserId: effectivePhotographerId, startAt: effectiveStartAt, endAt: effectiveEndAt, excludeAppointmentId: id });
    if (conflict) return NextResponse.json({ error: `Photographer is already assigned to “${conflict.title || "another session"}” during this time.`, conflict: { appointmentId: conflict.id, startAt: conflict.start_at, endAt: conflict.end_at } }, { status: 409 });
  }
  const appointmentPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) appointmentPatch.status = status;
  if (startAt !== undefined) appointmentPatch.start_at = startAt;
  if (endAt !== undefined) appointmentPatch.end_at = endAt;
  if (Object.prototype.hasOwnProperty.call(body, "location")) appointmentPatch.location = String(body.location || "").trim().slice(0, 240) || null;
  if (Object.prototype.hasOwnProperty.call(body, "clientNotes")) appointmentPatch.notes = String(body.clientNotes || "").trim().slice(0, 2000) || null;
  const { data: updated, error: updateError } = await admin.from("appointments").update(appointmentPatch).eq("organization_id", session.organizationId).eq("id", id).select("id,status,start_at,end_at,location,notes").single();
  if (updateError || !updated) return NextResponse.json({ error: updateError?.message || "Unable to update booking." }, { status: 400 });
  const metadataPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (depositStatus) metadataPatch.deposit_status = depositStatus;
  if (deliveryStatus) metadataPatch.delivery_status = deliveryStatus;
  if (assignedPhotographerId !== undefined) metadataPatch.assigned_photographer_id = assignedPhotographerId;
  if (Object.prototype.hasOwnProperty.call(body, "shootType")) metadataPatch.shoot_type = String(body.shootType || "other").trim();
  const { data: metadata, error: metadataError } = await admin.from("photography_booking_metadata").update(metadataPatch).eq("organization_id", session.organizationId).eq("appointment_id", id).select().maybeSingle();
  if (metadataError) return NextResponse.json({ ok: true, appointment: updated, warning: "Booking updated, but photography metadata could not be updated." });
  let whatsappWarning: string | undefined;
  const becameConfirmed = status === "confirmed" && appointment.status !== "confirmed";
  const previousMetadata = appointment.metadata && typeof appointment.metadata === "object" ? appointment.metadata as Record<string, unknown> : {};
  if (becameConfirmed && !previousMetadata.whatsapp_confirmation_submitted_at) {
    if (!appointment.customer_phone) {
      whatsappWarning = "Booking confirmed, but client has no phone number for WhatsApp confirmation.";
    } else {
      try {
        const start = new Date(updated.start_at || appointment.start_at || "");
        if (Number.isNaN(start.getTime())) throw new Error("A valid appointment date is required for WhatsApp confirmation.");
        const date = new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeZone: "Africa/Lagos" }).format(start);
        const time = new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(start);
        await sendWhatsAppMessage({
          organizationId: session.organizationId, to: appointment.customer_phone, deliveryMode: "template",
          templatePurpose: "appointment_reminder", requestedTemplateName: "appointment_reminder",
          variables: { customer_name: appointment.customer_name || "there", business_name: "Xposure Studios",
            service_name: updated.title || appointment.title || "Studio session", appointment_date: date,
            appointment_time: time, booking_reference: appointment.id },
        });
        await admin.from("appointments").update({
          metadata: { ...previousMetadata, whatsapp_confirmation_submitted_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        }).eq("organization_id", session.organizationId).eq("id", id);
      } catch (error) {
        whatsappWarning = error instanceof Error ? error.message : "WhatsApp confirmation could not be submitted.";
      }
    }
  }
  return NextResponse.json({ ok: true, appointment: updated, metadata, ...(whatsappWarning ? { warning: whatsappWarning } : {}) });
}
