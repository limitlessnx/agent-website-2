import { NextResponse } from "next/server";
import { getN8nWorkflow, listN8nExecutions, listN8nWorkflows } from "@/lib/n8n-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSPECT_TOKEN = "maia-inspect-7f34c9b2";
const ROUTE_PATTERN = /telegram|whatsapp|campaign|broadcast|send|openai|extract message|process ad|webhook|admin|router|switch|if/i;
const SEND_PATTERN = /whatsapp|send.*(message|text|media)|message.*send|cloud api|evolution|twilio|http request/i;

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

function nodeNames(execution: Record<string, any>) {
  return Object.keys(execution.data?.resultData?.runData || {});
}

function outputShape(execution: Record<string, any>, nodeName: string) {
  const runs = execution.data?.resultData?.runData?.[nodeName];
  const firstRun = Array.isArray(runs) ? runs[0] : null;
  const branches = Array.isArray(firstRun?.data?.main) ? firstRun.data.main : [];
  return branches.map((branch: unknown, index: number) => {
    const items = Array.isArray(branch) ? branch : [];
    const json = (items[0] as any)?.json;
    return {
      index,
      items: items.length,
      keys: json && typeof json === "object" && !Array.isArray(json) ? Object.keys(json) : [],
      source: json?.source,
      commandType: json?.command_type,
      messageKeys: json && typeof json === "object"
        ? Object.keys(json).filter((key) => /message|text|phone|to|recipient|chat|campaign|command|media/i.test(key))
        : [],
    };
  });
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

  const result = [];
  for (const summary of candidates) {
    const workflow = await getN8nWorkflow(summary.id);
    const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as Array<Record<string, any>>;
    const nodeMap = new Map(nodes.map((node) => [String(node.name), node]));
    const connections = (workflow.connections || {}) as Record<string, any>;
    const executions = (await listN8nExecutions({ workflowId: summary.id, includeData: true, limit: 50 })) as Array<Record<string, any>>;

    const interestingExecutions = executions.filter((execution) => {
      const names = nodeNames(execution);
      return (
        String(execution.id) === "2189" ||
        names.some((name) => SEND_PATTERN.test(name)) ||
        names.some((name) => /telegram|campaign|broadcast|admin/i.test(name))
      );
    });

    const relevantNames = new Set<string>();
    for (const node of nodes) {
      if (ROUTE_PATTERN.test(`${node.name || ""} ${node.type || ""}`)) relevantNames.add(String(node.name));
    }
    for (const execution of interestingExecutions) {
      for (const name of nodeNames(execution)) relevantNames.add(name);
    }

    const relevantConnections: Record<string, unknown> = {};
    for (const [source, value] of Object.entries(connections)) {
      const targets = JSON.stringify(value);
      if (relevantNames.has(source) || [...relevantNames].some((name) => targets.includes(`\"node\":\"${name}\"`))) {
        relevantConnections[source] = safe(value);
      }
    }

    result.push({
      workflow: { id: summary.id, name: summary.name, active: summary.active },
      nodes: [...relevantNames]
        .map((name) => nodeMap.get(name))
        .filter(Boolean)
        .map((node) => ({
          name: node!.name,
          type: node!.type,
          parameters: safe(node!.parameters),
        })),
      connections: relevantConnections,
      executions: interestingExecutions.map((execution) => {
        const names = nodeNames(execution);
        return {
          id: execution.id,
          status: execution.status,
          finished: execution.finished,
          startedAt: execution.startedAt,
          lastNodeExecuted: execution.data?.resultData?.lastNodeExecuted,
          error: safe(execution.data?.resultData?.error),
          path: names,
          sendNodes: names.filter((name) => SEND_PATTERN.test(name)),
          outputs: names
            .filter((name) => /extract message|telegram|campaign|broadcast|admin|router|switch|if|send|whatsapp/i.test(name))
            .map((name) => ({ name, branches: outputShape(execution, name) })),
        };
      }),
    });
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), workflows: result });
}
