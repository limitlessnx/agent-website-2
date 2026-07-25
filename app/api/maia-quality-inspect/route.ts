import { NextResponse } from "next/server";
import { getN8nWorkflow, listN8nWorkflows } from "@/lib/n8n-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "maia-quality-91c7";

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/credential|secret|token|api.?key|authorization|password/i.test(key)) out[key] = "[redacted]";
    else out[key] = redact(item);
  }
  return out;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== TOKEN) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workflows = await listN8nWorkflows(250);
  const selected = workflows.filter((w) => /Maia Action - Search Lead|Limitless Realty WhatsApp Client Agent/i.test(w.name));
  const result = [];
  for (const summary of selected) {
    const workflow = await getN8nWorkflow(summary.id);
    const nodes = (Array.isArray(workflow.nodes) ? workflow.nodes : []) as Array<Record<string, unknown>>;
    const wanted = nodes.filter((node) => /Prepare WhatsApp Campaign|OpenAI - Generate Response2|Extract Message Data|Process Ad Guide Capture|property|catalog|search lead/i.test(String(node.name || "")));
    result.push({ id: workflow.id, name: workflow.name, nodes: wanted.map((node) => ({ name: node.name, type: node.type, parameters: redact(node.parameters) })), connections: redact(workflow.connections) });
  }
  return NextResponse.json({ workflows: result });
}
