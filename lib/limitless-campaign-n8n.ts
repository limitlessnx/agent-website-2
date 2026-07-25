import {
  activateN8nWorkflow,
  createN8nWorkflow,
  findN8nWorkflowByName,
  findN8nWorkflowFlexible,
  getN8nBaseUrl,
  getN8nWorkflow,
  isN8nApiConfigured,
  listN8nExecutions,
  listN8nWorkflows,
  updateN8nWorkflow,
} from "@/lib/n8n-api";
import type { ProgressiveLead } from "@/lib/lead-profile-service";

const DASHBOARD_WORKFLOW_NAME = "Limitless Realty Dashboard Campaign";
const WHATSAPP_AGENT_WORKFLOW_NAME = "Limitless Realty WhatsApp Client Agent";
const WEBHOOK_PATH = "limitless-realty-dashboard-campaign";
const SUBWORKFLOW_TRIGGER_NAME = "Fluxknight Campaign Trigger";

export type CampaignDispatchPayload = {
  campaignId: string;
  topic: string;
  message: string;
  mediaUrl?: string;
  property?: {
    id?: string;
    title?: string;
    price?: string;
    location?: string;
    drivePhotosLink?: string;
    driveBrochureLink?: string;
  };
  recipients: ProgressiveLead[];
  createdBy?: string;
};

type WorkflowNode = {
  id: string;
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

function nodeId() {
  return crypto.randomUUID();
}

async function resolveWhatsAppAgentWorkflow() {
  const explicitId = process.env.N8N_LIMITLESS_WHATSAPP_WORKFLOW_ID || "";
  const explicitName = process.env.N8N_LIMITLESS_WHATSAPP_WORKFLOW_NAME || "";

  const workflow = await findN8nWorkflowFlexible({
    workflowId: explicitId || undefined,
    exactNames: [
      explicitName,
      WHATSAPP_AGENT_WORKFLOW_NAME,
      "Limitless Realty Whatsapp Client Agent",
      "Limitless Realty Maia WhatsApp Client Agent",
      "Limitless Realty WhatsApp Agent",
    ].filter(Boolean),
    requiredKeywords: ["limitless", "whatsapp"],
    preferredKeywords: ["realty", "client", "agent", "maia"],
  });

  if (workflow) return workflow;

  const workflows = await listN8nWorkflows(250);
  const limitlessNames = workflows
    .filter((item) => /limitless|whatsapp|maia/i.test(item.name))
    .map((item) => item.name)
    .slice(0, 12);

  throw new Error(
    limitlessNames.length
      ? `n8n WhatsApp workflow not found. Available related workflows: ${limitlessNames.join(" | ")}`
      : "n8n WhatsApp workflow not found. No Limitless, Maia, or WhatsApp workflows were returned by the n8n API key.",
  );
}

async function ensureSubworkflowTrigger(summary: { id: string; name: string; active?: boolean }) {
  const workflow = await getN8nWorkflow(summary.id);
  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as WorkflowNode[];
  const connections = (workflow.connections || {}) as Record<string, WorkflowConnection>;

  const existingTrigger = nodes.find((node) => node.type === "n8n-nodes-base.executeWorkflowTrigger");
  if (existingTrigger) return workflow;

  const connectedTriggers = nodes.filter((node) => {
    const output = connections[node.name]?.main;
    return /trigger|webhook/i.test(node.type) && Array.isArray(output) && output.some((branch) => branch?.length);
  });

  const sourceTrigger =
    connectedTriggers.find((node) => /whatsapp|telegram|webhook/i.test(`${node.name} ${node.type}`)) || connectedTriggers[0];

  if (!sourceTrigger) {
    throw new Error(
      `${summary.name} has no connected trigger whose first processing connection can be reused for dashboard campaigns.`,
    );
  }

  const sourceConnection = connections[sourceTrigger.name];
  const sourcePosition = Array.isArray(sourceTrigger.position) ? sourceTrigger.position : [0, 0];
  const dashboardTrigger: WorkflowNode = {
    id: nodeId(),
    name: SUBWORKFLOW_TRIGGER_NAME,
    type: "n8n-nodes-base.executeWorkflowTrigger",
    typeVersion: 1.1,
    position: [Number(sourcePosition[0] || 0), Number(sourcePosition[1] || 0) + 180],
    parameters: { inputSource: "passthrough" },
  };

  const updated = await updateN8nWorkflow(summary.id, {
    name: workflow.name,
    nodes: [...nodes, dashboardTrigger],
    connections: {
      ...connections,
      [dashboardTrigger.name]: JSON.parse(JSON.stringify(sourceConnection)),
    },
    settings: workflow.settings || {},
  });

  if (summary.active && !updated.active) await activateN8nWorkflow(summary.id);
  return updated;
}

function buildCampaignWorkflow(downstream: { id: string; name: string }) {
  const webhookNodeName = "Dashboard Campaign Webhook";
  const prepareNodeName = "Prepare WhatsApp Recipients";
  const executeNodeName = "Run WhatsApp Client Agent";
  const resultNodeName = "Campaign Execution Result";

  return {
    name: DASHBOARD_WORKFLOW_NAME,
    nodes: [
      {
        id: nodeId(),
        name: webhookNodeName,
        type: "n8n-nodes-base.webhook",
        typeVersion: 2,
        position: [0, 0],
        webhookId: nodeId(),
        parameters: {
          httpMethod: "POST",
          path: WEBHOOK_PATH,
          responseMode: "lastNode",
          options: {},
        },
      },
      {
        id: nodeId(),
        name: prepareNodeName,
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [260, 0],
        parameters: {
          jsCode: `const payload = $json.body ?? $json;
const recipients = Array.isArray(payload.recipients) ? payload.recipients : [];
return recipients
  .filter((lead) => lead && lead.phone)
  .map((lead) => ({
    json: {
      source: 'fluxknight_dashboard',
      campaign_id: payload.campaignId,
      campaign_topic: payload.topic,
      campaign_message: payload.message,
      message: payload.message,
      text: payload.message,
      media_url: payload.mediaUrl || payload.property?.drivePhotosLink || '',
      property: payload.property || null,
      lead,
      name: lead.name,
      phone: lead.phone,
      to: lead.phone,
      recipient_phone: lead.phone,
      whatsapp_number: lead.phone,
      budget: lead.budget || '',
      location_preference: lead.location_preference || '',
      property_type: lead.property_type || '',
      property_interest: lead.property_interest || '',
      purpose: lead.purpose || '',
      body: {
        source: 'fluxknight_dashboard',
        message: payload.message,
        text: payload.message,
        phone: lead.phone,
        to: lead.phone,
        name: lead.name,
        media_url: payload.mediaUrl || payload.property?.drivePhotosLink || '',
        property: payload.property || null
      }
    },
  }));`,
        },
      },
      {
        id: nodeId(),
        name: executeNodeName,
        type: "n8n-nodes-base.executeWorkflow",
        typeVersion: 1.2,
        position: [540, 0],
        parameters: {
          mode: "each",
          workflowId: {
            __rl: true,
            value: downstream.id,
            mode: "list",
            cachedResultName: downstream.name,
          },
          options: {
            waitForSubWorkflow: true,
          },
        },
      },
      {
        id: nodeId(),
        name: resultNodeName,
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [820, 0],
        parameters: {
          jsCode: `const items = $input.all();
return [{ json: {
  ok: true,
  processed: items.length,
  status: 'workflow_completed',
  note: 'The downstream WhatsApp workflow completed. Provider delivery receipts must still be confirmed separately.'
} }];`,
        },
      },
    ],
    connections: {
      [webhookNodeName]: {
        main: [[{ node: prepareNodeName, type: "main", index: 0 }]],
      },
      [prepareNodeName]: {
        main: [[{ node: executeNodeName, type: "main", index: 0 }]],
      },
      [executeNodeName]: {
        main: [[{ node: resultNodeName, type: "main", index: 0 }]],
      },
    },
    settings: {
      executionOrder: "v1",
    },
  };
}

export async function ensureLimitlessCampaignWorkflow() {
  if (!isN8nApiConfigured()) {
    throw new Error("n8n API is not configured in Vercel.");
  }

  const downstreamSummary = await resolveWhatsAppAgentWorkflow();
  const downstream = await ensureSubworkflowTrigger(downstreamSummary);
  const definition = buildCampaignWorkflow(downstream);
  const existing = await findN8nWorkflowByName(DASHBOARD_WORKFLOW_NAME);

  if (existing) {
    const current = await getN8nWorkflow(existing.id);
    const updated = await updateN8nWorkflow(existing.id, {
      name: definition.name,
      nodes: definition.nodes,
      connections: definition.connections,
      settings: definition.settings,
    });
    if (!current.active && !updated.active) await activateN8nWorkflow(existing.id);
    return { workflow: updated, downstream };
  }

  const workflow = await createN8nWorkflow(definition);
  await activateN8nWorkflow(workflow.id);
  return { workflow, downstream };
}

async function describeLatestFailure(workflowId: string) {
  try {
    const executions = await listN8nExecutions({
      limit: 3,
      workflowId,
      status: "error",
      includeData: true,
    });
    const latest = executions[0];
    const error = latest?.data?.resultData?.error;
    const nodeName = error?.node?.name || latest?.data?.resultData?.lastNodeExecuted || "unknown node";
    const detail = error?.description || error?.message || "n8n returned no detailed node error.";
    return `Execution ${latest?.id || "unknown"} failed at ${nodeName}: ${detail}`;
  } catch (error) {
    return `Could not read n8n execution diagnostics: ${error instanceof Error ? error.message : "unknown error"}`;
  }
}

export async function dispatchLimitlessWhatsAppCampaign(payload: CampaignDispatchPayload) {
  const { workflow, downstream } = await ensureLimitlessCampaignWorkflow();
  const response = await fetch(`${getN8nBaseUrl()}/webhook/${WEBHOOK_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const wrapperFailure = await describeLatestFailure(workflow.id);
    const downstreamFailure = await describeLatestFailure(downstream.id);
    throw new Error(
      `Campaign workflow failed: ${response.status}. ${wrapperFailure}. WhatsApp workflow: ${downstreamFailure}`,
    );
  }

  let result: Record<string, unknown> = {};
  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    result = { raw: responseText };
  }

  return {
    accepted: payload.recipients.length,
    processed: Number(result.processed || 0),
    status: String(result.status || "workflow_completed"),
    response: result,
  };
}
