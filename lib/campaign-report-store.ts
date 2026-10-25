import { recordLimitlessCampaignDeliveryAttempts } from "@/lib/whatsapp-delivery-ledger";

export type CampaignDeliveryReport = {
  id: string;
  campaign_type?: string;
  template_name?: string;
  campaign_topic: string;
  command_id: string;
  execution_id?: string;
  status: string;
  attempted: number;
  accepted: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  pending_delivery: number;
  accepted_recipients?: unknown[];
  failed_recipients?: unknown[];
  workflow_path?: string[];
  created_by?: string;
  created_at: string;
};

/**
 * The canonical tenant-scoped campaign report now lives in
 * real_estate_outbound_tracking. Do not write another report to bot_sessions:
 * those legacy campaign-context rows have no organization key and cannot be
 * safely queried by a tenant dashboard.
 */
export async function saveCampaignDeliveryReport(report: CampaignDeliveryReport) {
  await recordLimitlessCampaignDeliveryAttempts({
    campaignId: report.id,
    executionId: report.execution_id,
    campaignType: report.campaign_type,
    templateName: report.template_name,
    topic: report.campaign_topic,
    acceptedRecipients: Array.isArray(report.accepted_recipients) ? report.accepted_recipients as Record<string, unknown>[] : [],
    failedRecipients: Array.isArray(report.failed_recipients) ? report.failed_recipients as Record<string, unknown>[] : [],
    createdBy: report.created_by,
  }).catch((error) => console.error("Campaign recipient ledger persistence failed.", error));
  return true;
}
