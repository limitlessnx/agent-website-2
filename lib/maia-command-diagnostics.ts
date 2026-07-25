import {
  activateN8nWorkflow,
  findN8nWorkflowFlexible,
  getN8nWorkflow,
  listN8nExecutions,
  updateN8nWorkflow,
} from "@/lib/n8n-api";

const SUBWORKFLOW_TRIGGER_NAME = "Fluxknight Campaign Trigger";
const TRACE_MARKER = "TRACE-MAIA-7421";

type WorkflowNode = {
  id?: string;
  name: string;
  type: string;
  typeVersion?: number;
  position?: number[];
  parameters?: Record<string, unknown>;
};

type WorkflowConnection = {
  main?: Array<Array<{ node: string; type: string; index: number }>>;
};

function containsMarker(value: unknown, marker: string) {
  try {
    return JSON.stringify(value).includes(marker);
  } catch {
    return false;
  }
}

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

  if (!workflow) throw new Error("Unable to locate the Limitless Realty Maia WhatsApp workflow in n8n.");
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

export async function inspectAndRepairMaiaCommandPath(marker = TRACE_MARKER) {
  const summary = await resolveMaiaWorkflow();
  const workflow = await getN8nWorkflow(summary.id);
  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as WorkflowNode[];
  const connections = (workflow.connections || {}) as Record<string, WorkflowConnection>;
  const sourceTrigger = findSourceTrigger(nodes, connections);

  if (!sourceTrigger) {
    throw new Error(`${summary.name} has no connected Telegram, WhatsApp, or webhook trigger to trace.`);
  }

  const sourceConnection = connections[sourceTrigger.name];
  let dashboardTrigger = nodes.find((node) => node.name === SUBWORKFLOW_TRIGGER_NAME || node.type === "n8n-nodes-base.executeWorkflowTrigger");
  let changed = false;
  let repairedNodes = nodes;
  let repairedConnections = connections;

  if (!dashboardTrigger) {
    dashboardTrigger = {
      id: crypto.randomUUID(),
      name: SUBWORKFLOW_TRIGGER_NAME,
      type: "n8n-nodes-base.executeWorkflowTrigger",
      typeVersion: 1.1,
      position: [Number(sourceTrigger.position?.[0] || 0), Number(sourceTrigger.position?.[1] || 0) + 180],
      parameters: { inputSource: "passthrough" },
    };
    repairedNodes = [...nodes, dashboardTrigger];
    repairedConnections = {
      ...connections,
      [SUBWORKFLOW_TRIGGER_NAME]: JSON.parse(JSON.stringify(sourceConnection || { main: [] })),
    };
    changed = true;
  } else {
    const inputSource = dashboardTrigger.parameters?.inputSource;
    const hasConnection = Array.isArray(connections[dashboardTrigger.name]?.main) && connections[dashboardTrigger.name].main?.some((branch) => branch?.length);

    if (inputSource !== "passthrough" || !hasConnection || dashboardTrigger.name !== SUBWORKFLOW_TRIGGER_NAME) {
      repairedNodes = nodes.map((node) =>
        node === dashboardTrigger
          ? {
              ...node,
              name: SUBWORKFLOW_TRIGGER_NAME,
              parameters: { ...(node.parameters || {}), inputSource: "passthrough" },
            }
          : node,
      );
      const nextConnections = { ...connections };
      if (dashboardTrigger.name !== SUBWORKFLOW_TRIGGER_NAME) delete nextConnections[dashboardTrigger.name];
      nextConnections[SUBWORKFLOW_TRIGGER_NAME] = JSON.parse(JSON.stringify(sourceConnection || { main: [] }));
      repairedConnections = nextConnections;
      changed = true;
    }
  }

  if (changed) {
    const updated = await updateN8nWorkflow(summary.id, {
      name: workflow.name,
      nodes: repairedNodes,
      connections: repairedConnections,
      settings: workflow.settings || {},
    });
    if (summary.active && !updated.active) await activateN8nWorkflow(summary.id);
  }

  const executions = await listN8nExecutions({
    limit: 100,
    workflowId: summary.id,
    includeData: true,
  });

  const traced = executions.find((execution) => containsMarker(execution, marker));
  const runData = traced?.data?.resultData?.runData || {};
  const tracedNodes = Object.entries(runData)
    .filter(([, value]) => containsMarker(value, marker))
    .map(([nodeName]) => nodeName);

  const downstreamPath = tracedNodes.length
    ? tracedNodes
    : Object.keys(runData).filter((name) => /telegram|campaign|whatsapp|maia|send|message/i.test(name));

  return {
    workflow: {
      id: summary.id,
      name: summary.name,
      active: Boolean(summary.active),
    },
    sourceTrigger: {
      name: sourceTrigger.name,
      type: sourceTrigger.type,
      nextNodes: (sourceConnection?.main || []).flat().map((item) => item.node),
    },
    dashboardTrigger: {
      name: SUBWORKFLOW_TRIGGER_NAME,
      repaired: changed,
      inputSource: "passthrough",
      nextNodes: (repairedConnections[SUBWORKFLOW_TRIGGER_NAME]?.main || []).flat().map((item) => item.node),
    },
    trace: {
      marker,
      found: Boolean(traced),
      executionId: traced?.id || null,
      startedAt: traced?.startedAt || null,
      status: traced?.status || null,
      nodesContainingMarker: tracedNodes,
      inferredCommandPath: downstreamPath,
      lastNodeExecuted: traced?.data?.resultData?.lastNodeExecuted || null,
      error: traced?.data?.resultData?.error?.message || traced?.data?.resultData?.error?.description || null,
    },
  };
}
