import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioFormSignature } from "@/lib/twilio-whatsapp";
import { syncRealEstateProviderStatus } from "@/lib/real-estate-provider-status";
import { syncHandoffNotificationStatus } from "@/lib/human-operations";
import { applyLegacyWhatsAppReceipt } from "@/lib/whatsapp-delivery-ledger";

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
  const mapped=state==="queued"?"accepted":state==="undelivered"?"failed":["accepted","sent","delivered","read","failed"].includes(state)?state:null;
  if(sid){
    if(mapped) await applyLegacyWhatsAppReceipt({
      organizationId:String(binding.organization_id),providerMessageId:sid,status:mapped,
      errorCode:String(params.get("ErrorCode")||"")||null,
      errorMessage:String(params.get("ErrorMessage")||"")||null,
      responsePayload:Object.fromEntries(params.entries()),
    });
    const realEstateState=state==="queued"?"accepted":state==="undelivered"?"failed":["sent","delivered","read","failed"].includes(state)?state:null;
    if(realEstateState){
      await syncRealEstateProviderStatus({provider:"twilio",providerMessageId:sid,status:realEstateState as "accepted"|"sent"|"delivered"|"read"|"failed",eventAt:new Date().toISOString(),organizationId:String(binding.organization_id),errorCode:String(params.get("ErrorCode")||"")||null,errorMessage:String(params.get("ErrorMessage")||"")||null}).catch(()=>{throw new Error("WhatsApp canonical receipt could not be stored.");});
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
