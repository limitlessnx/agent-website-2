import { createAdminClient } from "@/lib/supabase/admin";
import { listLimitlessInspections } from "@/lib/limitless-inspections";

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

export function maiaAppointmentTools(): ToolDefinition[] {
  return [
    {
      name: "check_appointment_availability",
      description: "Check the tenant's configured appointment calendar before Maia offers or confirms a time. Limitless Realty is intended to use Google Calendar. If Google Calendar is not connected and a calendar resource is not configured, return calendar_not_configured rather than inventing availability.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          startAt: { type: "string", description: "Requested ISO-8601 start time." },
          endAt: { type: "string", description: "Requested ISO-8601 end time." },
          timezone: { type: "string", description: "IANA timezone. Defaults to Africa/Lagos." }
        },
        required: ["startAt", "endAt"]
      },
      execute: async (input, ctx) => {
        const admin = createAdminClient();
        const timezone = text(input.timezone) || "Africa/Lagos";
        const startAt = text(input.startAt);
        const endAt = text(input.endAt);
        if (!startAt || !endAt) throw new Error("startAt and endAt are required.");

        const { data: resources, error: resourceError } = await admin
          .from("appointment_calendar_resources")
          .select("id,integration_id,provider,external_calendar_id,display_name,organizer_email,timezone,default_duration_minutes,is_default,status,availability_configuration,metadata")
          .eq("organization_id", ctx.organizationId)
          .eq("status", "active")
          .order("is_default", { ascending: false })
          .order("routing_priority", { ascending: true });

        if (resourceError) throw resourceError;

        const googleResources = (resources || []).filter((resource) =>
          String(resource.provider || "").toLowerCase().replace(/[_\s]/g, "-") === "google-calendar"
          || String(resource.provider || "").toLowerCase() === "google"
        );

        const integrationIds = googleResources.map((resource) => resource.integration_id).filter(Boolean);
        let connectedIntegrationIds = new Set<string>();
        if (integrationIds.length) {
          const { data: integrations, error: integrationError } = await admin
            .from("organization_integrations")
            .select("id,status")
            .eq("organization_id", ctx.organizationId)
            .in("id", integrationIds);
          if (integrationError) throw integrationError;
          connectedIntegrationIds = new Set((integrations || []).filter((integration) => integration.status === "connected").map((integration) => String(integration.id)));
        }
        const connectedGoogleResources = googleResources.filter((resource) => resource.integration_id && connectedIntegrationIds.has(String(resource.integration_id)));

        if (!connectedGoogleResources.length) {
          return {
            status: "calendar_not_configured",
            provider: ctx.organizationId === LIMITLESS_REALTY_ORG_ID ? "google_calendar" : "tenant_configured_provider",
            timezone,
            requested_window: { startAt, endAt },
            available: false,
            reason: "No active, connected Google Calendar resource is configured for this tenant. Maia must not claim the requested time is available.",
            next_action: "Connect Google Calendar, select a calendar resource, and configure availability in the appointment settings."
          };
        }

        const resource = connectedGoogleResources[0];
        return {
          status: "calendar_resource_configured",
          provider: "google_calendar",
          resource: {
            id: resource.id,
            display_name: resource.display_name,
            organizer_email: resource.organizer_email,
            external_calendar_id: resource.external_calendar_id,
            timezone: resource.timezone || timezone,
          },
          requested_window: { startAt, endAt },
          available: null,
          reason: "The Google Calendar resource is configured, but live free/busy availability is not yet queried by this runtime. Maia must not present this window as confirmed availability.",
          next_action: "Use the configured Google Calendar adapter to perform a live free/busy check before offering the slot."
        };
      }
    },
    {
      name: "list_my_appointments",
      description: "List the current Limitless Realty customer's inspection requests and appointments. Requested appointments are not confirmed until an admin changes their status.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          leadId: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20 }
        }
      },
      execute: async (input, ctx) => {
        if (ctx.organizationId !== LIMITLESS_REALTY_ORG_ID) {
          return { appointments: [], status: "unsupported_tenant" };
        }

        const admin = createAdminClient();
        let leadId = text(input.leadId);
        if (!leadId && ctx.externalConversationId) {
          const phone = ctx.externalConversationId.replace(/[^\d]/g, "");
          const { data: lead, error } = await admin
            .from("leads")
            .select("id")
            .eq("organization_id", ctx.organizationId)
            .eq("phone", phone)
            .maybeSingle();
          if (error) throw error;
          leadId = text(lead?.id);
        }

        if (!leadId) {
          return { appointments: [], status: "lead_not_resolved" };
        }

        const appointments = await listLimitlessInspections({
          leadId,
          limit: Math.min(Number(input.limit || 10), 20)
        });

        return {
          status: "ok",
          appointments: appointments.map((appointment) => ({
            id: appointment.id,
            property_id: appointment.property_id,
            property_name: appointment.property_name,
            scheduled_at: appointment.scheduled_at,
            timezone: appointment.timezone,
            status: appointment.status,
            notes: appointment.notes
          }))
        };
      }
    }
  ];
}
