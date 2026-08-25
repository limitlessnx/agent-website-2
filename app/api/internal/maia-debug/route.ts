import { NextResponse } from "next/server";
import { getN8nWorkflow } from "@/lib/n8n-api";

const TOKEN = "hxP8LwEuvvcp_S5E2ozs9L72";
const WORKFLOW_ID = "ZdRPo2dzteuK5Gup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== TOKEN) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const workflow = await getN8nWorkflow(WORKFLOW_ID);
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const campaign = nodes.find((node: any) => node?.name === "Prepare WhatsApp Campaign") as any;
  if (!campaign) return NextResponse.json({ error: "Prepare WhatsApp Campaign not found" }, { status: 404 });
  const code = String(campaign.parameters?.jsCode || "");
  return NextResponse.json({
    workflowId: workflow.id,
    active: workflow.active,
    node: campaign.name,
    code,
    matches: {
      templateButton: /template_button|button.*url|sub_type.*url|dynamic_url|action_button_url/i.test(code),
      updateTemplate: /limitless_realty_update_v2|limitless_realty_update/i.test(code),
      components: /template_components|components_by_recipient|body_parameters/i.test(code),
    },
  });
}
