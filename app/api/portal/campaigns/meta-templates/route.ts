import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { CampaignTemplateError, loadAssignedPromotion, loadLinkedCampaignTemplates } from "@/lib/portal-campaign-templates";
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
    if (organization.data.slug === "xposure") {
      if (organization.data.status !== "active") return NextResponse.json({ error: "Organization is unavailable." }, { status: 409 });
      return NextResponse.json({ promotion: await loadAssignedPromotion(session.organizationId) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json(await loadLinkedCampaignTemplates(session.organizationId, false));
  }
  catch (error) { return NextResponse.json({ error: error instanceof CampaignTemplateError ? error.message : "Unable to load campaign templates." }, { status: error instanceof CampaignTemplateError ? error.status : 503 }); }
}
