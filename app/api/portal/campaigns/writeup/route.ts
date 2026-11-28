import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { CampaignTemplateError, loadAssignedPromotion, loadLinkedCampaignTemplates } from "@/lib/portal-campaign-templates";
import { loadSavedCampaignDrafts } from "@/lib/campaign-draft-contracts";
import { isHotelOrganization } from "@/lib/hotel-communication-policy";
import { validPromotionBody } from "@/lib/whatsapp-promotion-message";
import { CampaignWriteupError, createCampaignWriteup, parseWriteupInput } from "@/lib/campaign-ai-writeup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const json = (body: unknown, status = 200) => NextResponse.json(body, {status, headers:{"Cache-Control":"private, no-store"}});
async function workspace(organizationId:string) {
  const admin=createAdminClient();
  const {data:org,error}=await admin.from("organizations").select("status,name,metadata").eq("id",organizationId).single();
  if(error || !org || org.status!=="active") throw new CampaignWriteupError("Organization unavailable.",409);
  let hotel=isHotelOrganization(org);
  if(!hotel){
    const profile=await admin.from("client_onboarding_profiles").select("industry").eq("organization_id",organizationId).maybeSingle();
    if(profile.error)throw new CampaignWriteupError("Organization industry unavailable.",503);
    hotel=isHotelOrganization({metadata:{industry:profile.data?.industry}});
  }
  return {org,hotel};
}
export async function GET() {
  const session=await getClientSession();
  if(!session)return json({error:"Unauthorized"},401);
  try{await requirePortalPermission(session,["conversations.reply"]);}catch{return json({error:"You do not have permission to draft campaigns."},403);}
  try{
    const {hotel}=await workspace(session.organizationId);
    return json({drafts:await loadSavedCampaignDrafts(session.organizationId,hotel)});
  }catch(reason){return json({error:reason instanceof CampaignWriteupError?reason.message:"Unable to load saved draft mappings."},reason instanceof CampaignWriteupError?reason.status:503);}
}
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
    const {org,hotel}=await workspace(session.organizationId);
    await assertFluxFeatureAccess(session.organizationId,"follow_ups");
    let contract: {name:string;language:string;body:string;keys:string[]};
    let warning:string|undefined;
    if(body.draftOnly==="true"){
      const matches=(await loadSavedCampaignDrafts(session.organizationId,hotel)).filter(item=>item.name===body.templateName&&item.language===body.language);
      if(matches.length!==1)return json({error:"Choose a saved draft template from this workspace."},409);
      contract=matches[0];
      warning=matches[0].wordingVerified?"Saved template definition only. Live Meta approval must be checked before sending.":"Saved field mapping only. Exact Meta wording is unavailable; review the live template before sending.";
    }else if(hotel){
      const {templates}=await loadLinkedCampaignTemplates(session.organizationId,true,["hotel_campaign"]);
      const matches=templates.filter(item=>item.name===body.templateName&&item.language===body.language&&item.purpose==="hotel_campaign"&&item.category==="MARKETING"&&validPromotionBody(item.body,item.variable_keys));
      if(matches.length!==1)return json({error:"Select a supported, approved guest campaign template."},409);
      const template=matches[0];
      contract={name:template.name,language:template.language,body:template.body,keys:template.variable_keys};
    }else{
      const template=await loadAssignedPromotion(session.organizationId,{name:body.templateName,language:body.language});
      contract={name:template.name,language:template.language,body:template.body,keys:template.variable_keys};
    }
    const facts:Record<string,string>={};
    if(contract.keys.includes("business_name")){
      if(!org.name?.trim())return json({error:"Set the workspace business name first."},409);
      facts.business_name=org.name;
    }
    const draft=await createCampaignWriteup(session.organizationId,contract,input,facts,request.headers.get("x-flux-operation-id")||crypto.randomUUID());
    return json({...draft,...(warning?{warning}:{})});
  } catch(reason) {
    return json({error:reason instanceof CampaignTemplateError || reason instanceof CampaignWriteupError ? reason.message : "AI writing is unavailable. Check your plan and AI credits, or continue editing manually."},reason instanceof CampaignTemplateError || reason instanceof CampaignWriteupError ? reason.status : 503);
  }
}
