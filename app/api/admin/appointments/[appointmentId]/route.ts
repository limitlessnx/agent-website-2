import { NextResponse } from "next/server";
import { authorizeXposureAppointmentManagement } from "@/lib/xposure-appointment-authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelCalendarEvent, rescheduleCalendarEvent, type CalendarResource } from "@/lib/calendar-provider";
import { selectAppointmentResource } from "@/lib/appointment-scheduling";

const EDITABLE_STATUSES = new Set(["confirmed", "rescheduled", "cancelled"]);

export async function PATCH(
  request: Request,
  context: { params: Promise<{ appointmentId: string }> },
) {
  const auth = await authorizeXposureAppointmentManagement();
  if (!auth.ok) return auth.response;

  const { appointmentId } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status.trim() : "";
  const startAt = typeof body.startAt === "string" ? body.startAt.trim() : "";
  const endAt = typeof body.endAt === "string" ? body.endAt.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : undefined;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) : undefined;
  if (status && !EDITABLE_STATUSES.has(status)) {
    return NextResponse.json({ error: "Status must be confirmed, rescheduled, or cancelled." }, { status: 400 });
  }
  if ((startAt && !endAt) || (!startAt && endAt)) {
    return NextResponse.json({ error: "Provide both startAt and endAt to reschedule." }, { status: 400 });
  }
  if (status === "cancelled" && (startAt || endAt)) {
    return NextResponse.json({ error: "Cancel and reschedule are separate actions. Submit one at a time." }, { status: 400 });
  }
  if (startAt && (!Number.isFinite(Date.parse(startAt)) || !Number.isFinite(Date.parse(endAt)) || Date.parse(endAt) <= Date.parse(startAt))) {
    return NextResponse.json({ error: "A valid startAt/endAt interval is required." }, { status: 400 });
  }
  if (!status && !startAt && title === undefined && notes === undefined) {
    return NextResponse.json({ error: "No supported appointment changes were supplied." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .select("id,organization_id,status,start_at,end_at,title,notes,timezone,provider,calendar_resource_id,external_calendar_id,external_event_id")
    .eq("organization_id", auth.organizationId)
    .eq("id", appointmentId)
    .maybeSingle();
  if (appointmentError) return NextResponse.json({ error: "Unable to load appointment." }, { status: 500 });
  if (!appointment) return NextResponse.json({ error: "Appointment not found in the active tenant." }, { status: 404 });

  const isCancelled = status === "cancelled";
  const isReschedule = Boolean(startAt && endAt);
  if (status === "confirmed" && !appointment.external_event_id) {
    return NextResponse.json({ error: "An appointment cannot be marked confirmed without a linked calendar event." }, { status: 409 });
  }
  const resourceId = String(appointment.calendar_resource_id || "");
  let resource: CalendarResource | null = null;

  if (isReschedule || isCancelled) {
    if (!resourceId || !appointment.external_event_id || !appointment.external_calendar_id) {
      return NextResponse.json({ error: "This appointment has no linked calendar event; reconcile it before changing calendar state." }, { status: 409 });
    }
    const { data, error } = await admin.from("appointment_calendar_resources")
      .select("*").eq("organization_id", auth.organizationId).eq("id", resourceId).maybeSingle();
    if (error) return NextResponse.json({ error: "Unable to load the linked calendar resource." }, { status: 500 });
    if (!data) return NextResponse.json({ error: "The linked calendar resource was not found in this tenant." }, { status: 409 });
    resource = data as CalendarResource;
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (isReschedule) {
    updates.start_at = new Date(startAt).toISOString();
    updates.end_at = new Date(endAt).toISOString();
    if (!status) updates.status = "rescheduled";
  }
  if (title !== undefined) updates.title = title;
  if (notes !== undefined) updates.notes = notes;

  const { data: updated, error: updateError } = await admin.from("appointments")
    .update(updates)
    .eq("organization_id", auth.organizationId)
    .eq("id", appointmentId)
    .select("id,status,start_at,end_at,title,notes,timezone,external_event_id,external_html_link")
    .single();
  if (updateError) {
    if (updateError.message?.includes("TENANT_APPOINTMENT_CAPACITY_REACHED")) {
      return NextResponse.json({
        error: "The requested time has reached this organization's simultaneous appointment capacity.",
        available: false,
      }, { status: 409 });
    }
    return NextResponse.json({ error: "Appointment database update failed; the linked calendar was not changed." }, { status: 500 });
  }

  if ((isReschedule || isCancelled) && resource && appointment.external_event_id) {
    try {
      if (isReschedule) {
        await rescheduleCalendarEvent({
          organizationId: auth.organizationId,
          resource,
          eventId: String(appointment.external_event_id),
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
        });
      } else {
        await cancelCalendarEvent({
          organizationId: auth.organizationId,
          resource,
          eventId: String(appointment.external_event_id),
        });
      }
    } catch {
      const rollback = await admin.from("appointments").update({
        status: appointment.status,
        start_at: appointment.start_at,
        end_at: appointment.end_at,
        title: appointment.title,
        notes: appointment.notes,
        updated_at: new Date().toISOString(),
      }).eq("organization_id", auth.organizationId).eq("id", appointmentId);
      if (rollback.error) {
        return NextResponse.json({
          error: "Calendar action failed and database rollback also failed. Reconcile this appointment before retrying.",
          reconciliation_required: true,
        }, { status: 500 });
      }
      return NextResponse.json({
        error: isReschedule
          ? "Calendar reschedule failed. The database appointment was restored."
          : "Calendar cancellation failed. The database appointment was restored.",
      }, { status: 502 });
    }
  }

  return NextResponse.json({ updated: true, appointment: updated });
}
