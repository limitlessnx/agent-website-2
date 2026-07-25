import { NextResponse } from "next/server";
import { dispatchMaiaCampaignAction } from "@/lib/maia-action-gateway";
import { repairMaiaActionWorkflowInput } from "@/lib/maia-action-workflow-repair";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "maia-smoke-94c2f13d";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const repair = await repairMaiaActionWorkflowInput();
  const commandId = `smoke-${crypto.randomUUID()}`;
  const result = await dispatchMaiaCampaignAction({
    commandId,
    topic: "Fluxknight dashboard route test",
    message: "Fluxknight dashboard campaign route test successful.",
    recipients: [
      {
        id: "fluxknight-smoke-test",
        name: "Limitless",
        phone: "07036233508",
        status: "in_conversation",
        campaign_eligible: true,
      },
    ],
    createdBy: "fluxknight_smoke_test",
  });

  return NextResponse.json({ ok: true, commandId, repair, ...result });
}
