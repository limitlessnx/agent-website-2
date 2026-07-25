import {
  activateN8nWorkflow,
  createN8nWorkflow,
  findN8nWorkflowByName,
  findN8nWorkflowFlexible,
  getN8nBaseUrl,
  getN8nWorkflow,
  isN8nApiConfigured,
  listN8nWorkflows,
  updateN8nWorkflow,
} from "@/lib/n8n-api";
import type { ProgressiveLead } from "@/lib/lead-profile-service";

const DASHBOARD_WORKFLOW_NAME = "Limitless Realty Dashboard Campaign";
const WHATSAPP_AGENT_WORKFLOW_NAME = "Limitless Realty WhatsApp Client Agent";
const WEBHOOK_PATH = "limitless-realty-dashboard-campaign";

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
      budget: lead.budget || '',
      location_preference: lead.location_preference || '',
      property_type: lead.property_type || '',
      property_interest: lead.property_interest || '',
      purpose: lead.purpose || '',
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

  const downstream = await resolveWhatsAppAgentWorkflow();
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
    return updated;
  }

  const workflow = await createN8nWorkflow(definition);
  await activateN8nWorkflow(workflow.id);
  return workflow;
}

export async function dispatchLimitlessWhatsAppCampaign(payload: CampaignDispatchPayload) {
  await ensureLimitlessCampaignWorkflow();
  const response = await fetch(`${getN8nBaseUrl()}/webhook/${WEBHOOK_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    throw new Error(`Campaign workflow failed: ${response.status} ${responseText}`);
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
