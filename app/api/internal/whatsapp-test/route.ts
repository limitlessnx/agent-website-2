import { NextResponse } from "next/server";
import { getN8nWorkflow } from "@/lib/n8n-api";

const TEST_TOKEN = "fluxknight-wa-test-8f3c2a91";
const WORKFLOW_ID = "ZdRPo2dzteuK5Gup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== TEST_TOKEN) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const workflow = await getN8nWorkflow(WORKFLOW_ID);
    const node = (Array.isArray(workflow.nodes) ? workflow.nodes : []).find((item: any) => item?.name === "Prepare WhatsApp Campaign") as any;
    return NextResponse.json({ workflowId: workflow.id, active: workflow.active, node: node?.name, code: String(node?.parameters?.jsCode || "") });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
