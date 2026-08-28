import { NextResponse } from "next/server";
import { getN8nWorkflow, listN8nWorkflows } from "@/lib/n8n-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nodeSummary(node: any) {
  return {
    id: text(node?.id),
    name: text(node?.name),
    type: text(node?.type),
    webhookPath: text(node?.parameters?.path),
    url: text(node?.parameters?.url),
  };
}

function workflowLooksRelevant(workflow: any) {
  const haystack = `${workflow?.name || ""} ${JSON.stringify(workflow?.nodes || [])}`.toLowerCase();
  return ["maia", "whatsapp", "conversation_log", "property_interest", "limitless", "leads"].some((needle) => haystack.includes(needle));
}

export async function GET() {
  try {
    const workflows = await listN8nWorkflows(250);
    const candidates: any[] = [];
    for (const workflow of workflows) {
      let full: any = workflow;
      try { full = await getN8nWorkflow(workflow.id); } catch {}
      if (!workflowLooksRelevant(full)) continue;
      const nodes = Array.isArray(full.nodes) ? full.nodes : [];
      const serialized = JSON.stringify(nodes).toLowerCase();
      candidates.push({
        id: full.id,
        name: full.name,
        active: Boolean(full.active),
        updatedAt: full.updatedAt || null,
        signals: {
          maia: serialized.includes("maia"),
          whatsapp: serialized.includes("whatsapp"),
          conversation_log: serialized.includes("conversation_log"),
          property_interest: serialized.includes("property_interest"),
          leads: serialized.includes("leads"),
        },
        nodes: nodes.map(nodeSummary),
      });
    }
    return NextResponse.json({ ok: true, workflow_count: workflows.length, candidates });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Inspection failed." }, { status: 500 });
  }
}
