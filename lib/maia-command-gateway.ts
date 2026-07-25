import type { ProgressiveLead } from "@/lib/lead-profile-service";
import {
  dispatchLimitlessWhatsAppCampaign,
  type CampaignDispatchPayload,
} from "@/lib/limitless-campaign-n8n";
import { inspectAndRepairMaiaCommandPath } from "@/lib/maia-command-diagnostics";

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

function normalizePhone(value: unknown) {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeRecipients(recipients: ProgressiveLead[]) {
  const seen = new Set<string>();
  return recipients
    .map((lead) => ({ ...lead, phone: normalizePhone(lead.phone) }))
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

  const route = await inspectAndRepairMaiaCommandPath();
  if (!route.dashboardTrigger.nextNodes.length) {
    throw new Error("Maia command routing is not connected to a downstream processing node.");
  }

  const commandId = command.commandId || crypto.randomUUID();
  const result = await dispatchLimitlessWhatsAppCampaign({
    campaignId: commandId,
    topic: command.topic || command.type.replaceAll("_", " "),
    message,
    mediaUrl: command.mediaUrl,
    property: command.property,
    recipients,
    createdBy: command.createdBy || "fluxknight_dashboard",
  });

  return {
    ...result,
    commandId,
    commandType: command.type,
    recipientCount: recipients.length,
    route: {
      workflowId: route.workflow.id,
      workflowName: route.workflow.name,
      sourceTrigger: route.sourceTrigger.name,
      sourceNextNodes: route.sourceTrigger.nextNodes,
      dashboardNextNodes: route.dashboardTrigger.nextNodes,
      telegramTraceFound: route.trace.found,
      tracedExecutionId: route.trace.executionId,
      inferredCommandPath: route.trace.inferredCommandPath,
    },
    metadata: command.metadata || {},
  };
}
