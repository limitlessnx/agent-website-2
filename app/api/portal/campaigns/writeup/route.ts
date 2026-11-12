import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { loadLinkedCampaignTemplates, CampaignTemplateError } from "@/lib/portal-campaign-templates";
import { createCampaignWriteup, parseWriteupInput, CampaignWriteupError } from "@/lib/campaign-ai-writeup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private" } });

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return json({ error: "Unauthorized" }, 401);
  try { await requirePortalPermission(session, ["conversations.reply"]); } catch { return json({ error: "You do not have permission to draft campaign messages." }, 403); }
  try {
    const organization = await createAdminClient().from("organizations").select("slug,status,name").eq("id", session.organizationId).single();
    if (organization.error || organization.data?.slug !== "xposure" || organization.data?.status !== "active") return json({ error: "Switch to the active Xposure workspace." }, 403);
    const body = await request.json().catch(() => null);
    const input = parseWriteupInput(body);
    await assertFluxFeatureAccess(session.organizationId, "follow_ups");
    const { templates } = await loadLinkedCampaignTemplates(session.organizationId, true);
    const template = templates.find(item => item.name === body.templateName && item.language === body.language && item.purpose === body.templatePurpose && ["campaign", "customer_follow_up", "campaign_promotion"].includes(item.purpose));
    if (!template) return json({ error: "Choose a linked, approved campaign template." }, 409);
    const facts: Record<string, string> = organization.data.name ? { business_name: String(organization.data.name) } : {};
    return json(await createCampaignWriteup(session.organizationId, { name: template.name, language: template.language, body: template.body, keys: template.variable_keys }, input, facts));
  } catch (error) {
    if (error instanceof CampaignWriteupError || error instanceof CampaignTemplateError) return json({ error: error.message }, error.status);
    return json({ error: "AI writing is unavailable. Check your plan and AI credits, or continue editing manually." }, 503);
  }
}
