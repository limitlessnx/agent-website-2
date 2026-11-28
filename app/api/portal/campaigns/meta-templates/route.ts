import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { CampaignTemplateError, loadCampaignPromotions, loadLinkedCampaignTemplates } from "@/lib/portal-campaign-templates";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await requirePortalPermission(session, ["conversations.view", "conversations.reply"]); }
  catch { return NextResponse.json({ error: "You do not have permission to view campaign templates." }, { status: 403 }); }
  try {
    const organization = await createAdminClient().from("organizations").select("slug,status").eq("id", session.organizationId).single();
    if (organization.error || !organization.data) return NextResponse.json({ error: "Organization is unavailable." }, { status: 503 });
    if (organization.data.status !== "active") return NextResponse.json({ error: "Organization is unavailable." }, { status: 409 });
    const headers = { "Cache-Control": "private, no-store" };
    if (organization.data.slug === "xposure") {
      const { promotions, inventory } = await loadCampaignPromotions(session.organizationId);
      const preferred = promotions.filter(item => item.purpose === "campaign_promotion");
      return NextResponse.json({ promotion: preferred.length === 1 ? preferred[0] : null, promotions, inventory }, { headers });
    }
    return NextResponse.json(await loadLinkedCampaignTemplates(session.organizationId, false, null), { headers });
  }
  catch (error) { return NextResponse.json({ error: error instanceof CampaignTemplateError ? error.message : "Unable to load campaign templates." }, { status: error instanceof CampaignTemplateError ? error.status : 503 }); }
}
