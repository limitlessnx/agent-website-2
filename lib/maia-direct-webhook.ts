import {
  activateN8nWorkflow,
  findN8nWorkflowFlexible,
  getN8nBaseUrl,
  getN8nWorkflow,
  listN8nExecutions,
  updateN8nWorkflow,
} from "@/lib/n8n-api";
import type { ProgressiveLead } from "@/lib/lead-profile-service";
import { normalizeLeadPhone } from "@/lib/lead-profile-service";

const DASHBOARD_WEBHOOK_NODE = "Fluxknight Maia Command Webhook";
const DASHBOARD_WEBHOOK_PATH = "fluxknight-maia-command";
const LEGACY_TRIGGER_NAME = "Fluxknight Campaign Trigger";
const EXECUTION_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 750;

type WorkflowNode = {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  position?: number[];
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
};

type WorkflowConnection = {
  main?: Array<Array<{ node: string; type: string; index: number }>>;
  [key: string]: unknown;
};

type ExecutionResultData = {
  runData?: Record<string, unknown>;
  lastNodeExecuted?: string;
  error?: {
    message?: string;
    description?: string;
    node?: { name?: string; type?: string };
  };
};

export type MaiaDirectCommandPayload = {
  commandId: string;
  commandType: string;
  topic: string;
  message: string;
  mediaUrl?: string;
  property?: Record<string, unknown>;
  recipient: ProgressiveLead;
  createdBy?: string;
  metadata?: Record<string, unknown>;
};

async function resolveMaiaWorkflow() {
  const workflow = await findN8nWorkflowFlexible({
    workflowId: process.env.N8N_LIMITLESS_WHATSAPP_WORKFLOW_ID || undefined,
    exactNames: [
      process.env.N8N_LIMITLESS_WHATSAPP_WORKFLOW_NAME || "",
      "Limitless Realty WhatsApp Client Agent",
      "Limitless Realty Whatsapp Client Agent",
      "Limitless Realty Maia WhatsApp Client Agent",
      "Limitless Realty WhatsApp Agent",
    ].filter(Boolean),
    requiredKeywords: ["limitless", "whatsapp"],
    preferredKeywords: ["realty", "maia", "client", "agent"],
  });

  if (!workflow) throw new Error("Unable to locate Maia's WhatsApp workflow in n8n.");
  return workflow;
}

function findSourceTrigger(nodes: WorkflowNode[], connections: Record<string, WorkflowConnection>) {
  const connected = nodes.filter((node) => {
    const output = connections[node.name]?.main;
    return /trigger|webhook/i.test(`${node.type} ${node.name}`) && Array.isArray(output) && output.some((branch) => branch?.length);
  });

  return (
    connected.find((node) => /telegram/i.test(`${node.name} ${node.type}`)) ||
    connected.find((node) => /whatsapp|webhook/i.test(`${node.name} ${node.type}`)) ||
    connected[0] ||
    null
  );
}

export async function ensureMaiaDashboardWebhook() {
  const summary = await resolveMaiaWorkflow();
  const workflow = await getN8nWorkflow(summary.id);
  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as WorkflowNode[];
  const connections = (workflow.connections || {}) as Record<string, WorkflowConnection>;
  const sourceTrigger = findSourceTrigger(nodes, connections);

  if (!sourceTrigger) throw new Error(`${summary.name} has no connected source trigger to mirror.`);

  const sourceConnection = connections[sourceTrigger.name];
  const webhookNode = nodes.find((node) => node.name === DASHBOARD_WEBHOOK_NODE);
  const nextNodes = (sourceConnection?.main || []).flat().map((item) => item.node);

  if (!nextNodes.length) throw new Error(`${sourceTrigger.name} has no downstream processing node.`);

  const legacyTrigger = nodes.find((node) => node.name === LEGACY_TRIGGER_NAME);
  const cleanedNodes = nodes.filter((node) => node.name !== LEGACY_TRIGGER_NAME && node.name !== DASHBOARD_WEBHOOK_NODE);
  const nextConnections = { ...connections };
  delete nextConnections[LEGACY_TRIGGER_NAME];
  delete nextConnections[DASHBOARD_WEBHOOK_NODE];

  const directWebhook: WorkflowNode = {
    id: webhookNode?.id || crypto.randomUUID(),
    name: DASHBOARD_WEBHOOK_NODE,
    type: "n8n-nodes-base.webhook",
    typeVersion: 2,
    position: [Number(sourceTrigger.position?.[0] || 0), Number(sourceTrigger.position?.[1] || 0) + 180],
    webhookId: String(webhookNode?.webhookId || crypto.randomUUID()),
    parameters: {
      httpMethod: "POST",
      path: DASHBOARD_WEBHOOK_PATH,
      responseMode: "onReceived",
      options: {},
    },
  };

  const needsUpdate =
    !webhookNode ||
    Boolean(legacyTrigger) ||
    webhookNode.parameters?.responseMode !== "onReceived" ||
    JSON.stringify(connections[DASHBOARD_WEBHOOK_NODE] || {}) !== JSON.stringify(sourceConnection || {});

  if (needsUpdate) {
    const updated = await updateN8nWorkflow(summary.id, {
      name: workflow.name,
      nodes: [...cleanedNodes, directWebhook],
      connections: {
        ...nextConnections,
        [DASHBOARD_WEBHOOK_NODE]: JSON.parse(JSON.stringify(sourceConnection)),
      },
      settings: {
        ...(workflow.settings || {}),
        saveExecutionProgress: true,
        saveDataSuccessExecution: "all",
        saveDataErrorExecution: "all",
      },
    });
    if (summary.active && !updated.active) await activateN8nWorkflow(summary.id);
  }

  return {
    workflowId: summary.id,
    workflowName: summary.name,
    sourceTrigger: sourceTrigger.name,
    nextNodes,
    webhookPath: DASHBOARD_WEBHOOK_PATH,
    repaired: needsUpdate,
  };
}

function buildMaiaInput(payload: MaiaDirectCommandPayload) {
  const lead = payload.recipient;
  const phone = normalizeLeadPhone(String(lead.phone || ""));
  const mediaUrl = payload.mediaUrl || "";

  return {
    source: "fluxknight_dashboard",
    command_id: payload.commandId,
    command_type: payload.commandType,
    campaign_id: payload.commandId,
    campaign_topic: payload.topic,
    campaign_message: payload.message,
    message: payload.message,
    text: payload.message,
    media_url: mediaUrl,
    property: payload.property || null,
    lead: { ...lead, phone },
    name: lead.name,
    phone,
    to: phone,
    recipient_phone: phone,
    whatsapp_number: phone,
    budget: lead.budget || "",
    location_preference: lead.location_preference || "",
    property_type: lead.property_type || "",
    property_interest: lead.property_interest || "",
    purpose: lead.purpose || "",
    created_by: payload.createdBy || "fluxknight_dashboard",
    metadata: payload.metadata || {},
    body: {
      source: "fluxknight_dashboard",
      command_id: payload.commandId,
      command_type: payload.commandType,
      message: payload.message,
      text: payload.message,
      phone,
      to: phone,
      name: lead.name,
      media_url: mediaUrl,
      property: payload.property || null,
      lead: { ...lead, phone },
      metadata: payload.metadata || {},
    },
  };
}

function containsCommandId(value: unknown, commandId: string) {
  try {
    return JSON.stringify(value).includes(commandId);
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForMaiaExecution(workflowId: string, commandId: string, startedAfter: number) {
  const deadline = Date.now() + EXECUTION_TIMEOUT_MS;
  let seenExecutionId: string | null = null;

  while (Date.now() < deadline) {
    const executions = await listN8nExecutions({
      workflowId,
      includeData: true,
      limit: 50,
    });

    const execution = executions.find((candidate) => {
      const startedAt = candidate.startedAt ? new Date(candidate.startedAt).getTime() : 0;
      return startedAt >= startedAfter - 5000 && containsCommandId(candidate, commandId);
    });

    if (!execution) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    seenExecutionId = execution.id;
    const resultData = (execution.data?.resultData || {}) as ExecutionResultData;
    const runData = resultData.runData || {};
    const executedNodes = Object.keys(runData);
    const status = String(execution.status || "").toLowerCase();
    const error = resultData.error;

    if (error || ["error", "crashed", "canceled"].includes(status)) {
      const nodeName = error?.node?.name || resultData.lastNodeExecuted || "unknown node";
      const message = error?.message || error?.description || `Execution ended with status ${status || "error"}.`;
      throw new Error(`Maia execution ${execution.id} failed at ${nodeName}: ${message}`);
    }

    if (execution.finished || status === "success") {
      const sendNodes = executedNodes.filter((name) =>
        /whatsapp|send.*(message|text|media)|message.*send|cloud api|evolution|twilio|http request/i.test(name),
      );

      if (!sendNodes.length) {
        throw new Error(
          `Maia execution ${execution.id} completed without reaching a recognisable WhatsApp send node. Executed: ${executedNodes.join(" -> ") || "none"}.`,
        );
      }

      return {
        executionId: execution.id,
        status: status || "success",
        lastNodeExecuted: resultData.lastNodeExecuted || executedNodes.at(-1) || null,
        executedNodes,
        sendNodes,
      };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    seenExecutionId
      ? `Maia execution ${seenExecutionId} did not finish within ${EXECUTION_TIMEOUT_MS / 1000} seconds.`
      : `No Maia execution was found for command ${commandId} within ${EXECUTION_TIMEOUT_MS / 1000} seconds.`,
  );
}

export async function dispatchMaiaDirectCommand(payload: MaiaDirectCommandPayload) {
  const route = await ensureMaiaDashboardWebhook();
  const startedAt = Date.now();
  const response = await fetch(`${getN8nBaseUrl()}/webhook/${route.webhookPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildMaiaInput(payload)),
    cache: "no-store",
  });

  const responseText = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Maia webhook rejected the command: ${response.status}${responseText ? ` ${responseText}` : ""}`);
  }

  const execution = await waitForMaiaExecution(route.workflowId, payload.commandId, startedAt);

  return {
    ok: true,
    status: 200,
    response: execution,
    route,
  };
}
