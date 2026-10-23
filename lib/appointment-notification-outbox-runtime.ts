import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

type OutboxRow = {
  id: string;
  organization_id: string;
  appointment_id: string;
  recipient: string;
  purpose: string;
  template_name: string;
  variables: Record<string, string>;
};

export async function runAppointmentNotificationOutboxSweep() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_appointment_notification_outbox", { p_limit: 20 });
  if (error) throw new Error("Unable to claim appointment notifications: " + error.message);
  const rows = (data || []) as OutboxRow[];
  const results: Array<{ id: string; status: "sent" | "failed" | "uncertain"; error?: string }> = [];

  for (const row of rows) {
    try {
      const result = await sendWhatsAppMessage({
        organizationId: row.organization_id,
        to: row.recipient,
        deliveryMode: "template",
        templatePurpose: row.purpose,
        requestedTemplateName: row.template_name,
        variables: row.variables,
      });
      const { error: updateError } = await admin.from("appointment_notification_outbox").update({
        status: "sent",
        provider_message_id: result.providerMessageId || null,
        sent_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id).eq("organization_id", row.organization_id).eq("status", "processing");
      if (updateError) {
        // Do not retry: the provider may have accepted the message. Leave the
        // row processing for explicit reconciliation rather than risk a duplicate.
        results.push({ id: row.id, status: "failed", error: "Provider accepted message but outbox status could not be recorded; manual reconciliation required." });
      } else {
        results.push({ id: row.id, status: "sent" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "WhatsApp confirmation failed.";
      await admin.from("appointment_notification_outbox").update({
        status: "uncertain",
        last_error: message.slice(0, 2000),
        updated_at: new Date().toISOString(),
      }).eq("id", row.id).eq("organization_id", row.organization_id).eq("status", "processing");
      results.push({ id: row.id, status: "uncertain", error: message });
    }
  }
  return { claimed: rows.length, results };
}
