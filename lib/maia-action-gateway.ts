import {
  activateN8nWorkflow,
  findN8nWorkflowByName,
  getN8nBaseUrl,
  getN8nWorkflow,
  listN8nExecutions,
  updateN8nWorkflow,
} from "@/lib/n8n-api";
import type { ProgressiveLead } from "@/lib/lead-profile-service";
import { normalizeLeadPhone } from "@/lib/lead-profile-service";

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

export type MaiaCampaignAction = { commandId: string; campaignType?: string; templateName?: string; topic: string; message: string; recipients: ProgressiveLead[]; propertyTitle?: string; mediaUrl?: string; createdBy?: string };

async function resolveActionWorkflow() {
  try { const exact = await getN8nWorkflow(ACTION_WORKFLOW_ID); if (exact?.id) return exact; } catch {}
  const summary = await findN8nWorkflowByName(ACTION_WORKFLOW_NAME);
  if (!summary) throw new Error(`The proven n8n workflow "${ACTION_WORKFLOW_NAME}" was not found.`);
  return getN8nWorkflow(summary.id);
}
function targets(connection?: WorkflowConnection) { return (connection?.main || []).flat().map((item) => item.node); }
export async function ensureMaiaActionWebhook() {
  const workflow = await resolveActionWorkflow();
  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as WorkflowNode[];
  const connections = (workflow.connections || {}) as Record<string, WorkflowConnection>;
  const entryNode = nodes.find((node) => node.name === ACTION_ENTRY_NODE);
  if (!entryNode) throw new Error(`${ACTION_WORKFLOW_NAME} is missing ${ACTION_ENTRY_NODE}.`);
  const webhookNode = nodes.find((node) => node.name === ACTION_WEBHOOK_NODE);
  const normalizeNode = nodes.find((node) => node.name === ACTION_NORMALIZE_NODE);
  const cleanedNodes = nodes.filter((node) => node.name !== ACTION_WEBHOOK_NODE && node.name !== ACTION_NORMALIZE_NODE);
  const baseX = Number(entryNode.position?.[0] || 0); const baseY = Number(entryNode.position?.[1] || 0);
  const webhook: WorkflowNode = { id: webhookNode?.id || crypto.randomUUID(), name: ACTION_WEBHOOK_NODE, type: "n8n-nodes-base.webhook", typeVersion: 2, position: [baseX - 440, baseY + 180], webhookId: String(webhookNode?.webhookId || crypto.randomUUID()), parameters: { httpMethod: "POST", path: ACTION_WEBHOOK_PATH, responseMode: "onReceived", options: {} } };
  const normalize: WorkflowNode = { id: normalizeNode?.id || crypto.randomUUID(), name: ACTION_NORMALIZE_NODE, type: "n8n-nodes-base.code", typeVersion: 2, position: [baseX - 220, baseY + 180], parameters: { mode: "runOnceForEachItem", jsCode: "const value = $json.body && typeof $json.body === 'object' ? $json.body : $json; return { json: value };" } };
  const webhookConnection: WorkflowConnection = { main: [[{ node: ACTION_NORMALIZE_NODE, type: "main", index: 0 }]] };
  const normalizeConnection: WorkflowConnection = { main: [[{ node: ACTION_ENTRY_NODE, type: "main", index: 0 }]] };
  const needsUpdate = !webhookNode || !normalizeNode || webhookNode.parameters?.responseMode !== "onReceived" || JSON.stringify(connections[ACTION_WEBHOOK_NODE] || {}) !== JSON.stringify(webhookConnection) || JSON.stringify(connections[ACTION_NORMALIZE_NODE] || {}) !== JSON.stringify(normalizeConnection);
  if (needsUpdate) {
    const nextConnections = { ...connections }; delete nextConnections[ACTION_WEBHOOK_NODE]; delete nextConnections[ACTION_NORMALIZE_NODE];
    const updated = await updateN8nWorkflow(workflow.id, { name: workflow.name, nodes: [...cleanedNodes, webhook, normalize], connections: { ...nextConnections, [ACTION_WEBHOOK_NODE]: webhookConnection, [ACTION_NORMALIZE_NODE]: normalizeConnection }, settings: { ...(workflow.settings || {}), saveExecutionProgress: true, saveDataSuccessExecution: "all", saveDataErrorExecution: "all" } });
    if (workflow.active && !updated.active) await activateN8nWorkflow(workflow.id);
  }
  return { workflowId: workflow.id, workflowName: workflow.name, webhookPath: ACTION_WEBHOOK_PATH, entryNode: ACTION_ENTRY_NODE, repaired: needsUpdate };
}

function buildCampaignInput(command: MaiaCampaignAction) {
  const phones = [...new Set(command.recipients.map((lead) => normalizeLeadPhone(String(lead.phone || ""))).filter(Boolean))];
  const mediaUrl = String(command.mediaUrl || "").trim();
  const isDirect = command.campaignType === "direct_message";
  const defaultTemplate = command.templateName || "limitless_realty_update_v2";
  return {
    source: "fluxknight_dashboard", command_id: command.commandId, chat_id: command.createdBy || "fluxknight_dashboard", user_id: command.createdBy || "fluxknight_dashboard", text: command.message, original_text: command.message,
    action_type: "send_whatsapp_campaign", operation: "send_whatsapp_campaign", has_action: true, has_media: Boolean(mediaUrl), media_url: mediaUrl || undefined, media_type: mediaUrl ? "image" : undefined, image_url: mediaUrl || undefined,
    action_params: {
      recipient_phones: phones, custom_message: command.message, message_text: command.message, preserve_exact_message: true,
      message_delivery_mode: isDirect ? "direct" : "auto",
      campaign_type: command.campaignType || "limitless_realty_update", template_name: defaultTemplate, approved_template_name: defaultTemplate,
      allow_template_fallback: !isDirect, use_approved_template_outside_24h: !isDirect,
      topic: command.topic, property_filter: command.propertyTitle || "", media_url: mediaUrl || "", image_url: mediaUrl || "", media_type: mediaUrl ? "image" : "", has_media: Boolean(mediaUrl),
      confirm_send: true, confirm_real_client_broadcast: true, include_incomplete_leads: true, max_recipients: phones.length,
    },
    natural_response: isDirect
      ? "Send this direct WhatsApp message exactly as written. Do not rewrite it. Direct mode is only valid for contacts inside the 24-hour customer service window."
      : mediaUrl
        ? "Send the campaign using its approved Meta template outside the 24-hour window when required, with the attached Supabase-hosted image. Preserve the approved campaign intent and do not regenerate the message."
        : "Send the campaign using its configured approved Meta template outside the 24-hour window when required. Do not regenerate the campaign message.",
  };
}
function containsCommandId(value: unknown, commandId: string) { try { return JSON.stringify(value).includes(commandId); } catch { return false; } }
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function extractNodeJson(execution: Record<string, any>, nodeName: string) { const runs = execution.data?.resultData?.runData?.[nodeName]; const firstRun = Array.isArray(runs) ? runs[0] : null; const branches = Array.isArray(firstRun?.data?.main) ? firstRun.data.main : []; const firstBranch = Array.isArray(branches[0]) ? branches[0] : []; return (firstBranch[0]?.json || null) as CampaignSummary | null; }
async function waitForCampaignExecution(workflowId: string, commandId: string, startedAfter: number) {
  const deadline = Date.now() + EXECUTION_TIMEOUT_MS; let seenId: string | null = null;
  while (Date.now() < deadline) {
    const executions = (await listN8nExecutions({ workflowId, includeData: true, limit: 50 })) as Array<Record<string, any>>;
    const execution = executions.find((candidate) => { const startedAt = candidate.startedAt ? new Date(candidate.startedAt).getTime() : 0; return startedAt >= startedAfter - 5000 && containsCommandId(candidate, commandId); });
    if (!execution) { await sleep(POLL_INTERVAL_MS); continue; }
    seenId = String(execution.id); const resultData = execution.data?.resultData || {}; const status = String(execution.status || "").toLowerCase(); const error = resultData.error;
    if (error || ["error", "crashed", "canceled"].includes(status)) { const node = error?.node?.name || resultData.lastNodeExecuted || "unknown node"; const detail = error?.message || error?.description || `Execution ended with status ${status || "error"}.`; throw new Error(`Maia action execution ${execution.id} failed at ${node}: ${detail}`); }
    if (execution.finished || status === "success") { const path = Object.keys(resultData.runData || {}); const summary = extractNodeJson(execution, CAMPAIGN_SUMMARY_NODE); if (!summary) throw new Error(`Maia action execution ${execution.id} finished without ${CAMPAIGN_SUMMARY_NODE}. Executed: ${path.join(" -> ") || "none"}.`); return { executionId: String(execution.id), path, summary }; }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(seenId ? `Maia action execution ${seenId} did not finish within ${EXECUTION_TIMEOUT_MS / 1000} seconds.` : `No Maia action execution was found for command ${commandId}.`);
}
export async function dispatchMaiaCampaignAction(command: MaiaCampaignAction) {
  if (!command.message.trim()) throw new Error("A campaign message is required."); if (!command.recipients.length) throw new Error("The campaign has no recipients.");
  const route = await ensureMaiaActionWebhook(); const payload = buildCampaignInput(command); const startedAt = Date.now();
  const response = await fetch(`${getN8nBaseUrl()}/webhook/${route.webhookPath}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
  const responseText = await response.text().catch(() => ""); if (!response.ok) throw new Error(`Maia action webhook rejected the campaign: ${response.status}${responseText ? ` ${responseText}` : ""}`);
  const execution = await waitForCampaignExecution(route.workflowId, command.commandId, startedAt); const summary = execution.summary;
  return { route, executionId: execution.executionId, path: execution.path, summary, attempted: Number(summary.attempted || command.recipients.length), accepted: Number(summary.accepted_by_whatsapp_api || summary.submitted || 0), failed: Number(summary.immediate_failed || 0), skipped: Number(summary.skipped || 0), pendingDelivery: Number(summary.pending_delivery_confirmation || 0), freeFormSent: Number(summary.free_form_sent || 0), templateSent: Number(summary.template_sent || 0), acceptedRecipients: summary.accepted_recipients || [], failedRecipients: summary.failed_recipients || [], status: String(summary.status || "submitted"), message: String(summary.message || "Campaign submitted to WhatsApp.") };
}
