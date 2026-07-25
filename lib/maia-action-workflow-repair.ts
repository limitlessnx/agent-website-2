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

type WorkflowNode = {
  name: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
};

const ORIGINAL_INPUT_LINE = "const input = $('Action Input').first().json;";
const PATCHED_INPUT_BLOCK = `// ${PATCH_MARKER}\nlet input = {};\ntry {\n  input = $('Action Input').first().json;\n} catch (error) {}\nif (!input || !Object.keys(input).length) {\n  input = $('${DASHBOARD_INPUT_NODE}').first().json;\n}`;

export async function repairMaiaActionWorkflowInput() {
  const workflow = await getN8nWorkflow(ACTION_WORKFLOW_ID);
  if (!workflow?.id) throw new Error(`${ACTION_WORKFLOW_NAME} was not found.`);

  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as WorkflowNode[];
  const prepareNode = nodes.find((node) => node.name === PREPARE_CAMPAIGN_NODE);
  if (!prepareNode) throw new Error(`${ACTION_WORKFLOW_NAME} is missing ${PREPARE_CAMPAIGN_NODE}.`);

  const parameters = { ...(prepareNode.parameters || {}) };
  const currentCode = String(parameters.jsCode || "");
  if (!currentCode) throw new Error(`${PREPARE_CAMPAIGN_NODE} has no JavaScript code.`);

  if (currentCode.includes(PATCH_MARKER)) {
    return { repaired: false, workflowId: workflow.id, node: PREPARE_CAMPAIGN_NODE };
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

  return { repaired: true, workflowId: workflow.id, node: PREPARE_CAMPAIGN_NODE };
}
