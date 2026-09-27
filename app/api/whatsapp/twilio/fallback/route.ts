import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioFormSignature } from "@/lib/twilio-whatsapp";

export async function POST(request:NextRequest){
  const raw=await request.text();
  const params=new URLSearchParams(raw);
  const accountSid=String(params.get("AccountSid")||"");
  const admin=createAdminClient();
  const {data:binding}=await admin.from("whatsapp_twilio_bindings").select("organization_id").eq("twilio_subaccount_sid",accountSid).maybeSingle();
  if(!binding)return NextResponse.json({error:"Unknown Twilio account"},{status:401});
  const {data:credentials}=await (admin as any).rpc("get_organization_integration_credentials",{p_organization_id:binding.organization_id,p_provider:"whatsapp"});
  const token=String((credentials as Record<string,unknown>|null)?.twilio_auth_token||"");
  const origin=String(process.env.FLUXKNIGHT_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||request.nextUrl.origin).replace(/\/$/,"");
  if(!validateTwilioFormSignature({authToken:token,signature:request.headers.get("x-twilio-signature"),url:origin+"/api/whatsapp/twilio/fallback",params})){
    return NextResponse.json({error:"Invalid Twilio signature"},{status:401});
  }
  await admin.from("organization_integrations").update({
    status:"degraded",
    health:{state:"degraded",message:"Twilio used the WhatsApp fallback webhook.",error_code:String(params.get("ErrorCode")||"")||null},
    last_checked_at:new Date().toISOString(),
  }).eq("organization_id",binding.organization_id).eq("provider","whatsapp");
  return NextResponse.json({ok:true});
}
