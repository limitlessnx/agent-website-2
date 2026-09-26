import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import {
  calendarSlotAvailable,
  cancelCalendarEvent,
  createCalendarEvent,
  rescheduleCalendarEvent,
  type CalendarResource,
} from "@/lib/calendar-provider";
import type { SystemEventEnvelope } from "@/lib/system-orchestrator";

export type SystemWorkflowAdapterInput = {
  event: SystemEventEnvelope;
  routeId: string;
  targetSystemId: string;
  configuration?: Record<string, unknown> | null;
};

type Json = Record<string, unknown>;

type CustomerRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

type AppointmentRow = {
  id: string;
  organization_id: string;
  customer_id: string;
  conversation_id?: string | null;
  source_system_id?: string | null;
  appointment_system_id: string;
  calendar_resource_id?: string | null;
  source_event_id?: string | null;
  correlation_id: string;
  status: string;
  title: string;
  start_at?: string | null;
  end_at?: string | null;
  timezone: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  organizer_email?: string | null;
  provider?: string | null;
  external_calendar_id?: string | null;
  external_event_id?: string | null;
  external_html_link?: string | null;
  location?: string | null;
  notes?: string | null;
  metadata?: Json | null;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function validEmail(value: unknown) {
  const email = text(value).toLowerCase();
  return /^\S+@\S+\.\S+$/.test(email) ? email : "";
}

function safeIso(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function durationMinutes(value: unknown, fallback = 60) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(1440, Math.max(5, Math.round(parsed)));
}

function endFromStart(startAt: string, minutes: number) {
  return new Date(new Date(startAt).getTime() + minutes * 60_000).toISOString();
}

async function emitAppointmentEvent(input: {
  event: SystemEventEnvelope;
  appointmentSystemId: string;
  eventType: string;
  payload: Json;
  idempotencySuffix: string;
}) {
  const admin = createAdminClient() as any;
  const { data, error } = await admin.rpc("publish_system_event", {
    p_organization_id: input.event.organizationId,
    p_source_system_id: input.appointmentSystemId,
    p_event_type: input.eventType,
    p_payload: input.payload,
    p_target_system_id: null,
    p_customer_id: input.event.customerId || null,
    p_conversation_id: input.event.conversationId || null,
    p_correlation_id: input.event.correlationId,
    p_causation_id: input.event.id,
    p_idempotency_key: `appointment:${input.idempotencySuffix}`,
    p_source: "appointment-system",
  });
  if (error) throw error;
  return String(data);
}

async function loadCustomer(event: SystemEventEnvelope, payload: Json): Promise<CustomerRow> {
  if (!event.customerId) throw new Error("Appointment events require a customerId.");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crm_customers")
    .select("id,full_name,email,phone")
    .eq("organization_id", event.organizationId)
    .eq("id", event.customerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Appointment customer was not found in this organization.");

  if (!validEmail(data.email)) {
    const suppliedEmail = validEmail(payload.customerEmail || payload.customer_email);
    if (suppliedEmail) {
      const { data: updated, error: updateError } = await admin
        .from("crm_customers")
        .update({ email: suppliedEmail, updated_at: new Date().toISOString() })
        .eq("organization_id", event.organizationId)
        .eq("id", event.customerId)
        .select("id,full_name,email,phone")
        .single();
      if (updateError) throw updateError;
      return updated as CustomerRow;
    }
  }

  return data as CustomerRow;
}

async function resolveCalendarResource(
  organizationId: string,
  requestedResourceId?: string | null,
): Promise<CalendarResource | null> {
  const admin = createAdminClient();
  if (requestedResourceId) {
    const { data, error } = await admin
      .from("appointment_calendar_resources")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", requestedResourceId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return data as CalendarResource | null;
  }

  const { data: preferred, error: preferredError } = await admin
    .from("appointment_calendar_resources")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  if (preferredError) throw preferredError;
  if (preferred) return preferred as CalendarResource;

  const { data: fallback, error: fallbackError } = await admin
    .from("appointment_calendar_resources")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fallbackError) throw fallbackError;
  return fallback as CalendarResource | null;
}

async function loadAppointment(organizationId: string, appointmentId: string) {
  const { data, error } = await createAdminClient()
    .from("appointments")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Appointment was not found in this organization.");
  return data as AppointmentRow;
}

async function findAppointmentBySourceEvent(event: SystemEventEnvelope) {
  const { data, error } = await createAdminClient()
    .from("appointments")
    .select("*")
    .eq("organization_id", event.organizationId)
    .eq("source_event_id", event.id)
    .maybeSingle();
  if (error) throw error;
  return data as AppointmentRow | null;
}

async function createRequestedAppointment(input: SystemWorkflowAdapterInput, customer: CustomerRow) {
  const payload = record(input.event.payload);
  const startAt =
    safeIso(payload.requestedStart)
    || safeIso(payload.requested_start_at)
    || safeIso(payload.requested_at)
    || safeIso(payload.preferred_at);
  if (!startAt) throw new Error("appointment.requested requires a valid requestedStart.");

  const explicitEnd = safeIso(payload.requestedEnd || payload.requested_end_at);
  const initialDuration = durationMinutes(payload.durationMinutes || payload.duration_minutes, 60);
  const endAt = explicitEnd || endFromStart(startAt, initialDuration);

  const existing = await findAppointmentBySourceEvent(input.event);
  if (existing) return { appointment: existing, duplicate: true };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .insert({
      organization_id: input.event.organizationId,
      customer_id: customer.id,
      conversation_id: input.event.conversationId || null,
      source_system_id: input.event.sourceSystemId,
      appointment_system_id: input.targetSystemId,
      source_event_id: input.event.id,
      correlation_id: input.event.correlationId,
      status: "requested",
      title: text(payload.title) || text(payload.appointmentTitle) || "Appointment",
      start_at: startAt,
      end_at: endAt,
      timezone: text(payload.timezone) || "Africa/Lagos",
      customer_name: customer.full_name || text(payload.customerName) || null,
      customer_email: validEmail(customer.email) || null,
      customer_phone: customer.phone || text(payload.customerPhone) || null,
      location: text(payload.location) || null,
      notes: text(payload.reason) || text(payload.notes) || null,
      metadata: {
        route_id: input.routeId,
        requested_duration_minutes: initialDuration,
        source_event_type: input.event.eventType,
      },
    })
    .select("*")
    .single();
  if (error) throw error;
  return { appointment: data as AppointmentRow, duplicate: false };
}

async function updateAppointment(
  organizationId: string,
  appointmentId: string,
  values: Record<string, unknown>,
) {
  const { data, error } = await createAdminClient()
    .from("appointments")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", appointmentId)
    .select("*")
    .single();
  if (error) throw error;
  return data as AppointmentRow;
}

async function requestAppointment(input: SystemWorkflowAdapterInput) {
  const payload = record(input.event.payload);
  const customer = await loadCustomer(input.event, payload);
  const created = await createRequestedAppointment(input, customer);
  let appointment = created.appointment;

  if (created.duplicate && ["confirmed", "rescheduled"].includes(appointment.status)) {
    return {
      adapter: "appointment",
      action: "book",
      duplicate: true,
      appointment_id: appointment.id,
      status: appointment.status,
      external_event_id: appointment.external_event_id || null,
    };
  }

  const customerEmail = validEmail(customer.email) || validEmail(appointment.customer_email);
  if (!customerEmail) {
    appointment = await updateAppointment(input.event.organizationId, appointment.id, {
      status: "email_required",
      customer_email: null,
      metadata: {
        ...(appointment.metadata || {}),
        email_requested_at: new Date().toISOString(),
      },
    });
    await emitAppointmentEvent({
      event: input.event,
      appointmentSystemId: input.targetSystemId,
      eventType: "appointment.email_required",
      idempotencySuffix: `${appointment.id}:email-required`,
      payload: {
        appointmentId: appointment.id,
        requestedStart: appointment.start_at,
        requestedEnd: appointment.end_at,
        message: "Please provide the customer's email address so the calendar invitation can be sent.",
        resumeEventType: "appointment.requested",
      },
    });
    return { adapter: "appointment", action: "collect_email", appointment_id: appointment.id, status: "email_required" };
  }

  const resource = await resolveCalendarResource(
    input.event.organizationId,
    text(payload.calendarResourceId || payload.calendar_resource_id) || null,
  );
  if (!resource) {
    appointment = await updateAppointment(input.event.organizationId, appointment.id, {
      status: "calendar_required",
      customer_email: customerEmail,
      metadata: {
        ...(appointment.metadata || {}),
        calendar_required_at: new Date().toISOString(),
      },
    });
    await emitAppointmentEvent({
      event: input.event,
      appointmentSystemId: input.targetSystemId,
      eventType: "appointment.calendar_required",
      idempotencySuffix: `${appointment.id}:calendar-required`,
      payload: {
        appointmentId: appointment.id,
        message: "No active tenant calendar resource is configured.",
      },
    });
    return { adapter: "appointment", action: "calendar_required", appointment_id: appointment.id, status: "calendar_required" };
  }

  const requestedDuration = durationMinutes(
    payload.durationMinutes || payload.duration_minutes,
    resource.default_duration_minutes,
  );
  const startAt = appointment.start_at!;
  const endAt =
    safeIso(payload.requestedEnd || payload.requested_end_at)
    || endFromStart(startAt, requestedDuration);

  appointment = await updateAppointment(input.event.organizationId, appointment.id, {
    status: "pending_availability",
    calendar_resource_id: resource.id,
    customer_email: customerEmail,
    organizer_email: resource.organizer_email || null,
    provider: resource.provider,
    external_calendar_id: resource.external_calendar_id,
    timezone: text(payload.timezone) || resource.timezone,
    end_at: endAt,
  });

  const available = await calendarSlotAvailable({
    organizationId: input.event.organizationId,
    resource,
    startAt,
    endAt,
  });
  if (!available) {
    await emitAppointmentEvent({
      event: input.event,
      appointmentSystemId: input.targetSystemId,
      eventType: "appointment.slot_unavailable",
      idempotencySuffix: `${appointment.id}:slot-unavailable:${startAt}`,
      payload: {
        appointmentId: appointment.id,
        requestedStart: startAt,
        requestedEnd: endAt,
        timezone: appointment.timezone,
      },
    });
    return {
      adapter: "appointment",
      action: "choose_new_slot",
      appointment_id: appointment.id,
      status: "pending_availability",
      requested_start: startAt,
      requested_end: endAt,
    };
  }

  const external = await createCalendarEvent(input.event.organizationId, resource.provider, {
    calendarId: resource.external_calendar_id,
    title: appointment.title,
    description: appointment.notes || undefined,
    location: appointment.location || undefined,
    startAt,
    endAt,
    timezone: appointment.timezone,
    attendeeEmail: customerEmail,
    attendeeName: appointment.customer_name || null,
    appointmentId: appointment.id,
    correlationId: appointment.correlation_id,
  });

  appointment = await updateAppointment(input.event.organizationId, appointment.id, {
    status: "confirmed",
    start_at: startAt,
    end_at: endAt,
    provider: external.provider,
    external_calendar_id: external.calendarId,
    external_event_id: external.eventId,
    external_html_link: external.htmlLink || null,
    metadata: {
      ...(appointment.metadata || {}),
      booked_at: new Date().toISOString(),
    },
  });

  await emitAppointmentEvent({
    event: input.event,
    appointmentSystemId: input.targetSystemId,
    eventType: "appointment.booked",
    idempotencySuffix: `${appointment.id}:booked:${external.eventId}`,
    payload: {
      appointmentId: appointment.id,
      startAt,
      endAt,
      timezone: appointment.timezone,
      customerEmail,
      organizerEmail: appointment.organizer_email || null,
      calendarEventId: external.eventId,
      location: appointment.location || null,
    },
  });

  return {
    adapter: "appointment",
    action: "book",
    duplicate: false,
    appointment_id: appointment.id,
    status: appointment.status,
    start_at: startAt,
    end_at: endAt,
    external_event_id: external.eventId,
  };
}

async function rescheduleAppointment(input: SystemWorkflowAdapterInput) {
  const payload = record(input.event.payload);
  const appointmentId = text(payload.appointmentId || payload.appointment_id);
  if (!appointmentId) throw new Error("appointment.reschedule_requested requires appointmentId.");

  let appointment = await loadAppointment(input.event.organizationId, appointmentId);
  if (!appointment.calendar_resource_id || !appointment.external_event_id) {
    throw new Error("Appointment is not linked to an external calendar event.");
  }
  const resource = await resolveCalendarResource(input.event.organizationId, appointment.calendar_resource_id);
  if (!resource) throw new Error("Appointment calendar resource is not active.");

  const startAt =
    safeIso(payload.requestedStart)
    || safeIso(payload.requested_start_at);
  if (!startAt) throw new Error("appointment.reschedule_requested requires a valid requestedStart.");
  const endAt =
    safeIso(payload.requestedEnd || payload.requested_end_at)
    || endFromStart(startAt, durationMinutes(payload.durationMinutes || payload.duration_minutes, resource.default_duration_minutes));

  const unchanged = appointment.start_at === startAt && appointment.end_at === endAt;
  if (!unchanged) {
    const available = await calendarSlotAvailable({
      organizationId: input.event.organizationId,
      resource,
      startAt,
      endAt,
    });
    if (!available) {
      await emitAppointmentEvent({
        event: input.event,
        appointmentSystemId: input.targetSystemId,
        eventType: "appointment.slot_unavailable",
        idempotencySuffix: `${appointment.id}:reschedule-unavailable:${startAt}`,
        payload: { appointmentId: appointment.id, requestedStart: startAt, requestedEnd: endAt, timezone: resource.timezone },
      });
      return { adapter: "appointment", action: "reschedule", appointment_id: appointment.id, status: "slot_unavailable" };
    }
  }

  const external = unchanged
    ? { eventId: appointment.external_event_id, htmlLink: appointment.external_html_link || null }
    : await rescheduleCalendarEvent({
        organizationId: input.event.organizationId,
        resource,
        eventId: appointment.external_event_id,
        startAt,
        endAt,
      });

  appointment = await updateAppointment(input.event.organizationId, appointment.id, {
    status: "rescheduled",
    start_at: startAt,
    end_at: endAt,
    external_event_id: external.eventId,
    external_html_link: external.htmlLink || appointment.external_html_link || null,
    metadata: { ...(appointment.metadata || {}), rescheduled_at: new Date().toISOString() },
  });

  await emitAppointmentEvent({
    event: input.event,
    appointmentSystemId: input.targetSystemId,
    eventType: "appointment.rescheduled",
    idempotencySuffix: `${appointment.id}:rescheduled:${startAt}`,
    payload: { appointmentId: appointment.id, startAt, endAt, timezone: appointment.timezone },
  });

  return { adapter: "appointment", action: "reschedule", appointment_id: appointment.id, status: "rescheduled", start_at: startAt, end_at: endAt };
}

async function cancelAppointment(input: SystemWorkflowAdapterInput) {
  const payload = record(input.event.payload);
  const appointmentId = text(payload.appointmentId || payload.appointment_id);
  if (!appointmentId) throw new Error("appointment.cancel_requested requires appointmentId.");

  let appointment = await loadAppointment(input.event.organizationId, appointmentId);
  if (appointment.status === "cancelled") {
    return { adapter: "appointment", action: "cancel", duplicate: true, appointment_id: appointment.id, status: "cancelled" };
  }

  if (appointment.calendar_resource_id && appointment.external_event_id) {
    const resource = await resolveCalendarResource(input.event.organizationId, appointment.calendar_resource_id);
    if (resource) {
      await cancelCalendarEvent({
        organizationId: input.event.organizationId,
        resource,
        eventId: appointment.external_event_id,
      });
    }
  }

  appointment = await updateAppointment(input.event.organizationId, appointment.id, {
    status: "cancelled",
    metadata: { ...(appointment.metadata || {}), cancelled_at: new Date().toISOString(), cancellation_reason: text(payload.reason) || null },
  });

  await emitAppointmentEvent({
    event: input.event,
    appointmentSystemId: input.targetSystemId,
    eventType: "appointment.cancelled",
    idempotencySuffix: `${appointment.id}:cancelled`,
    payload: { appointmentId: appointment.id, reason: text(payload.reason) || null },
  });

  return { adapter: "appointment", action: "cancel", appointment_id: appointment.id, status: "cancelled" };
}

async function appointmentAdapter(input: SystemWorkflowAdapterInput) {
  if (input.event.eventType === "appointment.requested") return requestAppointment(input);
  if (input.event.eventType === "appointment.reschedule_requested") return rescheduleAppointment(input);
  if (input.event.eventType === "appointment.cancel_requested") return cancelAppointment(input);
  throw new Error(`Appointment adapter does not support ${input.event.eventType}.`);
}

async function findExistingTask(input: SystemWorkflowAdapterInput) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("crm_tasks")
    .select("id,status,task_type,due_at,metadata")
    .eq("organization_id", input.event.organizationId)
    .contains("metadata", {
      system_event_id: input.event.id,
      system_event_route_id: input.routeId,
    })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function createTask(input: SystemWorkflowAdapterInput, values: {
  taskType: string;
  title: string;
  description: string;
  dueAt?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const existing = await findExistingTask(input);
  if (existing) {
    return {
      adapter: values.taskType,
      duplicate: true,
      task_id: existing.id,
      task_status: existing.status,
    };
  }

  const payload = record(input.event.payload);
  const leadId = text(payload.lead_id) || null;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      organization_id: input.event.organizationId,
      customer_id: input.event.customerId || null,
      lead_id: leadId,
      assigned_agent_id: null,
      task_type: values.taskType,
      title: values.title,
      description: values.description,
      status: values.dueAt ? "scheduled" : "pending",
      due_at: values.dueAt || null,
      metadata: {
        system_event_id: input.event.id,
        system_event_route_id: input.routeId,
        source_system_id: input.event.sourceSystemId,
        target_system_id: input.targetSystemId,
        event_type: input.event.eventType,
        correlation_id: input.event.correlationId,
        causation_id: input.event.causationId || null,
        conversation_id: input.event.conversationId || null,
        contract_version: "1",
        ...(values.metadata || {}),
      },
    })
    .select("id,status,task_type,due_at")
    .single();
  if (error) throw error;

  return {
    adapter: values.taskType,
    duplicate: false,
    task_id: data.id,
    task_status: data.status,
    due_at: data.due_at,
  };
}

async function followUpAdapter(input: SystemWorkflowAdapterInput) {
  const payload = record(input.event.payload);

  if (input.event.eventType === "appointment.cancelled") {
    const appointmentId = text(payload.appointmentId || payload.appointment_id);
    if (!appointmentId) return { adapter: "follow_up", action: "cancel_reminder", cancelled: 0 };
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("crm_tasks")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("organization_id", input.event.organizationId)
      .eq("task_type", "appointment_reminder")
      .in("status", ["pending", "scheduled"])
      .contains("metadata", { appointment_id: appointmentId })
      .select("id");
    if (error) throw error;
    return { adapter: "follow_up", action: "cancel_reminder", cancelled: data?.length || 0 };
  }

  if (input.event.eventType === "appointment.booked" || input.event.eventType === "appointment.rescheduled") {
    const appointmentId = text(payload.appointmentId || payload.appointment_id);
    const startAt = safeIso(payload.startAt || payload.start_at);
    if (!appointmentId || !startAt) throw new Error("Appointment reminder requires appointmentId and startAt.");

    const reminderMinutesBefore = Math.max(0, Math.min(10080, Number(payload.reminderMinutesBefore || payload.reminder_minutes_before || 60)));
    const dueAt = new Date(new Date(startAt).getTime() - reminderMinutesBefore * 60_000).toISOString();
    const existing = await createAdminClient()
      .from("crm_tasks")
      .select("id,status,due_at,metadata")
      .eq("organization_id", input.event.organizationId)
      .eq("task_type", "appointment_reminder")
      .contains("metadata", { appointment_id: appointmentId })
      .in("status", ["pending", "scheduled"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existing.error) throw existing.error;

    if (existing.data) {
      const { data, error } = await createAdminClient()
        .from("crm_tasks")
        .update({
          due_at: dueAt,
          status: "scheduled",
          description: `Reminder for appointment at ${startAt}`,
          metadata: {
            ...record(existing.data.metadata),
            appointment_id: appointmentId,
            start_at: startAt,
            end_at: safeIso(payload.endAt || payload.end_at),
            timezone: text(payload.timezone) || null,
            customer_email: validEmail(payload.customerEmail || payload.customer_email) || null,
            source_system_id: input.targetSystemId,
            correlation_id: input.event.correlationId,
            reminder_minutes_before: reminderMinutesBefore,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", input.event.organizationId)
        .eq("id", existing.data.id)
        .select("id,status,due_at")
        .single();
      if (error) throw error;
      return { adapter: "appointment_reminder", action: "reschedule", task_id: data.id, task_status: data.status, due_at: data.due_at };
    }

    const { data, error } = await createAdminClient()
      .from("crm_tasks")
      .insert({
        organization_id: input.event.organizationId,
        customer_id: input.event.customerId || null,
        assigned_agent_id: null,
        task_type: "appointment_reminder",
        title: "Appointment reminder",
        description: `Reminder for appointment at ${startAt}`,
        status: "scheduled",
        due_at: dueAt,
        metadata: {
          appointment_id: appointmentId,
          start_at: startAt,
          end_at: safeIso(payload.endAt || payload.end_at),
          timezone: text(payload.timezone) || null,
          customer_email: validEmail(payload.customerEmail || payload.customer_email) || null,
          source_system_id: input.targetSystemId,
          correlation_id: input.event.correlationId,
          reminder_minutes_before: reminderMinutesBefore,
          system_event_id: input.event.id,
          system_event_route_id: input.routeId,
        },
      })
      .select("id,status,due_at")
      .single();
    if (error) throw error;
    return { adapter: "appointment_reminder", action: "schedule", task_id: data.id, task_status: data.status, due_at: data.due_at };
  }

  const dueAt =
    safeIso(payload.next_follow_up_at)
    || safeIso(payload.follow_up_at)
    || safeIso(payload.due_at);

  return createTask(input, {
    taskType: "sales_follow_up",
    title: text(payload.title) || "Customer follow-up",
    description: text(payload.reason) || text(payload.message_context) || "Follow-up requested by another installed Fluxknight system.",
    dueAt,
    metadata: {
      channel: text(payload.channel) || null,
      trigger: input.event.eventType,
      appointment_id: text(payload.appointmentId || payload.appointment_id) || null,
    },
  });
}

async function targetSystemSlug(input: SystemWorkflowAdapterInput) {
  const admin = createAdminClient();
  const { data: installation, error } = await admin
    .from("organization_systems")
    .select("system_id")
    .eq("organization_id", input.event.organizationId)
    .eq("id", input.targetSystemId)
    .maybeSingle();
  if (error) throw error;
  if (!installation) throw new Error("Target channel system is not active in organization.");

  const { data: catalog, error: catalogError } = await admin
    .from("system_catalog")
    .select("slug")
    .eq("id", installation.system_id)
    .maybeSingle();
  if (catalogError) throw catalogError;
  return text(catalog?.slug);
}

async function temporaryB6TestOrganization(organizationId: string) {
  const { data, error } = await createAdminClient()
    .from("organizations")
    .select("metadata")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw error;
  return record(data?.metadata).temporary_b6_test === true;
}

function appointmentChannelMessage(event: SystemEventEnvelope) {
  const payload = record(event.payload);
  const startAt = safeIso(payload.startAt || payload.start_at || payload.requestedStart || payload.requested_start_at);
  const when = startAt ? new Date(startAt).toISOString() : "";
  if (event.eventType === "appointment.booked") return `Your appointment is confirmed${when ? ` for ${when}` : ""}.`;
  if (event.eventType === "appointment.rescheduled") return `Your appointment has been rescheduled${when ? ` to ${when}` : ""}.`;
  if (event.eventType === "appointment.cancelled") return "Your appointment has been cancelled.";
  if (event.eventType === "appointment.email_required") return "Please send the email address you want us to use for your calendar invitation.";
  if (event.eventType === "appointment.slot_unavailable") return "That appointment time is unavailable. Please choose another time.";
  if (event.eventType === "reminder.scheduled") return `Reminder: you have an appointment${when ? ` at ${when}` : ""}.`;
  return text(payload.message) || "There is an update to your appointment.";
}

async function channelReplyAdapter(input: SystemWorkflowAdapterInput) {
  const slug = await targetSystemSlug(input);
  if (slug !== "whatsapp-agent") {
    throw new Error(`Deterministic channel reply adapter is not implemented for ${slug || "unknown target"}.`);
  }
  if (!input.event.customerId) throw new Error("Channel delivery requires customerId.");

  const { data: customer, error } = await createAdminClient()
    .from("crm_customers")
    .select("id,phone,email,full_name")
    .eq("organization_id", input.event.organizationId)
    .eq("id", input.event.customerId)
    .maybeSingle();
  if (error) throw error;
  if (!customer?.phone) throw new Error("Customer has no WhatsApp phone number.");

  const message = appointmentChannelMessage(input.event);
  if (await temporaryB6TestOrganization(input.event.organizationId)) {
    return {
      adapter: "channel_reply",
      channel: "whatsapp",
      simulated: true,
      recipient: customer.phone,
      message,
    };
  }

  const result = await sendWhatsAppMessage({
    organizationId: input.event.organizationId,
    to: customer.phone,
    text: message,
    deliveryMode: "auto",
    templatePurpose: input.event.eventType === "reminder.scheduled" ? "appointment_reminder" : "appointment_update",
    variables: {
      customer_name: customer.full_name || "",
      appointment_time: text(input.event.payload.startAt || input.event.payload.start_at || ""),
    },
  });

  return {
    adapter: "channel_reply",
    channel: "whatsapp",
    simulated: false,
    provider_message_id: result.providerMessageId || null,
    message_type: result.messageType,
  };
}

export async function processDueAppointmentReminders(limit = 100) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: tasks, error } = await admin
    .from("crm_tasks")
    .select("id,organization_id,customer_id,due_at,metadata")
    .eq("task_type", "appointment_reminder")
    .eq("status", "scheduled")
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(Math.max(1, Math.min(250, limit)));
  if (error) throw error;

  const results = [];
  for (const task of tasks || []) {
    const metadata = record(task.metadata);
    const sourceSystemId = text(metadata.source_system_id);
    const appointmentId = text(metadata.appointment_id);
    if (!sourceSystemId || !appointmentId || !task.customer_id) {
      await admin.from("crm_tasks").update({
        status: "failed",
        metadata: { ...metadata, reminder_error: "missing_required_context" },
        updated_at: new Date().toISOString(),
      }).eq("organization_id", task.organization_id).eq("id", task.id);
      results.push({ taskId: task.id, status: "failed", reason: "missing_required_context" });
      continue;
    }

    try {
      const { data: eventId, error: publishError } = await (admin as any).rpc("publish_system_event", {
        p_organization_id: task.organization_id,
        p_source_system_id: sourceSystemId,
        p_event_type: "reminder.scheduled",
        p_payload: {
          appointmentId,
          startAt: text(metadata.start_at),
          endAt: text(metadata.end_at) || null,
          timezone: text(metadata.timezone) || null,
          reminderTaskId: task.id,
        },
        p_target_system_id: null,
        p_customer_id: task.customer_id,
        p_conversation_id: null,
        p_correlation_id: text(metadata.correlation_id) || null,
        p_causation_id: null,
        p_idempotency_key: `appointment-reminder:${task.id}`,
        p_source: "follow-up-system",
      });
      if (publishError) throw publishError;

      await admin.from("crm_tasks").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: { ...metadata, reminder_event_id: String(eventId), reminder_emitted_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }).eq("organization_id", task.organization_id).eq("id", task.id);

      results.push({ taskId: task.id, status: "completed", eventId: String(eventId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Reminder emission failed.";
      await admin.from("crm_tasks").update({
        status: "failed",
        metadata: { ...metadata, reminder_error: message.slice(0, 1000) },
        updated_at: new Date().toISOString(),
      }).eq("organization_id", task.organization_id).eq("id", task.id);
      results.push({ taskId: task.id, status: "failed", reason: message });
    }
  }

  return { checked: tasks?.length || 0, results };
}

export async function executeSystemWorkflowAdapter(input: SystemWorkflowAdapterInput) {
  const adapter = text(input.configuration?.adapter);
  if (adapter === "appointment") return appointmentAdapter(input);
  if (adapter === "follow_up") return followUpAdapter(input);
  if (adapter === "channel_reply") return channelReplyAdapter(input);
  throw new Error(`Unsupported system workflow adapter: ${adapter || "missing"}`);
}
