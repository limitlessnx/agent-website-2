import { createAdminClient } from "@/lib/supabase/admin";
import { listLimitlessInspections } from "@/lib/limitless-inspections";
import { selectAppointmentResource } from "@/lib/appointment-scheduling";

const LIMITLESS_REALTY_ORG_ID = "b15f21b4-5697-4d21-9421-8a34eae3476d";

type ToolContext = {
  organizationId: string;
  agentId: string;
  sessionId: string;
  externalConversationId?: string;
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
          return {
            status: "unavailable",
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
          let leadId = text(input.leadId);
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
