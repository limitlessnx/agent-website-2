import { NextResponse } from "next/server";
import { getN8nWorkflow, listN8nExecutions, listN8nWorkflows } from "@/lib/n8n-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSPECT_TOKEN = "maia-inspect-7f34c9b2";
const SEND_PATTERN = /whatsapp|send.*(message|text|media)|message.*send|cloud api|evolution|twilio|http request/i;

function nodeNames(execution: Record<string, any>) {
  return Object.keys(execution.data?.resultData?.runData || {});
}

function connectionTargets(connection: unknown) {
  const main = (connection as { main?: Array<Array<{ node?: string }>> } | undefined)?.main || [];
  return main.map((branch) => branch.map((item) => String(item.node || "")).filter(Boolean));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== INSPECT_TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const workflows = await listN8nWorkflows(250);
  const candidates = workflows.filter((workflow) =>
    /limitless|maia|whatsapp|telegram|campaign/i.test(workflow.name),
  );

  const evidence = [];
  for (const summary of candidates) {
    const workflow = await getN8nWorkflow(summary.id);
    const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as Array<Record<string, any>>;
    const nodeMap = new Map(nodes.map((node) => [String(node.name), node]));
    const connections = (workflow.connections || {}) as Record<string, unknown>;
    const executions = (await listN8nExecutions({ workflowId: summary.id, includeData: true, limit: 100 })) as Array<Record<string, any>>;

    const failed2189 = executions.find((execution) => String(execution.id) === "2189");
    const successfulSendExecutions = executions
      .filter((execution) => {
        const names = nodeNames(execution);
        const status = String(execution.status || "").toLowerCase();
        return (execution.finished || status === "success") && names.some((name) => SEND_PATTERN.test(name));
      })
      .slice(0, 8);

    const selected = [failed2189, ...successfulSendExecutions].filter(Boolean) as Array<Record<string, any>>;
    if (!selected.length) continue;

    const routeNames = new Set(selected.flatMap(nodeNames));
    const routeConnections: Record<string, string[][]> = {};
    for (const name of routeNames) {
      if (connections[name]) routeConnections[name] = connectionTargets(connections[name]);
    }

    const routeNodes = [...routeNames].map((name) => {
      const node = nodeMap.get(name);
      return {
        name,
        type: String(node?.type || ""),
        operation: String(node?.parameters?.operation || node?.parameters?.resource || ""),
      };
    });

    evidence.push({
      workflow: { id: summary.id, name: summary.name, active: summary.active },
      failed2189: failed2189
        ? {
            path: nodeNames(failed2189),
            lastNode: failed2189.data?.resultData?.lastNodeExecuted,
            message: failed2189.data?.resultData?.error?.message || failed2189.data?.resultData?.error?.description,
          }
        : null,
      successfulSendExecutions: successfulSendExecutions.map((execution) => ({
        id: execution.id,
        startedAt: execution.startedAt,
        path: nodeNames(execution),
        sendNodes: nodeNames(execution).filter((name) => SEND_PATTERN.test(name)),
        lastNode: execution.data?.resultData?.lastNodeExecuted,
      })),
      routeNodes,
      routeConnections,
    });
  }

  const payload = { generatedAt: new Date().toISOString(), evidence };
  console.log("MAIA_ROUTE_EVIDENCE", JSON.stringify(payload));
  return NextResponse.json(payload);
}
