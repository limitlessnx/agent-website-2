import { NextResponse } from "next/server";
import { getN8nWorkflow, listN8nExecutions, listN8nWorkflows } from "@/lib/n8n-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSPECT_TOKEN = "maia-inspect-7f34c9b2";

function safeParameters(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeParameters);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/credential|secret|token|api.?key|authorization|password/i.test(key)) {
      output[key] = "[redacted]";
      continue;
    }
    output[key] = safeParameters(item);
  }
  return output;
}

function runDataSummary(runData: Record<string, unknown> | undefined) {
  if (!runData) return [];
  return Object.entries(runData).map(([name, raw]) => {
    const runs = Array.isArray(raw) ? raw : [];
    const first = runs[0] as Record<string, unknown> | undefined;
    const data = first?.data as Record<string, unknown> | undefined;
    const main = Array.isArray(data?.main) ? data?.main : [];
    const firstBranch = Array.isArray(main?.[0]) ? main[0] : [];
    const firstItem = firstBranch?.[0] as Record<string, unknown> | undefined;
    const json = firstItem?.json;
    return {
      name,
      runCount: runs.length,
      outputItems: firstBranch.length,
      outputKeys:
        json && typeof json === "object" && !Array.isArray(json)
          ? Object.keys(json as Record<string, unknown>)
          : [],
      error: safeParameters(first?.error),
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

  const details = [];
  for (const summary of candidates) {
    const workflow = await getN8nWorkflow(summary.id);
    const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as Array<Record<string, unknown>>;
    const relevantNodes = nodes
      .filter((node) =>
        /telegram|whatsapp|campaign|broadcast|send|openai|extract message|process ad|webhook|admin/i.test(
          `${node.name || ""} ${node.type || ""}`,
        ),
      )
      .map((node) => ({
        name: node.name,
        type: node.type,
        parameters: safeParameters(node.parameters),
      }));

    const executions = await listN8nExecutions({ workflowId: summary.id, includeData: true, limit: 20 });
    details.push({
      id: summary.id,
      name: summary.name,
      active: summary.active,
      relevantNodes,
      connections: safeParameters(workflow.connections),
      executions: executions.map((execution) => ({
        id: execution.id,
        status: execution.status,
        finished: execution.finished,
        startedAt: execution.startedAt,
        lastNodeExecuted: execution.data?.resultData?.lastNodeExecuted,
        error: safeParameters(execution.data?.resultData?.error),
        runData: runDataSummary(execution.data?.resultData?.runData),
      })),
    });
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), workflows: details });
}
