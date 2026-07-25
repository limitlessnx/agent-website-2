import {
  activateN8nWorkflow,
  createN8nWorkflow,
  findN8nWorkflowByName,
  findN8nWorkflowFlexible,
  getN8nBaseUrl,
  isN8nApiConfigured,
  listN8nWorkflows,
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

export async function ensureLimitlessCampaignWorkflow() {
  if (!isN8nApiConfigured()) {
    throw new Error("n8n API is not configured in Vercel.");
  }

  const existing = await findN8nWorkflowByName(DASHBOARD_WORKFLOW_NAME);
  if (existing) {
    if (!existing.active) await activateN8nWorkflow(existing.id);
    return existing;
  }

  const downstream = await resolveWhatsAppAgentWorkflow();

  const webhookNodeName = "Dashboard Campaign Webhook";
  const prepareNodeName = "Prepare WhatsApp Recipients";
  const executeNodeName = "Run WhatsApp Client Agent";

  const workflow = await createN8nWorkflow({
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
          responseMode: "onReceived",
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
            waitForSubWorkflow: false,
          },
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
    },
    settings: {
      executionOrder: "v1",
    },
  });

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

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Campaign webhook failed: ${response.status} ${detail}`);
  }

  return {
    accepted: payload.recipients.length,
    response: await response.text().catch(() => ""),
  };
}
