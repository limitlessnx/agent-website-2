import { NextResponse } from "next/server";
import { dispatchMaiaCampaignAction } from "@/lib/maia-action-gateway";
import { repairMaiaActionWorkflowInput } from "@/lib/maia-action-workflow-repair";

const TEST_TOKEN = "fluxknight-wa-test-8f3c2a91";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (token !== TEST_TOKEN) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const repair = await repairMaiaActionWorkflowInput();
    const result = await dispatchMaiaCampaignAction({
      commandId: `manual-test-${Date.now()}`,
      campaignType: "limitless_realty_update",
      templateName: "limitless_realty_update_v2",
      topic: "Fluxknight WhatsApp delivery test",
      message: "Hello Limitless, this is a live WhatsApp delivery test.\n\nWe are testing the repaired Limitless Realty campaign template and its message parameters.\n\nPlease confirm that you received this test message.",
      recipients: [{ id: "test-limitless", name: "Limitless", phone: "2348127753308", status: "test" } as any],
      createdBy: "fluxknight_manual_test",
    });
    return NextResponse.json({ ok: true, repair, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
