import {
  activateN8nWorkflow,
  getN8nWorkflow,
  updateN8nWorkflow,
} from "@/lib/n8n-api";

const ACTION_WORKFLOW_ID = "ZdRPo2dzteuK5Gup";
const ACTION_WORKFLOW_NAME = "Maia Action - Search Lead";
const PREPARE_CAMPAIGN_NODE = "Prepare WhatsApp Campaign";
const DASHBOARD_INPUT_NODE = "Fluxknight Normalize Maia Action";
const PATCH_MARKER = "Fluxknight dashboard fallback";
const UPDATE_V2_MARKER = "Fluxknight exact Update v2 template contract";

type WorkflowNode = {
  name: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
};

const ORIGINAL_INPUT_LINE = "const input = $('Action Input').first().json;";
const PATCHED_INPUT_BLOCK = `// ${PATCH_MARKER}
let input = {};
try {
  input = $('Action Input').first().json;
} catch (error) {}
if (!input || !Object.keys(input).length) {
  input = $('${DASHBOARD_INPUT_NODE}').first().json;
}

// ${UPDATE_V2_MARKER}
// Keep the approved Limitless Realty Update v2 contract explicit at the n8n boundary.
// It has exactly four BODY parameters and no header, media, or URL-button component.
const updateV2Params = input?.action_params;
if (updateV2Params && (updateV2Params.template_name === 'limitless_realty_update_v2' || updateV2Params.campaign_type === 'limitless_realty_update')) {
  const body = Array.isArray(updateV2Params.template_body_parameters) ? updateV2Params.template_body_parameters : [];
  const recipientComponents = Array.isArray(updateV2Params.template_components_by_recipient) ? updateV2Params.template_components_by_recipient : [];
  const exactBody = body.slice(0, 4);
  if (exactBody.length === 4 && exactBody.every((item) => String(item?.text || '').trim())) {
    updateV2Params.template_components = [{ type: 'body', parameters: exactBody }];
    updateV2Params.template_components_by_recipient = recipientComponents.map((item) => ({
      ...item,
      components: [{ type: 'body', parameters: Array.isArray(item?.components?.[0]?.parameters) ? item.components[0].parameters.slice(0, 4) : exactBody }],
    }));
  }
  updateV2Params.template_button_parameters = [];
  updateV2Params.dynamic_url = '';
  updateV2Params.action_button_url = '';
  updateV2Params.media_url = '';
  updateV2Params.image_url = '';
  updateV2Params.media_type = '';
  updateV2Params.has_media = false;
  updateV2Params.force_template_body_only = true;
  updateV2Params.template_parameter_count = 4;
}`;
`;

export async function repairMaiaActionWorkflowInput() {
  const workflow = await getN8nWorkflow(ACTION_WORKFLOW_ID);
  if (!workflow?.id) throw new Error(`${ACTION_WORKFLOW_NAME} was not found.`);

  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as WorkflowNode[];
  const prepareNode = nodes.find((node) => node.name === PREPARE_CAMPAIGN_NODE);
  if (!prepareNode) throw new Error(`${ACTION_WORKFLOW_NAME} is missing ${PREPARE_CAMPAIGN_NODE}.`);

  const parameters = { ...(prepareNode.parameters || {}) };
  const currentCode = String(parameters.jsCode || "");
  if (!currentCode) throw new Error(`${PREPARE_CAMPAIGN_NODE} has no JavaScript code.`);

  if (currentCode.includes(UPDATE_V2_MARKER)) {
    return { repaired: false, workflowId: workflow.id, node: PREPARE_CAMPAIGN_NODE, updateV2Contract: true };
  }

  if (!currentCode.includes(ORIGINAL_INPUT_LINE)) {
    throw new Error(
      `${PREPARE_CAMPAIGN_NODE} no longer contains the expected Action Input expression; refusing an unsafe automatic rewrite.`,
    );
  }

  parameters.jsCode = currentCode.replace(ORIGINAL_INPUT_LINE, PATCHED_INPUT_BLOCK);
  const nextNodes = nodes.map((node) =>
    node.name === PREPARE_CAMPAIGN_NODE ? { ...node, parameters } : node,
  );

  const updated = await updateN8nWorkflow(workflow.id, {
    name: workflow.name,
    nodes: nextNodes,
    connections: workflow.connections || {},
    settings: workflow.settings || {},
  });

  if (workflow.active && !updated.active) await activateN8nWorkflow(workflow.id);

  return { repaired: true, workflowId: workflow.id, node: PREPARE_CAMPAIGN_NODE, updateV2Contract: true };
}
