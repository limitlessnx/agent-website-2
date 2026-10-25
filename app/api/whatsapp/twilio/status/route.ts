import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioFormSignature } from "@/lib/twilio-whatsapp";
import { syncRealEstateProviderStatus } from "@/lib/real-estate-provider-status";
import { syncHandoffNotificationStatus } from "@/lib/human-operations";

export const dynamic="force-dynamic";
type CredentialsRpcClient = {
  rpc: (functionName: string, args: { p_organization_id: string; p_provider: string }) => Promise<{ data: unknown; error: unknown }>
};

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
  const rpcClient = admin as unknown as CredentialsRpcClient;
  const {data:credentials}=await rpcClient.rpc("get_organization_integration_credentials",{
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
    const realEstateState=state==="queued"?"accepted":state==="undelivered"?"failed":["sent","delivered","read","failed"].includes(state)?state:null;
    if(realEstateState){
      await syncRealEstateProviderStatus({provider:"twilio",providerMessageId:sid,status:realEstateState as "accepted"|"sent"|"delivered"|"read"|"failed",eventAt:new Date().toISOString(),organizationId:String(binding.organization_id),errorCode:String(params.get("ErrorCode")||"")||null,errorMessage:String(params.get("ErrorMessage")||"")||null}).catch(()=>undefined);
    }
    const handoffState=["queued","accepted","sending","sent"].includes(state)?"sent":state==="undelivered"?"failed":["delivered","read","failed"].includes(state)?state:null;
    if(handoffState){
      await syncHandoffNotificationStatus({
        organizationId:String(binding.organization_id),
        providerMessageId:sid,
        status:handoffState as "sent"|"delivered"|"read"|"failed",
        errorCode:String(params.get("ErrorCode")||"")||null,
        errorMessage:String(params.get("ErrorMessage")||"")||null,
      }).catch((error:unknown)=>console.warn("[twilio-status] handoff receipt sync unavailable",{providerMessageIdPresent:Boolean(sid),errorType:error instanceof Error?error.name:"unknown"}));
    }
  }
  return NextResponse.json({ok:true});
}
