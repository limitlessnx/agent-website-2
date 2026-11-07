import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { CampaignTemplateError, loadLinkedCampaignTemplates } from "@/lib/portal-campaign-templates";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { await requirePortalPermission(session, ["conversations.view", "conversations.reply"]); }
  catch { return NextResponse.json({ error: "You do not have permission to view campaign templates." }, { status: 403 }); }
  try {
    const organization = await createAdminClient().from("organizations").select("slug").eq("id", session.organizationId).single();
    if (organization.error || !organization.data) return NextResponse.json({ error: "Organization is unavailable." }, { status: 503 });
    return NextResponse.json(await loadLinkedCampaignTemplates(session.organizationId, organization.data.slug === "xposure"));
  }
  catch (error) { return NextResponse.json({ error: error instanceof CampaignTemplateError ? error.message : "Unable to load campaign templates." }, { status: error instanceof CampaignTemplateError ? error.status : 503 }); }
}
