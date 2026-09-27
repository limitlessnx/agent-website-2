import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioFormSignature } from "@/lib/twilio-whatsapp";

export const dynamic="force-dynamic";
function canonicalUrl(request:NextRequest){
  const origin=String(process.env.FLUXKNIGHT_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||request.nextUrl.origin).replace(/\/$/,"");
  return origin+"/api/whatsapp/twilio/status";
}
export async function POST(request:NextRequest){
  const raw=await request.text();
  const params=new URLSearchParams(raw);
  const accountSid=String(params.get("AccountSid")||"");
  const admin=createAdminClient();
  const {data:binding}=await admin.from("whatsapp_twilio_bindings")
    .select("organization_id")
    .eq("twilio_subaccount_sid",accountSid)
    .maybeSingle();
  if(!binding)return NextResponse.json({error:"Unknown Twilio account"},{status:401});
  const {data:credentials}=await (admin as any).rpc("get_organization_integration_credentials",{
    p_organization_id:binding.organization_id,p_provider:"whatsapp",
  });
  const authToken=String((credentials as Record<string,unknown>|null)?.twilio_auth_token||"");
  if(!validateTwilioFormSignature({authToken,signature:request.headers.get("x-twilio-signature"),url:canonicalUrl(request),params})){
    return NextResponse.json({error:"Invalid Twilio signature"},{status:401});
  }

  const sid=String(params.get("MessageSid")||params.get("SmsSid")||"");
  const state=String(params.get("MessageStatus")||params.get("SmsStatus")||"").toLowerCase();
  const mapped=["queued","sent","delivered","read","failed","undelivered"].includes(state)?state:"accepted";
  if(sid){
    await admin.from("whatsapp_delivery_attempts").update({
      status:mapped,
      error_code:String(params.get("ErrorCode")||"")||null,
      error_message:String(params.get("ErrorMessage")||"")||null,
      response_payload:Object.fromEntries(params.entries()),
    }).eq("provider_message_id",sid);
  }
  return NextResponse.json({ok:true});
}
