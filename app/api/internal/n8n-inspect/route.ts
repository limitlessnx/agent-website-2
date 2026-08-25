import { NextResponse } from "next/server";
import { getN8nWorkflow } from "@/lib/n8n-api";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== "inspect-2026-channel") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const workflow = await getN8nWorkflow("ZdRPo2dzteuK5Gup");
  return NextResponse.json({ nodes: (workflow.nodes || []).map((n: any) => ({ name: n.name, type: n.type, jsCode: n.parameters?.jsCode || null, text: n.parameters?.text || null })) });
}
