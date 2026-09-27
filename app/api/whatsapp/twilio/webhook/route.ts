import { NextRequest } from "next/server";
import { tasks } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateTwilioFormSignature, normalizeTwilioWhatsAppAddress } from "@/lib/twilio-whatsapp";
import { resolveWhatsAppRuntimeTarget } from "@/lib/whatsapp-runtime-routing";

export const dynamic="force-dynamic";

function canonicalUrl(request:NextRequest,path:string){
  const origin=String(process.env.FLUXKNIGHT_APP_URL||process.env.NEXT_PUBLIC_SITE_URL||request.nextUrl.origin).replace(/\/$/,"");
  return origin+path;
}
async function bindingAndToken(accountSid:string){
  const admin=createAdminClient();
  const {data:binding,error}=await admin.from("whatsapp_twilio_bindings")
    .select("organization_id,twilio_subaccount_sid,sender_phone_e164,status")
    .eq("twilio_subaccount_sid",accountSid)
    .maybeSingle();
  if(error) throw error;
  if(!binding) return null;
  const {data:credentials,error:credError}=await (admin as any).rpc("get_organization_integration_credentials",{
    p_organization_id:binding.organization_id,p_provider:"whatsapp",
  });
  if(credError) throw credError;
  const raw=(credentials||{}) as Record<string,unknown>;
  const authToken=String(raw.twilio_auth_token||"");
  if(!authToken) return null;
  return {binding,authToken};
}
function messageBody(params:URLSearchParams){
  const body=String(params.get("Body")||"").trim();
  if(body)return body;
  const count=Math.max(0,Number(params.get("NumMedia")||0));
  if(count>0)return "[Customer sent media]";
  return "";
}

export async function POST(request:NextRequest){
  const raw=await request.text();
  const params=new URLSearchParams(raw);
  const accountSid=String(params.get("AccountSid")||"");
  if(!accountSid)return new Response("Missing AccountSid",{status:400});

  const resolved=await bindingAndToken(accountSid);
  if(!resolved)return new Response("Unknown Twilio account",{status:401});
  const valid=validateTwilioFormSignature({
    authToken:resolved.authToken,
    signature:request.headers.get("x-twilio-signature"),
    url:canonicalUrl(request,"/api/whatsapp/twilio/webhook"),
    params,
  });
  if(!valid)return new Response("Invalid Twilio signature",{status:401});

  const target=await resolveWhatsAppRuntimeTarget(resolved.binding.organization_id);
  if(!target)return new Response("<Response></Response>",{status:200,headers:{"content-type":"text/xml"}});

  const messageSid=String(params.get("MessageSid")||params.get("SmsMessageSid")||"");
  const from=normalizeTwilioWhatsAppAddress(String(params.get("From")||"")).replace(/[^0-9]/g,"");
  const to=normalizeTwilioWhatsAppAddress(String(params.get("To")||""));
  const text=messageBody(params);
  if(!messageSid||!from||!text)return new Response("<Response></Response>",{status:200,headers:{"content-type":"text/xml"}});

  const inbound={
    organizationId:target.organizationId,
    agentId:target.agentId,
    channel:"whatsapp" as const,
    provider:"twilio_whatsapp",
    externalEventId:messageSid,
    externalConversationId:from,
    customerPhone:from,
    customerName:String(params.get("ProfileName")||""),
    message:text,
    metadata:{
      accountSid,
      to,
      waId:String(params.get("WaId")||from),
      messagingServiceSid:String(params.get("MessagingServiceSid")||"")||null,
      numMedia:Number(params.get("NumMedia")||0),
    },
  };
  if(target.mode==="maia")await tasks.trigger("maia-process-inbound-message",inbound);
  else await tasks.trigger("tenant-whatsapp-process-inbound-message",{...inbound,sourceSystemId:target.sourceSystemId});

  return new Response("<Response></Response>",{status:200,headers:{"content-type":"text/xml; charset=utf-8","cache-control":"no-store"}});
}
