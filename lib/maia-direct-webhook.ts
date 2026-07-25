import {
  activateN8nWorkflow,
  findN8nWorkflowFlexible,
  getN8nBaseUrl,
  getN8nWorkflow,
  updateN8nWorkflow,
} from "@/lib/n8n-api";
import type { ProgressiveLead } from "@/lib/lead-profile-service";

const DASHBOARD_WEBHOOK_NODE = "Fluxknight Maia Command Webhook";
const DASHBOARD_WEBHOOK_PATH = "fluxknight-maia-command";
const LEGACY_TRIGGER_NAME = "Fluxknight Campaign Trigger";

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
    JSON.stringify(connections[DASHBOARD_WEBHOOK_NODE] || {}) !== JSON.stringify(sourceConnection || {});

  if (needsUpdate) {
    const updated = await updateN8nWorkflow(summary.id, {
      name: workflow.name,
      nodes: [...cleanedNodes, directWebhook],
      connections: {
        ...nextConnections,
        [DASHBOARD_WEBHOOK_NODE]: JSON.parse(JSON.stringify(sourceConnection)),
      },
      settings: workflow.settings || {},
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
  const phone = String(lead.phone || "").replace(/[^\d]/g, "");
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
    lead,
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
      lead,
      metadata: payload.metadata || {},
    },
  };
}

export async function dispatchMaiaDirectCommand(payload: MaiaDirectCommandPayload) {
  const route = await ensureMaiaDashboardWebhook();
  const response = await fetch(`${getN8nBaseUrl()}/webhook/${route.webhookPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildMaiaInput(payload)),
    cache: "no-store",
  });

  const responseText = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Maia dashboard webhook failed: ${response.status}${responseText ? ` ${responseText}` : ""}`);
  }

  return {
    ok: true,
    status: response.status,
    response: responseText,
    route,
  };
}
