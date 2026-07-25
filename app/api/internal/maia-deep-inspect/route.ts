import { NextResponse } from "next/server";
import { getN8nWorkflow, listN8nExecutions, listN8nWorkflows } from "@/lib/n8n-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSPECT_TOKEN = "maia-inspect-7f34c9b2";
const TARGET_WORKFLOW = "Maia Action - Search Lead";
const TARGET_NODES = [
  "Action Input",
  "Route Campaign Request",
  "Prepare WhatsApp Campaign",
  "Should Send Campaign?",
  "Send Campaign WhatsApp",
  "Campaign Send Summary",
];

function safe(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safe);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/credential|secret|token|api.?key|authorization|password/i.test(key)) {
      output[key] = "[redacted]";
    } else {
      output[key] = safe(item);
    }
  }
  return output;
}

function nodeOutput(execution: Record<string, any>, nodeName: string) {
  const runs = execution.data?.resultData?.runData?.[nodeName];
  const firstRun = Array.isArray(runs) ? runs[0] : null;
  const branches = Array.isArray(firstRun?.data?.main) ? firstRun.data.main : [];
  return branches.map((branch: unknown) => {
    const items = Array.isArray(branch) ? branch : [];
    return items.slice(0, 2).map((item: any) => safe(item?.json));
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== INSPECT_TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workflows = await listN8nWorkflows(250);
  const summary = workflows.find((workflow) => workflow.name === TARGET_WORKFLOW);
  if (!summary) return NextResponse.json({ error: `${TARGET_WORKFLOW} not found` }, { status: 404 });

  const workflow = await getN8nWorkflow(summary.id);
  const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as Array<Record<string, any>>;
  const selectedNodes = TARGET_NODES.map((name) => nodes.find((node) => node.name === name))
    .filter(Boolean)
    .map((node) => ({
      name: node!.name,
      type: node!.type,
      parameters: safe(node!.parameters),
    }));

  const executions = (await listN8nExecutions({ workflowId: summary.id, includeData: true, limit: 30 })) as Array<Record<string, any>>;
  const selectedExecutions = executions
    .filter((execution) => ["2168", "2164", "2162", "2137"].includes(String(execution.id)))
    .map((execution) => ({
      id: execution.id,
      status: execution.status,
      path: Object.keys(execution.data?.resultData?.runData || {}),
      input: nodeOutput(execution, "Action Input"),
      routed: nodeOutput(execution, "Route Campaign Request"),
      prepared: nodeOutput(execution, "Prepare WhatsApp Campaign"),
      decision: nodeOutput(execution, "Should Send Campaign?"),
      sent: nodeOutput(execution, "Send Campaign WhatsApp"),
      summary: nodeOutput(execution, "Campaign Send Summary"),
    }));

  return NextResponse.json({
    workflow: { id: summary.id, name: summary.name, active: summary.active },
    nodes: selectedNodes,
    connections: safe(workflow.connections),
    executions: selectedExecutions,
  });
}
