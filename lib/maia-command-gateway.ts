import type { ProgressiveLead } from "@/lib/lead-profile-service";
import { normalizeLeadPhone } from "@/lib/lead-profile-service";
import type { CampaignDispatchPayload } from "@/lib/limitless-campaign-n8n";
import { dispatchMaiaDirectCommand, ensureMaiaDashboardWebhook } from "@/lib/maia-direct-webhook";

export type MaiaCommandType =
  | "campaign"
  | "direct_message"
  | "lead_follow_up"
  | "appointment_reminder"
  | "installment_reminder"
  | "property_update"
  | "payment_notice";

export type MaiaCommand = {
  type: MaiaCommandType;
  message: string;
  recipients: ProgressiveLead[];
  topic?: string;
  mediaUrl?: string;
  property?: CampaignDispatchPayload["property"];
  createdBy?: string;
  metadata?: Record<string, unknown>;
  commandId?: string;
};

function normalizeRecipients(recipients: ProgressiveLead[]) {
  const seen = new Set<string>();
  return recipients
    .map((lead) => ({ ...lead, phone: normalizeLeadPhone(String(lead.phone || "")) }))
    .filter((lead) => {
      if (!lead.phone || seen.has(lead.phone)) return false;
      seen.add(lead.phone);
      return true;
    });
}

export async function dispatchMaiaCommand(command: MaiaCommand) {
  const message = String(command.message || "").trim();
  if (!message) throw new Error("A Maia command message is required.");

  const recipients = normalizeRecipients(command.recipients || []);
  if (!recipients.length) throw new Error("The Maia command has no valid WhatsApp recipients.");

  const route = await ensureMaiaDashboardWebhook();
  const commandId = command.commandId || crypto.randomUUID();
  const topic = command.topic || command.type.replaceAll("_", " ");

  const results = [];
  const failures: Array<{ phone: string; commandId: string; error: string }> = [];

  for (const [index, recipient] of recipients.entries()) {
    const recipientCommandId = `${commandId}:${index + 1}:${recipient.phone}`;

    try {
      results.push(
        await dispatchMaiaDirectCommand({
          commandId: recipientCommandId,
          commandType: command.type,
          topic,
          message,
          mediaUrl: command.mediaUrl,
          property: command.property as Record<string, unknown> | undefined,
          recipient,
          createdBy: command.createdBy || "fluxknight_dashboard",
          metadata: {
            ...(command.metadata || {}),
            parentCommandId: commandId,
            recipientIndex: index,
          },
        }),
      );
    } catch (error) {
      failures.push({
        phone: recipient.phone,
        commandId: recipientCommandId,
        error: error instanceof Error ? error.message : "Maia command failed.",
      });
    }
  }

  if (!results.length) {
    throw new Error(failures[0]?.error || "Maia rejected every dashboard command.");
  }

  return {
    completed: results.length,
    accepted: results.length,
    processed: results.length,
    failed: failures.length,
    failures,
    status: failures.length ? "partially_completed" : "completed",
    commandId,
    commandType: command.type,
    recipientCount: recipients.length,
    route: {
      workflowId: route.workflowId,
      workflowName: route.workflowName,
      sourceTrigger: route.sourceTrigger,
      dashboardWebhook: route.webhookPath,
      dashboardNextNodes: route.nextNodes,
      repaired: route.repaired,
    },
    executions: results.map((result) => result.response),
    metadata: command.metadata || {},
  };
}
