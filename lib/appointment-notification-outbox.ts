import { createAdminClient } from "@/lib/supabase/admin";

type AppointmentConfirmationInput = {
  organizationId: string;
  appointmentId: string;
  confirmationEventId: string;
  recipient: string;
  variables: Record<string, string | number | null | undefined>;
};

export async function enqueueAppointmentConfirmation(input: AppointmentConfirmationInput) {
  const admin = createAdminClient();
  const variables = Object.fromEntries(
    Object.entries(input.variables).map(([key, value]) => [key, value == null ? "" : String(value)]),
  );
  const { error } = await admin.from("appointment_notification_outbox").upsert({
    organization_id: input.organizationId,
    appointment_id: input.appointmentId,
    event_key: `appointment-confirmed:${input.appointmentId}:${input.confirmationEventId}`,
    channel: "whatsapp",
    purpose: "appointment_reminder",
    recipient: input.recipient,
    template_name: "appointment_reminder",
    variables,
    status: "queued",
  }, { onConflict: "organization_id,event_key", ignoreDuplicates: true });
  if (error) throw new Error("Unable to queue WhatsApp confirmation: " + error.message);
}
