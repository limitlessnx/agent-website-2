import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { requirePortalPermission } from "@/lib/portal-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { isHotelOrganization } from "@/lib/hotel-communication-policy";
import { prepareCampaignStarters } from "@/lib/campaign-starter-provisioning";
import { CampaignTemplateError } from "@/lib/portal-campaign-templates";
import { WhatsAppCredentialError } from "@/lib/whatsapp-credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({error:"Unauthorized"}, {status:401});
  try { await requirePortalPermission(session, ["integrations.manage"]); }
  catch { return NextResponse.json({error:"An authorized integration manager must prepare the templates."},{status:403}); }
  const body = await request.json().catch(()=>null);
  if (!body || !["submit","link"].includes(body.action)) return NextResponse.json({error:"Choose submit or link."},{status:400});
  const admin = createAdminClient();
  const {data:org,error} = await admin.from("organizations").select("status,metadata").eq("id",session.organizationId).single();
  if(error || org?.status!=="active") return NextResponse.json({error:"Organization unavailable."},{status:409});
  let hotel = isHotelOrganization(org);
  if(!hotel) {
    const profile = await admin.from("client_onboarding_profiles").select("industry").eq("organization_id",session.organizationId).maybeSingle();
    if(profile.error) return NextResponse.json({error:"Organization industry unavailable."},{status:503});
    hotel=isHotelOrganization({metadata:{industry:profile.data?.industry}});
  }
  try {
    const results=await prepareCampaignStarters(session.organizationId,hotel,body.action==="submit");
    return NextResponse.json({results},{headers:{"Cache-Control":"private, no-store"}});
  } catch(reason) {
    return NextResponse.json({error:reason instanceof CampaignTemplateError || reason instanceof WhatsAppCredentialError ? reason.message : "Unable to prepare starter templates."},{status:reason instanceof CampaignTemplateError || reason instanceof WhatsAppCredentialError ? reason.status : 503});
  }
}
