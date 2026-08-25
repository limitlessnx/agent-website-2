import {
  activateN8nWorkflow,
  getN8nWorkflow,
  updateN8nWorkflow,
} from "@/lib/n8n-api";

const ACTION_WORKFLOW_ID = "ZdRPo2dzteuK5Gup";
const ACTION_WORKFLOW_NAME = "Maia Action - Search Lead";
const PREPARE_CAMPAIGN_NODE = "Prepare WhatsApp Campaign";
const PATCH_MARKER = "Fluxknight exact Update v2 four-body contract";

type WorkflowNode = {
  name: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
};

export async function repairMaiaActionWorkflowInput() {
  const workflow = await getN8nWorkflow(ACTION_WORKFLOW_ID);
  if (!workflow?.id) throw new Error(`${ACTION_WORKFLOW_NAME} was not found.`);

  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as WorkflowNode[];
  const prepareNode = nodes.find((node) => node.name === PREPARE_CAMPAIGN_NODE);
  if (!prepareNode) throw new Error(`${ACTION_WORKFLOW_NAME} is missing ${PREPARE_CAMPAIGN_NODE}.`);

  const parameters = { ...(prepareNode.parameters || {}) };
  const currentCode = String(parameters.jsCode || "");
  if (!currentCode) throw new Error(`${PREPARE_CAMPAIGN_NODE} has no JavaScript code.`);

  let nextCode = currentCode;
  let repaired = false;

  if (currentCode.includes(PATCH_MARKER)) {
    if (!currentCode.includes("const isTwoParamLimitlessTemplate = false;")) {
      nextCode = currentCode.replace(
        `  // ${PATCH_MARKER}`,
        `  // ${PATCH_MARKER}\n  const isTwoParamLimitlessTemplate = false;`,
      );
      repaired = true;
    }
  } else {
    const start = currentCode.indexOf("  const isTwoParamLimitlessTemplate =");
    const end = currentCode.indexOf("  const whatsappPayload = requiresTemplate", start);
    if (start < 0 || end < 0) {
      throw new Error(`${PREPARE_CAMPAIGN_NODE} does not contain the expected template-body construction block; refusing an unsafe rewrite.`);
    }

    const replacement = `  // ${PATCH_MARKER}\n  const isTwoParamLimitlessTemplate = false;\n  // Meta's approved limitless_realty_update_v2 contract is four BODY parameters and no button/media component.\n  const templateBodyParams = [\n    safeTemplateText(recipient.name || 'there', 60),\n    safeTemplateText(templateDisplayHeader, 240),\n    safeTemplateText(dashboardMessage, 1024),\n    safeTemplateText(params.response_prompt || params.reply_prompt || 'Reply YES if you want more information about this update.', 1024),\n  ];\n`;
    nextCode = currentCode.slice(0, start) + replacement + currentCode.slice(end);
    repaired = true;
  }

  if (!repaired) {
    return { repaired: false, workflowId: workflow.id, node: PREPARE_CAMPAIGN_NODE, updateV2Contract: true, bodyParameterCount: 4 };
  }

  parameters.jsCode = nextCode;
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

  return {
    repaired: true,
    workflowId: workflow.id,
    node: PREPARE_CAMPAIGN_NODE,
    updateV2Contract: true,
    bodyParameterCount: 4,
    buttonParameters: 0,
    mediaComponents: 0,
  };
}
