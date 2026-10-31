import {
  findN8nWorkflowByName,
  getN8nBaseUrl,
  getN8nWorkflow,
  listN8nExecutions,
} from "@/lib/n8n-api";
import type { ProgressiveLead } from "@/lib/lead-profile-service";
import { normalizeLeadPhone } from "@/lib/lead-profile-service";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

const ACTION_WORKFLOW_NAME = "Maia Action - Search Lead";
const ACTION_WORKFLOW_ID = "ZdRPo2dzteuK5Gup";
const ACTION_WEBHOOK_NODE = "Fluxknight Maia Action Webhook";
const ACTION_NORMALIZE_NODE = "Fluxknight Normalize Maia Action";
const ACTION_WEBHOOK_PATH = "fluxknight-maia-action";
const ACTION_ENTRY_NODE = "Route Delete Request";
const CAMPAIGN_SUMMARY_NODE = "Campaign Send Summary";
const EXECUTION_TIMEOUT_MS = 60000;
const POLL_INTERVAL_MS = 750;

type WorkflowNode = { id?: string; name: string; type: string; typeVersion?: number; position?: number[]; parameters?: Record<string, unknown>; [key: string]: unknown };
type WorkflowConnection = { main?: Array<Array<{ node: string; type: string; index: number }>>; [key: string]: unknown };
type CampaignSummary = { success?: boolean; action?: string; status?: string; attempted?: number; submitted?: number; accepted_by_whatsapp_api?: number; immediate_failed?: number; skipped?: number; pending_delivery_confirmation?: number; free_form_sent?: number; template_sent?: number; template_name?: string; failed_recipients?: Array<Record<string, unknown>>; accepted_recipients?: Array<Record<string, unknown>>; message?: string };

export type MaiaCampaignAction = { commandId: string; campaignType?: string; templateName?: string; topic: string; message: string; recipients: ProgressiveLead[]; propertyTitle?: string; propertyLocation?: string; propertyPrice?: string; sellingPoint?: string; mediaUrl?: string; createdBy?: string };
export type MaiaWhatsAppFollowUpAction = {
  commandId: string;
  recipient: string;
  recipientName?: string;
  message: string;
  deliveryMode: "direct" | "template";
  templateName?: string;
  templateLanguage?: string;
  templateParameters?: string[];
  templateVariableKeys?: string[];
  topic?: string;
  propertyTitle?: string;
  createdBy?: string;
};

async function resolveActionWorkflow() {
  try { const exact = await getN8nWorkflow(ACTION_WORKFLOW_ID); if (exact?.id) return exact; } catch {}
  const summary = await findN8nWorkflowByName(ACTION_WORKFLOW_NAME);
  if (!summary) throw new Error(`The proven n8n workflow "${ACTION_WORKFLOW_NAME}" was not found.`);
  return getN8nWorkflow(summary.id);
}

export async function verifyMaiaActionWebhook() {
  const workflow = await resolveActionWorkflow();
  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as WorkflowNode[];
  const connections = (workflow.connections || {}) as Record<string, WorkflowConnection>;
  const entryNode = nodes.find((node) => node.name === ACTION_ENTRY_NODE);
  const webhookNode = nodes.find((node) => node.name === ACTION_WEBHOOK_NODE);
  const normalizeNode = nodes.find((node) => node.name === ACTION_NORMALIZE_NODE);
  const connected = (from: string, to: string) => (connections[from]?.main || []).flat().some((edge) => edge.node === to && edge.type === "main");
  const configured = Boolean(
    entryNode && webhookNode && normalizeNode && workflow.active === true
      && webhookNode.parameters?.httpMethod === "POST"
      && webhookNode.parameters?.path === ACTION_WEBHOOK_PATH
      && webhookNode.parameters?.responseMode === "onReceived"
      && normalizeNode.parameters?.mode === "runOnceForEachItem"
      && connected(ACTION_WEBHOOK_NODE, ACTION_NORMALIZE_NODE)
      && connected(ACTION_NORMALIZE_NODE, ACTION_ENTRY_NODE),
  );
  if (!configured) throw new Error(`${ACTION_WORKFLOW_NAME} is not configured and active. Workflow changes must be reviewed and deployed separately; a campaign send will not repair or reactivate it.`);
  return { workflowId: workflow.id, workflowName: workflow.name, webhookPath: ACTION_WEBHOOK_PATH, entryNode: ACTION_ENTRY_NODE, verified: true };
}

function splitCampaignParagraphs(message: string) { return message.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean); }

function containsCommandId(value: unknown, commandId: string) { try { return JSON.stringify(value).includes(commandId); } catch { return false; } }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function extractNodeJson(execution: Record<string, unknown>, nodeName: string): CampaignSummary | null {
  const resultData = record(record(execution.data).resultData);
  const runs = record(resultData.runData)[nodeName];
  const firstRun = Array.isArray(runs) ? record(runs[0]) : {};
  const branches = Array.isArray(record(firstRun.data).main) ? record(firstRun.data).main as unknown[] : [];
  const firstBranch = Array.isArray(branches[0]) ? branches[0] as unknown[] : [];
  const firstItem = record(firstBranch[0]);
  return firstItem.json ? firstItem.json as CampaignSummary : null;
}
async function waitForCampaignExecution(workflowId: string, commandId: string, startedAfter: number) {
  const deadline = Date.now() + EXECUTION_TIMEOUT_MS; let seenId: string | null = null;
  while (Date.now() < deadline) {
    const rawExecutions: unknown = await listN8nExecutions({ workflowId, includeData: true, limit: 50 });
    const executions = Array.isArray(rawExecutions) ? rawExecutions.map(record) : [];
    const execution = executions.find((candidate) => { const rawStartedAt = candidate.startedAt; const startedAt = typeof rawStartedAt === "string" || typeof rawStartedAt === "number" ? new Date(rawStartedAt).getTime() : 0; return startedAt >= startedAfter - 5000 && containsCommandId(candidate, commandId); });
    if (!execution) { await sleep(POLL_INTERVAL_MS); continue; }
    seenId = String(execution.id); const resultData = record(record(execution.data).resultData); const status = String(execution.status || "").toLowerCase(); const rawError = resultData.error; const error = record(rawError);
    if (rawError || ["error", "crashed", "canceled"].includes(status)) { const node = String(record(error.node).name || resultData.lastNodeExecuted || "unknown node"); const detail = String(error.message || error.description || `Execution ended with status ${status || "error"}.`); throw new Error(`Maia action execution ${execution.id} failed at ${node}: ${detail}`); }
    if (execution.finished || status === "success") { const path = Object.keys(record(resultData.runData)); const summary = extractNodeJson(execution, CAMPAIGN_SUMMARY_NODE); if (!summary) throw new Error(`Maia action execution ${execution.id} finished without ${CAMPAIGN_SUMMARY_NODE}. Executed: ${path.join(" -> ") || "none"}.`); return { executionId: String(execution.id), path, summary }; }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(seenId ? `Maia action execution ${seenId} did not finish within ${EXECUTION_TIMEOUT_MS / 1000} seconds.` : `No Maia action execution was found for command ${commandId}.`);
}

async function runMaiaActionPayload(commandId: string, payload: Record<string, unknown>) {
  const route = await verifyMaiaActionWebhook();
  const startedAt = Date.now();
  const response = await fetch(`${getN8nBaseUrl()}/webhook/${route.webhookPath}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
  const responseText = await response.text().catch(() => "");
  if (!response.ok) throw new Error(`Maia action webhook rejected the command: ${response.status}${responseText ? ` ${responseText}` : ""}`);
  const execution = await waitForCampaignExecution(route.workflowId, commandId, startedAt);
  return { route, execution };
}

export async function dispatchMaiaCampaignAction(command: MaiaCampaignAction) {
  if (!command.message.trim()) throw new Error("A campaign message is required.");
  if (!command.recipients.length) throw new Error("The campaign has no recipients.");

  const isEstateBrief = command.campaignType === "estate_brief_update" || command.templateName === "estate_brief_update";
  const isUpdateTemplate = command.campaignType === "limitless_realty_update" || command.templateName === "limitless_realty_update_v2";
  if (!isEstateBrief && !isUpdateTemplate) throw new Error("This campaign template has no verified direct WhatsApp route.");

  const templateName = isEstateBrief ? "estate_brief_update" : "limitless_realty_update_v2";
  const templatePurpose = isEstateBrief ? "estate_brief_update" : "limitless_realty_update";
  const variableKeys = isEstateBrief
    ? ["customer_name", "property_name", "property_location", "property_price", "selling_point"] as const
    : ["customer_name", "main_update", "supporting_update", "response_prompt"] as const;
  const paragraphs = splitCampaignParagraphs(command.message);
  const acceptedRecipients: Array<Record<string, unknown>> = [];
  const failedRecipients: Array<Record<string, unknown>> = [];
  let templateSent = 0;

  // Sequential delivery avoids an uncontrolled burst and keeps one provider result per recipient.
  const uniqueRecipients = [...new Map(command.recipients.map((lead) => [normalizeLeadPhone(String(lead.phone || "")), lead])).values()]
    .filter((lead) => normalizeLeadPhone(String(lead.phone || "")));

  for (const lead of uniqueRecipients) {
    const phone = normalizeLeadPhone(String(lead.phone || ""));
    const variables: Record<string, string> = isEstateBrief
      ? {
          customer_name: String(lead.name || "there").trim() || "there",
          property_name: String(command.propertyTitle || "").trim(),
          property_location: String(command.propertyLocation || "").trim(),
          property_price: String(command.propertyPrice || "").trim(),
          selling_point: String(command.sellingPoint || command.message || "").trim(),
        }
      : {
          customer_name: String(lead.name || "there").trim() || "there",
          main_update: paragraphs[0] || command.message.trim(),
          supporting_update: paragraphs[1] || "",
          response_prompt: paragraphs[2] || "",
        };

    try {
      const result = await sendWhatsAppMessage({
        organizationId: "b15f21b4-5697-4d21-9421-8a34eae3476d",
        to: phone,
        deliveryMode: "template",
        forceTemplate: true,
        templatePurpose,
        requestedTemplateName: templateName,
        variables,
        strictTemplateContract: { approvedVariableOrder: variableKeys },
        ...(isEstateBrief && command.mediaUrl ? { templateHeaderImageUrl: command.mediaUrl } : {}),
      });
      templateSent += 1;
      acceptedRecipients.push({
        leadId: lead.id,
        phone,
        name: String(lead.name || "there"),
        provider: result.provider || "whatsapp",
        providerMessageId: result.providerMessageId || null,
        status: "accepted",
      });
    } catch (error) {
      failedRecipients.push({
        leadId: lead.id,
        phone,
        name: String(lead.name || "there"),
        error: error instanceof Error ? error.message : "WhatsApp provider dispatch failed.",
      });
    }
  }

  const accepted = acceptedRecipients.length;
  const failed = failedRecipients.length;
  return {
    route: { provider: "whatsapp_delivery_gateway", verified: true },
    executionId: command.commandId,
    path: ["campaign_api", "whatsapp_delivery_gateway", "meta_or_twilio_provider"],
    summary: {
      attempted: uniqueRecipients.length,
      accepted_by_whatsapp_api: accepted,
      immediate_failed: failed,
      pending_delivery_confirmation: accepted,
      free_form_sent: 0,
      template_sent: templateSent,
      status: accepted > 0 ? "submitted" : "failed",
      accepted_recipients: acceptedRecipients,
      failed_recipients: failedRecipients,
    },
    attempted: uniqueRecipients.length,
    accepted,
    failed,
    skipped: 0,
    pendingDelivery: accepted,
    freeFormSent: 0,
    templateSent,
    acceptedRecipients,
    failedRecipients,
    status: accepted > 0 ? "submitted" : "failed",
    message: accepted > 0
      ? `${accepted} template message(s) accepted by WhatsApp; delivery receipts are pending.`
      : "WhatsApp did not accept any campaign messages.",
  };
}

export async function dispatchMaiaWhatsAppFollowUp(command: MaiaWhatsAppFollowUpAction) {
  const phone = normalizeLeadPhone(command.recipient);
  if (!phone) throw new Error("A valid WhatsApp recipient is required.");
  if (!command.message.trim()) throw new Error("A follow-up message is required.");
  if (command.deliveryMode === "template" && !command.templateName?.trim()) throw new Error("An approved WhatsApp template name is required outside the customer service window.");

  const recipientName = String(command.recipientName || "there").trim() || "there";
  const templateParameters = (command.templateParameters || []).map((value) => String(value || "Not specified").trim() || "Not specified");
  const bodyParameters = templateParameters.map((value) => ({ type: "text", text: value }));
  const isTemplate = command.deliveryMode === "template";
  const templateName = String(command.templateName || "").trim();

  const payload = {
    source: "fluxknight_maia_follow_up",
    command_id: command.commandId,
    chat_id: command.createdBy || "maia_follow_up",
    user_id: command.createdBy || "maia_follow_up",
    text: command.message,
    original_text: command.message,
    action_type: "send_whatsapp_campaign",
    operation: "send_whatsapp_campaign",
    has_action: true,
    has_media: false,
    action_params: {
      recipient_phones: [phone],
      custom_message: command.message,
      message_text: command.message,
      preserve_exact_message: true,
      message_delivery_mode: isTemplate ? "auto" : "direct",
      campaign_type: isTemplate ? "limitless_realty_reminder" : "direct_message",
      template_name: isTemplate ? templateName : "",
      approved_template_name: isTemplate ? templateName : "",
      template_language: isTemplate ? String(command.templateLanguage || "en_US") : "",
      allow_template_fallback: isTemplate,
      use_approved_template_outside_24h: isTemplate,
      topic: command.topic || "Maia CRM follow-up",
      property_filter: command.propertyTitle || "",
      media_url: "",
      image_url: "",
      media_type: "",
      has_media: false,
      template_components: isTemplate ? [{ type: "body", parameters: bodyParameters }] : [],
      template_body_parameters: isTemplate ? bodyParameters : [],
      template_components_by_recipient: isTemplate ? [{ phone, name: recipientName, components: [{ type: "body", parameters: bodyParameters }] }] : [],
      template_variable_keys: isTemplate ? command.templateVariableKeys || [] : [],
      confirm_send: true,
      confirm_real_client_broadcast: true,
      include_incomplete_leads: true,
      max_recipients: 1,
    },
    natural_response: isTemplate
      ? `Send the approved Meta WhatsApp template ${templateName} to this one CRM follow-up recipient. Use the supplied BODY parameters exactly in order. Do not regenerate or substitute a different template.`
      : "Send this direct WhatsApp follow-up exactly as written. Do not rewrite it. Direct mode is only valid because Fluxknight already verified the customer-service window is open.",
  };

  const { route, execution } = await runMaiaActionPayload(command.commandId, payload);
  const summary = execution.summary;
  const failedRecipients = summary.failed_recipients || [];
  const immediateFailed = Number(summary.immediate_failed || failedRecipients.length || 0);
  const accepted = Number(summary.accepted_by_whatsapp_api || summary.submitted || 0);
  if (immediateFailed > 0 && accepted === 0) {
    const details = failedRecipients.map((item) => String(item.error || item.reason || item.message || JSON.stringify(item))).filter(Boolean).join("; ");
    throw new Error(`WhatsApp rejected Maia follow-up: ${details || summary.message || `${immediateFailed} recipient(s) failed.`}`);
  }

  return {
    route,
    executionId: execution.executionId,
    path: execution.path,
    summary,
    accepted,
    failed: immediateFailed,
    pendingDelivery: Number(summary.pending_delivery_confirmation || 0),
    freeFormSent: Number(summary.free_form_sent || 0),
    templateSent: Number(summary.template_sent || 0),
    templateName: isTemplate ? templateName : null,
    status: String(summary.status || "submitted"),
    message: String(summary.message || "Maia follow-up submitted to WhatsApp."),
  };
}
