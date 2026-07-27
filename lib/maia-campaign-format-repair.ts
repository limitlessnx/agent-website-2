import {
  activateN8nWorkflow,
  getN8nWorkflow,
  updateN8nWorkflow,
} from "@/lib/n8n-api";

const ACTION_WORKFLOW_ID = "ZdRPo2dzteuK5Gup";
const CAMPAIGN_NODE = "Prepare WhatsApp Campaign";
const PATCH_MARKER = "Fluxknight exact campaign message mode";

type WorkflowNode = {
  name: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
};

async function saveWorkflow(workflow: Record<string, any>, nodes: WorkflowNode[]) {
  const updated = await updateN8nWorkflow(String(workflow.id), {
    name: workflow.name,
    nodes,
    connections: workflow.connections || {},
    settings: workflow.settings || {},
  });

  if (workflow.active && !updated.active) {
    await activateN8nWorkflow(String(workflow.id));
  }
}

function replaceIfPresent(source: string, before: string, after: string) {
  return source.includes(before) ? source.replace(before, after) : source;
}

function patchCampaignCode(source: string) {
  let code = source;

  const brandedSetup = `const customMessage = params.custom_message || params.message || params.message_text || '';
const campaignTitle = 'Update🚨🚨';
const campaignFooter = 'This is Agent Maia your Real estate support assistance';
const cleanCampaignCopy = value => String(value || '')
  .replace(/^\\s*(?:Update🚨🚨|New Estate Brief)\\s*/i, '')
  .replace(/\\s*(?:Reply YES if you want details or VIEWING if you want to schedule an inspection\\.?|This is Agent Maia your Real estate support assistance)\\s*$/i, '')
  .trim();
const topicParts = [];`;

  const exactSetup = `// ${PATCH_MARKER}
const customMessage = params.custom_message || params.message || params.message_text || '';
const preserveExactMessage = params.preserve_exact_message !== false;
const cleanCampaignCopy = value => String(value || '').trim();
const topicParts = [];`;

  code = replaceIfPresent(code, brandedSetup, exactSetup);

  const brandedMessage = `const campaignCoreMessage = cleanCampaignCopy(customMessage) || (
  'Hello {{name}}, this is Limitless Realty. Here is a quick summary of ' + topic + ':\\n\\n' +
  (propertySummary || 'I will share the matching property briefs with you shortly.')
);
const messageTemplate = campaignTitle + '\\n\\n' + campaignCoreMessage + '\\n\\n' + campaignFooter;`;

  const exactMessage = `const messageTemplate = cleanCampaignCopy(customMessage) || (
  'Hello {{name}}, this is Limitless Realty. Here is a quick summary of ' + topic + ':\\n\\n' +
  (propertySummary || 'I will share the matching property briefs with you shortly.')
);`;

  code = replaceIfPresent(code, brandedMessage, exactMessage);

  const brandedTemplateSummary = `const templateSummary = safeTemplateText(
    campaignTitle + ' ' + (rawTemplateSummary || 'New property updates are available from Limitless Realty.') + ' ' + campaignFooter,
    240
  );`;

  const exactTemplateSummary = `const templateSummary = safeTemplateText(
    cleanCampaignCopy(customMessage) || rawTemplateSummary || 'New property updates are available from Limitless Realty.',
    1024
  );`;

  code = replaceIfPresent(code, brandedTemplateSummary, exactTemplateSummary);

  code = code
    .replace(/const campaignTitle = 'Update🚨🚨';\s*/g, "")
    .replace(/const campaignFooter = 'This is Agent Maia your Real estate support assistance';\s*/g, "")
    .replace(/campaignTitle \+ '\\n\\n' \+ campaignCoreMessage \+ '\\n\\n' \+ campaignFooter/g, "campaignCoreMessage")
    .replace(/campaignTitle \+ ' ' \+ \(rawTemplateSummary \|\| 'New property updates are available from Limitless Realty\\.'\) \+ ' ' \+ campaignFooter/g, "cleanCampaignCopy(customMessage) || rawTemplateSummary || 'New property updates are available from Limitless Realty.'")
    .replace(/safeTemplateText\(([^;]+?),\s*240\)/g, "safeTemplateText($1, 1024)")
    .replace(
      /template_name:\s*params\.template_name\s*\|\|\s*'estate_brief_update',/g,
      "template_name: params.allow_template_fallback === true ? (params.template_name || 'estate_brief_update') : '',",
    );

  if (!code.includes(PATCH_MARKER)) {
    throw new Error(
      `${CAMPAIGN_NODE} did not contain a recognized campaign-format block; refusing an unsafe rewrite.`,
    );
  }

  return code;
}

export async function repairMaiaCampaignFormatting() {
  const workflow = await getN8nWorkflow(ACTION_WORKFLOW_ID);
  if (!workflow?.id) throw new Error("Maia action workflow was not found.");

  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as WorkflowNode[];
  const campaignNode = nodes.find((node) => node.name === CAMPAIGN_NODE);
  if (!campaignNode) throw new Error(`${CAMPAIGN_NODE} was not found.`);

  const parameters = { ...(campaignNode.parameters || {}) };
  const currentCode = String(parameters.jsCode || "");
  if (!currentCode) throw new Error(`${CAMPAIGN_NODE} has no JavaScript code.`);

  const nextCode = patchCampaignCode(currentCode);
  if (nextCode === currentCode) {
    return { repaired: false, workflowId: workflow.id, node: CAMPAIGN_NODE };
  }

  parameters.jsCode = nextCode;
  const nextNodes = nodes.map((node) =>
    node.name === CAMPAIGN_NODE ? { ...node, parameters } : node,
  );

  await saveWorkflow(workflow, nextNodes);

  return {
    repaired: true,
    workflowId: workflow.id,
    node: CAMPAIGN_NODE,
    exactMessageMode: true,
    forcedHeader: false,
    forcedFooter: false,
    legacyTemplateFallback: false,
    templateSummaryLimit: 1024,
  };
}
