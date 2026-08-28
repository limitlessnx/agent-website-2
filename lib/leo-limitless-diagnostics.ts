import { getDetailedCampaignReports, type DetailedCampaignReport } from "@/lib/campaign-report-reader";
import { describeWhatsAppFailure } from "@/lib/whatsapp-status-log";

function text(value: unknown) { return String(value || "").trim(); }

function matchesRequestedCampaign(report: DetailedCampaignReport, args: Record<string, unknown>) {
  const requested = text(args.campaign_id || args.campaignId || args.id || args.execution_id || args.executionId);
  if (!requested || ["latest", "last", "recent"].includes(requested.toLowerCase())) return true;
  return report.id === requested || report.execution_id === requested || report.created_at.includes(requested);
}

export async function diagnoseLimitlessCampaign(args: Record<string, unknown> = {}) {
  const reports = await getDetailedCampaignReports(25);
  const report = reports.find((item) => matchesRequestedCampaign(item, args));
  if (!report) throw new Error("No matching Limitless Realty campaign report was found in the recent delivery history.");

  const failedRecipients = report.recipients
    .filter((item) => item.status === "failed" || item.status === "blocked" || item.status === "undelivered" || item.status === "expired")
    .map((item) => ({
      name: item.name,
      phone: item.phone,
      status: item.status,
      errorCode: item.error_code || null,
      reason: item.error_message || describeWhatsAppFailure({ error_code: item.error_code || "" }),
    }));
  const sentOnlyRecipients = report.recipients
    .filter((item) => item.status === "sent" || item.status === "accepted" || item.status === "pending" || item.status === "unknown")
    .map((item) => ({ name: item.name, phone: item.phone, status: item.status, deliveryConfirmed: false }));
  const deliveredRecipients = report.recipients
    .filter((item) => item.status === "delivered" || item.status === "read")
    .map((item) => ({ name: item.name, phone: item.phone, status: item.status, deliveryConfirmed: true }));

  return {
    ok: true,
    workspace: "Limitless Realty",
    status: "diagnosed",
    evidenceSource: "Meta WhatsApp status callbacks correlated by provider message ID",
    campaign: {
      id: report.id,
      executionId: report.execution_id || null,
      topic: report.campaign_topic,
      type: report.campaign_type,
      templateName: report.template_name,
      createdAt: report.created_at,
    },
    summary: {
      attempted: report.attempted,
      accepted: report.accepted,
      sentOnly: sentOnlyRecipients.length,
      delivered: report.delivered,
      read: report.read,
      failed: report.failed,
      skipped: report.skipped,
      unresolved: report.unresolved,
      pendingDelivery: report.pending_delivery,
    },
    interpretation: {
      acceptedIsNotDelivered: true,
      sentIsNotDelivered: true,
      deliveredIncludesRead: true,
      note: "Accepted means Meta accepted the API request. Sent means Meta emitted a sent status. Only delivered or read confirms delivery to the recipient device. Failed recipients are reported from later provider callbacks even when the initial campaign submission succeeded.",
    },
    failedRecipients,
    sentOnlyRecipients,
    deliveredRecipients,
    finalStatusNote: report.final_status_note || null,
  };
}
