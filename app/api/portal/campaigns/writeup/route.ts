import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { CampaignTemplateError, loadAssignedPromotion } from "@/lib/portal-campaign-templates";
import { CampaignWriteupError, createCampaignWriteup, parseWriteupInput } from "@/lib/campaign-ai-writeup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const json = (body: unknown, status = 200) => NextResponse.json(body, {status, headers:{"Cache-Control":"private, no-store"}});
export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return json({error:"Unauthorized"},401);
  try { await requirePortalPermission(session, ["conversations.reply"]); }
  catch { return json({error:"You do not have permission to draft campaigns."},403); }
  try {
    const body = await request.json().catch(()=>null);
    const input = parseWriteupInput(body);
    if (typeof body.templateName !== "string" || !/^[a-z0-9_]{1,512}$/.test(body.templateName) ||
        typeof body.language !== "string" || !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(body.language))
      return json({error:"Select an approved template and language."},400);
    const {data:org,error} = await createAdminClient().from("organizations").select("status,name").eq("id",session.organizationId).single();
    if(error || !org || org.status !== "active") return json({error:"Organization unavailable."},409);
    await assertFluxFeatureAccess(session.organizationId,"follow_ups");
    const template=await loadAssignedPromotion(session.organizationId,{name:body.templateName,language:body.language});
    const facts:Record<string,string>={};
    if(template.variable_keys.includes("business_name")){
      if(!org.name?.trim())return json({error:"Set the workspace business name first."},409);
      facts.business_name=org.name;
    }
    return json(await createCampaignWriteup(session.organizationId,{name:template.name,language:template.language,body:template.body,keys:template.variable_keys},input,facts,request.headers.get("x-flux-operation-id")||crypto.randomUUID()));
  } catch(reason) {
    return json({error:reason instanceof CampaignTemplateError || reason instanceof CampaignWriteupError ? reason.message : "AI writing is unavailable. Check your plan and AI credits, or continue editing manually."},reason instanceof CampaignTemplateError || reason instanceof CampaignWriteupError ? reason.status : 503);
  }
}
