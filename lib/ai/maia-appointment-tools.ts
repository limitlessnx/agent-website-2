import { createAdminClient } from "@/lib/supabase/admin";
import { listLimitlessInspections } from "@/lib/limitless-inspections";
import { findNextAvailableAppointmentSlots, selectAppointmentResource } from "@/lib/appointment-scheduling";
import { createCalendarEvent } from "@/lib/calendar-provider";
import { isRealEstateOrganizationRecord } from "@/lib/real-estate-organization";

const LIMITLESS_REALTY_ORG_ID = "b15f21b4-5697-4d21-9421-8a34eae3476d";

type ToolContext = {
  organizationId: string;
  agentId: string;
  sessionId: string;
  customerId?: string;
  externalConversationId?: string;
  conversationId?: string;
  correlationId?: string;
};

type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

function boundedLimit(value: unknown, fallback = 10) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.round(parsed), 1), 20) : fallback;
}

export function maiaAppointmentTools(): ToolDefinition[] {
  return [
    {
      name: "check_appointment_availability",
      description: "Check the current tenant's appointment routing policy, working hours, buffers, existing Fluxknight appointments and connected calendar free/busy before Maia offers a time. Never claim a slot is available unless the scheduling engine returns available:true.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          startAt: { type: "string", description: "Requested ISO-8601 start time." },
          endAt: { type: "string", description: "Optional ISO-8601 end time. If omitted, the selected resource duration is used." },
          timezone: { type: "string", description: "IANA timezone used for the requested appointment." },
          resourceId: { type: "string", description: "Optional exact tenant calendar resource ID." },
          membershipId: { type: "string", description: "Optional exact tenant staff membership ID." },
          durationMinutes: { type: "integer", minimum: 5, maximum: 1440, description: "Optional requested service duration." },
          serviceKey: { type: "string", description: "Optional service routing key." },
          branchKey: { type: "string", description: "Optional branch routing key." },
          departmentKey: { type: "string", description: "Optional department routing key." }
        },
        required: ["startAt"]
      },
      execute: async (input, ctx) => {
        const startAt = text(input.startAt);
        if (!startAt) throw new Error("startAt is required.");

        const rawDuration = Number(input.durationMinutes);
        const decision = await selectAppointmentResource({
          organizationId: ctx.organizationId,
          startAt,
          requestedEndAt: text(input.endAt) || null,
          requestedDurationMinutes: Number.isFinite(rawDuration) ? rawDuration : null,
          requestedResourceId: text(input.resourceId) || null,
          requestedMembershipId: text(input.membershipId) || null,
          serviceKey: text(input.serviceKey) || null,
          branchKey: text(input.branchKey) || null,
          departmentKey: text(input.departmentKey) || null,
        });

        if (decision.status === "no_resource") {
          return {
            status: "calendar_not_configured",
            provider: "tenant_calendar",
            requested_window: {
              startAt: decision.startAt,
              endAt: decision.endAt,
              timezone: text(input.timezone) || "Africa/Lagos",
            },
            available: false,
            reason: decision.reason || "No active tenant calendar resource is configured.",
            next_action: "Connect Google Calendar, select a calendar resource, and configure appointment availability."
          };
        }

        const resource = decision.resource;
        if (!decision.available || !resource || !decision.endAt) {
          const nextAvailableSlots = await findNextAvailableAppointmentSlots({
            organizationId: ctx.organizationId,
            startAt,
            requestedEndAt: text(input.endAt) || null,
            requestedDurationMinutes: Number.isFinite(rawDuration) ? rawDuration : null,
            requestedResourceId: text(input.resourceId) || null,
            requestedMembershipId: text(input.membershipId) || null,
            serviceKey: text(input.serviceKey) || null,
            branchKey: text(input.branchKey) || null,
            departmentKey: text(input.departmentKey) || null,
          }, { daysAhead: 14, limit: 3 });
          return {
            status: "unavailable",
            next_available_slots: nextAvailableSlots,
            provider: resource?.provider || "tenant_calendar",
            resource: resource ? {
              id: resource.id,
              display_name: resource.display_name,
              organizer_email: resource.organizer_email,
              external_calendar_id: resource.external_calendar_id,
              timezone: resource.timezone,
            } : null,
            requested_window: {
              startAt: decision.startAt,
              endAt: decision.endAt,
              timezone: text(input.timezone) || resource?.timezone || "Africa/Lagos",
            },
            available: false,
            reason: decision.reason || "The requested appointment time is not available.",
            checked_resource_ids: decision.checkedResourceIds,
          };
        }

        return {
          status: "available",
          provider: resource.provider,
          resource: {
            id: resource.id,
            display_name: resource.display_name,
            organizer_email: resource.organizer_email,
            external_calendar_id: resource.external_calendar_id,
            timezone: resource.timezone,
            assigned_membership_id: resource.assigned_membership_id || null,
          },
          requested_window: {
            startAt: decision.startAt,
            endAt: decision.endAt,
            timezone: text(input.timezone) || resource.timezone,
          },
          available: true,
          strategy: decision.strategy,
          checked_resource_ids: decision.checkedResourceIds,
          reason: "The scheduling engine confirmed the requested window against tenant scheduling rules, existing Fluxknight appointments and the connected calendar."
        };
      }
    },
    {
      name: "create_appointment_booking",
      description: "Create a real appointment for a current non-real-estate tenant customer. Real-estate organizations must use the operator-confirmed inspection request flow; never use direct booking to bypass human confirmation. Check availability first, persist a tenant-scoped record, create the connected calendar event, and only then mark the appointment confirmed.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          startAt: { type: "string", description: "Requested ISO-8601 appointment start time." },
          endAt: { type: "string", description: "Optional ISO-8601 appointment end time." },
          timezone: { type: "string", description: "IANA time zone, such as Africa/Lagos." },
          title: { type: "string", description: "Appointment title or service requested." },
          customerName: { type: "string", description: "Customer name if explicitly provided." },
          customerEmail: { type: "string", description: "Customer email required for calendar invitation." },
          customerPhone: { type: "string", description: "Customer phone if explicitly provided." },
          notes: { type: "string", description: "Optional booking notes." },
          location: { type: "string", description: "Optional appointment location." },
          resourceId: { type: "string", description: "Optional exact tenant calendar resource ID." },
          durationMinutes: { type: "integer", minimum: 5, maximum: 1440 },
          serviceKey: { type: "string" },
          branchKey: { type: "string" },
          departmentKey: { type: "string" }
        },
        required: ["startAt", "title"]
      },
      execute: async (input, ctx) => {
        const startAt = text(input.startAt);
        const title = text(input.title).slice(0, 200);
        if (!startAt || !title) throw new Error("startAt and title are required.");
        if (!ctx.customerId) {
          return { status: "customer_required", confirmed: false, next_action: "Resolve or create the customer record before booking." };
        }
        const admin = createAdminClient();
        const { data: organization, error: organizationError } = await admin
          .from("organizations")
          .select("slug,status,metadata")
          .eq("id", ctx.organizationId)
          .maybeSingle();
        if (organizationError) throw organizationError;
        if (!organization || organization.status !== "active") throw new Error("Active tenant organization was not found.");
        if (isRealEstateOrganizationRecord(organization)) {
          return {
            status: "operator_confirmation_required",
            confirmed: false,
            requestedStart: startAt,
            requestedTitle: title,
            next_action: "Create a real-estate inspection request for staff review. Do not create or confirm a calendar booking from Maia.",
          };
        }
        const { data: customer, error: customerError } = await admin
          .from("crm_customers")
          .select("id,email,phone")
          .eq("organization_id", ctx.organizationId)
          .eq("id", ctx.customerId)
          .maybeSingle();
        if (customerError) throw customerError;
        if (!customer) throw new Error("Customer record was not found in the active tenant.");
        const customerEmail = text(input.customerEmail) || text(customer.email);
        const customerName = text(input.customerName) || "Customer";
        const customerPhone = text(input.customerPhone) || text(customer.phone) || text(ctx.externalConversationId);
        if (!customerEmail) {
          return { status: "email_required", confirmed: false, customerId: customer.id, next_action: "Ask the customer for an email address before creating a calendar invitation." };
        }

        const rawDuration = Number(input.durationMinutes);
        const decision = await selectAppointmentResource({
          organizationId: ctx.organizationId,
          startAt,
          requestedEndAt: text(input.endAt) || null,
          requestedDurationMinutes: Number.isFinite(rawDuration) ? rawDuration : null,
          requestedResourceId: text(input.resourceId) || null,
          requestedMembershipId: null,
          serviceKey: text(input.serviceKey) || null,
          branchKey: text(input.branchKey) || null,
          departmentKey: text(input.departmentKey) || null,
          excludeAppointmentId: null,
        });
        if (!decision.available || !decision.resource || !decision.endAt) {
          const nextAvailableSlots = decision.status === "no_resource" ? [] : await findNextAvailableAppointmentSlots({
            organizationId: ctx.organizationId,
            startAt,
            requestedEndAt: text(input.endAt) || null,
            requestedDurationMinutes: Number.isFinite(rawDuration) ? rawDuration : null,
            requestedResourceId: text(input.resourceId) || null,
            requestedMembershipId: null,
            serviceKey: text(input.serviceKey) || null,
            branchKey: text(input.branchKey) || null,
            departmentKey: text(input.departmentKey) || null,
          }, { daysAhead: 14, limit: 3 });
          return {
            status: decision.status === "no_resource" ? "calendar_required" : "slot_unavailable",
            confirmed: false,
            reason: decision.reason || "No available calendar slot.",
            requestedStart: decision.startAt,
            requestedEnd: decision.endAt,
            next_available_slots: nextAvailableSlots,
            next_action: nextAvailableSlots.length
              ? "Offer the customer one of the verified next_available_slots and confirm their choice before booking."
              : "Ask the customer for another preferred date or time; no verified alternative was found in the next 14 days.",
          };
        }

        const { data: catalog, error: catalogError } = await admin
          .from("system_catalog").select("id").eq("slug", "appointment-system").maybeSingle();
        if (catalogError) throw catalogError;
        if (!catalog) throw new Error("Appointment system is not installed in Fluxknight.");
        const { data: installation, error: installationError } = await admin
          .from("organization_systems").select("id")
          .eq("organization_id", ctx.organizationId).eq("system_id", catalog.id)
          .in("status", ["active", "configured", "enabled"]).maybeSingle();
        if (installationError) throw installationError;
        if (!installation) throw new Error("Appointment system is not enabled for this tenant.");

        const correlationId = text(ctx.correlationId) || crypto.randomUUID();
        const { data: existingBooking, error: existingBookingError } = await admin
          .from("appointments")
          .select("id,status,start_at,end_at,title,external_html_link,external_event_id")
          .eq("organization_id", ctx.organizationId)
          .eq("correlation_id", correlationId)
          .maybeSingle();
        if (existingBookingError) throw existingBookingError;
        if (existingBooking) {
          return {
            status: existingBooking.status,
            confirmed: ["confirmed", "rescheduled"].includes(existingBooking.status),
            appointment: existingBooking,
            idempotent: true,
            next_action: existingBooking.status === "failed" ? "A previous booking attempt failed. Review the appointment before retrying." : undefined,
          };
        }
        const { data: appointment, error: insertError } = await admin
          .from("appointments")
          .insert({
            organization_id: ctx.organizationId,
            customer_id: customer.id,
            conversation_id: ctx.conversationId || null,
            appointment_system_id: installation.id,
            calendar_resource_id: decision.resource.id,
            correlation_id: correlationId,
            status: "pending_availability",
            title,
            start_at: decision.startAt,
            end_at: decision.endAt,
            timezone: text(input.timezone) || decision.resource.timezone || "Africa/Lagos",
            customer_name: customerName || null,
            customer_email: customerEmail,
            customer_phone: customerPhone || null,
            organizer_email: decision.resource.organizer_email || null,
            provider: decision.resource.provider,
            external_calendar_id: decision.resource.external_calendar_id,
            location: text(input.location) || null,
            notes: text(input.notes) || null,
            metadata: { source: "maia", agent_id: ctx.agentId, session_id: ctx.sessionId },
          })
          .select("id,organization_id,status,start_at,end_at,title")
          .single();
        if (insertError) {
          if (String(insertError.code || "") === "23514" && /TENANT_APPOINTMENT_CAPACITY_REACHED/.test(String(insertError.message || ""))) {
            const nextAvailableSlots = await findNextAvailableAppointmentSlots({
              organizationId: ctx.organizationId,
              startAt,
              requestedEndAt: text(input.endAt) || null,
              requestedDurationMinutes: Number.isFinite(rawDuration) ? rawDuration : null,
              requestedResourceId: text(input.resourceId) || null,
              serviceKey: text(input.serviceKey) || null,
              branchKey: text(input.branchKey) || null,
              departmentKey: text(input.departmentKey) || null,
            }, { daysAhead: 14, limit: 3 });
            return {
              status: "slot_unavailable",
              confirmed: false,
              reason: "Another booking filled the tenant's available capacity while this request was being processed.",
              next_available_slots: nextAvailableSlots,
              next_action: nextAvailableSlots.length
                ? "Offer the customer one of the verified next_available_slots and confirm their choice before booking."
                : "Ask the customer for another preferred date or time.",
            };
          }
          throw insertError;
        }

        try {
          const event = await createCalendarEvent(ctx.organizationId, decision.resource.provider, {
            calendarId: decision.resource.external_calendar_id,
            title,
            description: text(input.notes) || null,
            location: text(input.location) || null,
            startAt: decision.startAt,
            endAt: decision.endAt,
            timezone: text(input.timezone) || decision.resource.timezone || "Africa/Lagos",
            attendeeEmail: customerEmail,
            attendeeName: customerName || null,
            appointmentId: appointment.id,
            correlationId,
          });
          const { data: confirmed, error: confirmError } = await admin
            .from("appointments")
            .update({
              status: "confirmed",
              provider: event.provider,
              external_calendar_id: event.calendarId,
              external_event_id: event.eventId,
              external_html_link: event.htmlLink || null,
              updated_at: new Date().toISOString(),
            })
            .eq("organization_id", ctx.organizationId)
            .eq("id", appointment.id)
            .eq("status", "pending_availability")
            .select("id,status,start_at,end_at,title,external_html_link")
            .single();
          if (confirmError) throw confirmError;
          return { status: "confirmed", confirmed: true, appointment: confirmed, customerId: customer.id, calendarEventId: event.eventId, calendarLink: event.htmlLink || null };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await admin.from("appointments")
            .update({ status: "failed", notes: [text(input.notes), "Calendar booking failed: " + message].filter(Boolean).join("\n"), updated_at: new Date().toISOString() })
            .eq("organization_id", ctx.organizationId).eq("id", appointment.id).eq("status", "pending_availability");
          throw new Error("Appointment could not be confirmed because calendar creation failed: " + message);
        }
      }
    },
    {
      name: "list_my_appointments",
      description: "List the current tenant customer's appointments without exposing appointments belonging to another organization. Requested appointments are not confirmed until their status says confirmed or the tenant's approved booking flow confirms them.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          customerId: { type: "string" },
          leadId: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 }
        }
      },
      execute: async (input, ctx) => {
        const admin = createAdminClient();
        const limit = boundedLimit(input.limit);
        let customerId = text(input.customerId);
        if (ctx.organizationId === LIMITLESS_REALTY_ORG_ID) {
          if (customerId && customerId !== ctx.customerId) throw new Error("Appointments may only be read for the verified current customer.");
          customerId = text(ctx.customerId);
        }

        if (!customerId && ctx.externalConversationId) {
          const phone = ctx.externalConversationId.replace(/[^\d+]/g, "");
          const { data: customer, error } = await admin
            .from("crm_customers")
            .select("id")
            .eq("organization_id", ctx.organizationId)
            .eq("phone", phone)
            .maybeSingle();
          if (error) throw error;
          customerId = text(customer?.id);
        }

        if (ctx.organizationId === LIMITLESS_REALTY_ORG_ID && !customerId) {
          return { status: "customer_not_resolved", appointments: [], tenant_scoped: true };
        }

        let appointmentQuery = admin
          .from("appointments")
          .select("id,title,status,start_at,end_at,timezone,customer_name,organizer_email,provider,location,notes,calendar_resource_id,assigned_membership_id,external_calendar_id,external_event_id,external_html_link")
          .eq("organization_id", ctx.organizationId)
          .order("start_at", { ascending: false })
          .limit(limit);

        if (customerId) appointmentQuery = appointmentQuery.eq("customer_id", customerId);

        const { data: appointments, error: appointmentError } = await appointmentQuery;
        if (appointmentError) throw appointmentError;

        const result = (appointments || []).map((appointment) => ({
          id: appointment.id,
          title: appointment.title,
          status: appointment.status,
          start_at: appointment.start_at,
          end_at: appointment.end_at,
          timezone: appointment.timezone,
          customer_name: appointment.customer_name,
          organizer_email: appointment.organizer_email,
          provider: appointment.provider,
          location: appointment.location,
          notes: appointment.notes,
          calendar_resource_id: appointment.calendar_resource_id,
          assigned_membership_id: appointment.assigned_membership_id,
          external_calendar_id: appointment.external_calendar_id,
          external_event_id: appointment.external_event_id,
          external_html_link: appointment.external_html_link,
        }));

        if (ctx.organizationId === LIMITLESS_REALTY_ORG_ID && text(input.leadId || customerId)) {
          let leadId = "";
          if (!leadId && customerId) {
            const { data: customer, error } = await admin
              .from("crm_customers")
              .select("phone")
              .eq("organization_id", ctx.organizationId)
              .eq("id", customerId)
              .maybeSingle();
            if (error) throw error;
            const phone = text(customer?.phone).replace(/[^\d]/g, "");
            if (phone) {
              const { data: lead, error: leadError } = await admin
                .from("leads")
                .select("id")
                .eq("organization_id", ctx.organizationId)
                .eq("phone", phone)
                .maybeSingle();
              if (leadError) throw leadError;
              leadId = text(lead?.id);
            }
          }
          if (text(input.leadId) && text(input.leadId) !== leadId) throw new Error("The inspection lead is not the verified current customer.");
          if (leadId) {
            const inspections = await listLimitlessInspections({ leadId, limit });
            result.push(...inspections.map((inspection) => ({
              id: inspection.id,
              title: inspection.property_name ? `Property inspection: ${inspection.property_name}` : "Property inspection",
              status: inspection.status,
              start_at: inspection.scheduled_at,
              end_at: null,
              timezone: inspection.timezone,
              customer_name: null,
              organizer_email: null,
              provider: "limitless_inspection",
              location: null,
              notes: inspection.notes,
              calendar_resource_id: null,
              assigned_membership_id: null,
              external_calendar_id: null,
              external_event_id: null,
              external_html_link: null,
            })));
          }
        }

        return {
          status: customerId ? "ok" : "customer_not_resolved",
          appointments: result.slice(0, limit),
          tenant_scoped: true,
        };
      }
    }
  ];
}
