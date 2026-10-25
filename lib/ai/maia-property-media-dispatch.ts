import { verifyMaiaActionWebhook } from "@/lib/maia-action-gateway";
import { getN8nBaseUrl, listN8nExecutions } from "@/lib/n8n-api";
import { normalizeLeadPhone } from "@/lib/lead-profile-service";

const CAMPAIGN_SUMMARY_NODE = "Campaign Send Summary";
const EXECUTION_TIMEOUT_MS = 60000;
const POLL_INTERVAL_MS = 750;

type CampaignSummary = {
  success?: boolean;
  status?: string;
  submitted?: number;
  accepted_by_whatsapp_api?: number;
  immediate_failed?: number;
  pending_delivery_confirmation?: number;
  free_form_sent?: number;
  failed_recipients?: Array<Record<string, unknown>>;
  accepted_recipients?: Array<Record<string, unknown>>;
  message?: string;
};

export type MaiaPropertyMediaDispatch = {
  commandId: string;
  recipient: string;
  propertyId: string;
  propertyTitle: string;
  assetId: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "document";
  mimeType?: string;
  fileName?: string;
  caption?: string;
};

function containsCommandId(value: unknown, commandId: string) {
  try { return JSON.stringify(value).includes(commandId); } catch { return false; }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}
function optionalNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function campaignSummary(value: unknown): CampaignSummary | null {
  const row = record(value);
  if (!Object.keys(row).length) return null;
  return {
    success: typeof row.success === "boolean" ? row.success : undefined,
    status: typeof row.status === "string" ? row.status : undefined,
    submitted: optionalNumber(row.submitted),
    accepted_by_whatsapp_api: optionalNumber(row.accepted_by_whatsapp_api),
    immediate_failed: optionalNumber(row.immediate_failed),
    pending_delivery_confirmation: optionalNumber(row.pending_delivery_confirmation),
    free_form_sent: optionalNumber(row.free_form_sent),
    failed_recipients: Array.isArray(row.failed_recipients) ? row.failed_recipients.map(record) : undefined,
    accepted_recipients: Array.isArray(row.accepted_recipients) ? row.accepted_recipients.map(record) : undefined,
    message: typeof row.message === "string" ? row.message : undefined,
  };
}

function extractSummary(execution: JsonRecord) {
  const runData = record(record(record(execution.data).resultData).runData);
  const runs = runData[CAMPAIGN_SUMMARY_NODE];
  const firstRun = Array.isArray(runs) ? runs[0] : null;
  const branches = record(firstRun).data;
  const main = record(branches).main;
  const firstBranch = Array.isArray(main) && Array.isArray(main[0]) ? main[0] : [];
  return campaignSummary(record(firstBranch[0]).json);
}

async function waitForExecution(workflowId: string, commandId: string, startedAfter: number) {
  const deadline = Date.now() + EXECUTION_TIMEOUT_MS;
  let seenId: string | null = null;
  while (Date.now() < deadline) {
    const response: unknown = await listN8nExecutions({ workflowId, includeData: true, limit: 50 });
    const executions = Array.isArray(response) ? response.map((value: unknown) => record(value)) : [];
    const execution = executions.find((candidate) => {
      const rawStartedAt = candidate.startedAt;
      const startedAt = typeof rawStartedAt === "string" || typeof rawStartedAt === "number" ? new Date(rawStartedAt).getTime() : 0;
      return startedAt >= startedAfter - 5000 && containsCommandId(candidate, commandId);
    });
    if (!execution) { await sleep(POLL_INTERVAL_MS); continue; }
    seenId = String(execution.id || "unknown");
    const resultData = record(record(execution.data).resultData);
    const error = record(resultData.error);
    const status = typeof execution.status === "string" ? execution.status.toLowerCase() : "";
    if (Object.keys(error).length || ["error", "crashed", "canceled"].includes(status)) {
      const node = String(record(error.node).name || resultData.lastNodeExecuted || "unknown node");
      const detail = String(error.message || error.description || `Execution ended with status ${status || "error"}.`);
      throw new Error(`Maia media execution ${seenId} failed at ${node}: ${detail}`);
    }
    if (execution.finished === true || status === "success") {
      const summary = extractSummary(execution);
      if (!summary) throw new Error(`Maia media execution ${seenId} finished without ${CAMPAIGN_SUMMARY_NODE}.`);
      return { executionId: seenId, summary };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(seenId
    ? `Maia media execution ${seenId} did not finish within ${EXECUTION_TIMEOUT_MS / 1000} seconds.`
    : `No Maia media execution was found for command ${commandId}.`);
}

export async function dispatchMaiaPropertyMedia(command: MaiaPropertyMediaDispatch) {
  const phone = normalizeLeadPhone(command.recipient);
  if (!phone) throw new Error("A valid verified WhatsApp recipient is required.");
  if (!command.mediaUrl.trim()) throw new Error("The approved media asset has no usable URL.");
  if (!command.assetId.trim() || !command.propertyId.trim()) throw new Error("A registered property media asset is required.");

  const route = await verifyMaiaActionWebhook();
  const startedAt = Date.now();
  const caption = String(command.caption || command.propertyTitle || "Property media").trim().slice(0, 900);
  const payload = {
    source: "fluxknight_maia_property_media",
    command_id: command.commandId,
    chat_id: "maia_property_media",
    user_id: "maia_property_media",
    text: caption,
    original_text: caption,
    action_type: "send_whatsapp_campaign",
    operation: "send_whatsapp_campaign",
    has_action: true,
    has_media: true,
    action_params: {
      recipient_phones: [phone],
      custom_message: caption,
      message_text: caption,
      preserve_exact_message: true,
      message_delivery_mode: "direct",
      campaign_type: "direct_message",
      template_name: "",
      approved_template_name: "",
      allow_template_fallback: false,
      use_approved_template_outside_24h: false,
      topic: `property_media:${command.propertyId}`,
      property_filter: command.propertyTitle,
      media_url: command.mediaUrl,
      image_url: command.mediaType === "image" ? command.mediaUrl : "",
      media_type: command.mediaType,
      mime_type: command.mimeType || "",
      file_name: command.fileName || "",
      media_asset_id: command.assetId,
      property_id: command.propertyId,
      has_media: true,
      template_components: [],
      template_body_parameters: [],
      template_components_by_recipient: [],
      confirm_send: true,
      confirm_real_client_broadcast: true,
      include_incomplete_leads: true,
      max_recipients: 1,
    },
    natural_response: `Send this approved ${command.mediaType} asset to the single WhatsApp recipient as a direct customer-service-window message. Use the exact media_url and caption supplied. Do not replace the media URL, do not use a template, and do not send to any other recipient.`,
  };

  const response = await fetch(`${getN8nBaseUrl()}/webhook/${route.webhookPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const responseText = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`Maia media webhook rejected the command: ${response.status}${responseText ? ` ${responseText}` : ""}`);

  const execution = await waitForExecution(route.workflowId, command.commandId, startedAt);
  const summary = execution.summary;
  const failedRecipients = summary.failed_recipients || [];
  const immediateFailed = Number(summary.immediate_failed || failedRecipients.length || 0);
  const accepted = Number(summary.accepted_by_whatsapp_api || summary.submitted || 0);
  if (immediateFailed > 0 && accepted === 0) {
    const details = failedRecipients.map((item) => String(item.error || item.reason || item.message || JSON.stringify(item))).filter(Boolean).join("; ");
    throw new Error(`WhatsApp rejected the property media: ${details || summary.message || `${immediateFailed} recipient(s) failed.`}`);
  }

  return {
    accepted: accepted > 0,
    status: String(summary.status || (accepted > 0 ? "accepted_by_api" : "pending")),
    execution_id: execution.executionId,
    provider: "n8n_maia_action_whatsapp",
    asset_id: command.assetId,
    property_id: command.propertyId,
    media_type: command.mediaType,
    pending_delivery_confirmation: Number(summary.pending_delivery_confirmation || 0),
    free_form_sent: Number(summary.free_form_sent || 0),
    accepted_recipients: summary.accepted_recipients || [],
    failed_recipients: failedRecipients,
    message: String(summary.message || "Property media submitted to WhatsApp."),
  };
}
