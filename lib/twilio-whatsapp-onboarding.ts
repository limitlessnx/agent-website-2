import { createAdminClient } from "@/lib/supabase/admin";
import {
  createTwilioSubaccount,
  getTwilioWhatsAppSender,
  registerTwilioWhatsAppSender,
  twilioTechProviderConfig,
} from "@/lib/twilio-whatsapp";

type NumberSource="customer"|"twilio_sms"|"twilio_voice";
type Json=Record<string,unknown>;

function siteOrigin(){
  return String(
    process.env.FLUXKNIGHT_APP_URL
    ||process.env.NEXT_PUBLIC_SITE_URL
    ||"https://fluxknight.space"
  ).replace(/\/$/,"");
}

function e164(value:string){
  const normalized=String(value||"").replace(/\s+/g,"");
  if(!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error("WhatsApp phone number must be valid E.164, for example +2348012345678.");
  return normalized;
}

export async function getTwilioWhatsAppBinding(organizationId:string){
  const {data,error}=await createAdminClient()
    .from("whatsapp_twilio_bindings")
    .select("*")
    .eq("organization_id",organizationId)
    .maybeSingle();
  if(error) throw error;
  return data;
}

export async function beginTwilioWhatsAppOnboarding(input:{
  organizationId:string;
  membershipId:string;
  numberSource:NumberSource;
  senderPhoneE164?:string|null;
  senderProfileName?:string|null;
}){
  const config=twilioTechProviderConfig();
  if(!config.configured){
    throw new Error("Twilio Tech Provider onboarding is not fully configured.");
  }

  const phone=input.senderPhoneE164?e164(input.senderPhoneE164):null;
  const profile=String(input.senderProfileName||"").trim().slice(0,256)||null;
  const admin=createAdminClient();

  const {data:session,error}=await admin.from("whatsapp_twilio_onboarding_sessions")
    .insert({
      organization_id:input.organizationId,
      membership_id:input.membershipId,
      status:"started",
      number_source:input.numberSource,
      sender_phone_e164:phone,
      sender_profile_name:profile,
    })
    .select("id,expires_at")
    .single();
  if(error) throw error;

  const existing=await getTwilioWhatsAppBinding(input.organizationId);
  const integrationId=existing?.integration_id||null;
  const rpc=admin as any;
  const {error:bindingError}=await rpc.rpc("upsert_whatsapp_twilio_binding",{
    p_organization_id:input.organizationId,
    p_integration_id:integrationId,
    p_status:"embedded_signup",
    p_sender_phone_e164:phone,
    p_sender_profile_name:profile,
    p_number_source:input.numberSource,
    p_twilio_subaccount_sid:existing?.twilio_subaccount_sid||null,
    p_twilio_sender_sid:existing?.twilio_sender_sid||null,
    p_twilio_sender_status:existing?.twilio_sender_status||null,
    p_provider_metadata:{onboarding_session_id:session.id},
  });
  if(bindingError) throw bindingError;

  return {
    sessionId:session.id,
    expiresAt:session.expires_at,
    appId:config.appId,
    configId:config.configId,
    solutionId:config.solutionId,
    featureType:input.numberSource==="twilio_sms"?"only_waba_sharing":null,
  };
}

async function storeTwilioTenantCredentials(input:{
  organizationId:string;
  accountSid:string;
  authToken:string;
  senderSid:string;
  senderPhoneE164:string;
  wabaId:string;
  metaPhoneNumberId?:string|null;
}){
  const admin=createAdminClient() as any;
  const {data,error}=await admin.rpc("store_organization_integration_credentials",{
    p_organization_id:input.organizationId,
    p_provider:"whatsapp",
    p_display_name:"WhatsApp",
    p_credentials:{
      provider_family:"twilio",
      twilio_account_sid:input.accountSid,
      twilio_auth_token:input.authToken,
      twilio_sender_sid:input.senderSid,
      twilio_whatsapp_sender:`whatsapp:${input.senderPhoneE164}`,
      waba_id:input.wabaId,
      meta_phone_number_id:input.metaPhoneNumberId||null,
    },
    p_configuration:{
      provider_family:"twilio",
      connection_mode:"twilio_tech_provider",
      runtime_route:"trigger_dev",
      waba_id:input.wabaId,
      meta_phone_number_id:input.metaPhoneNumberId||null,
      twilio_subaccount_sid:input.accountSid,
      twilio_sender_sid:input.senderSid,
      sender_phone_e164:input.senderPhoneE164,
      sender_status:"CREATING",
      maia_active:false,
      configured_at:new Date().toISOString(),
    },
  });
  if(error) throw error;
  return String((data as Json)?.integration_id||"");
}

export async function completeTwilioWhatsAppEmbeddedSignup(input:{
  organizationId:string;
  membershipId:string;
  sessionId:string;
  wabaId:string;
  metaPhoneNumberId?:string|null;
  senderPhoneE164?:string|null;
  senderProfileName?:string|null;
}){
  const admin=createAdminClient();
  const {data:session,error:sessionError}=await admin
    .from("whatsapp_twilio_onboarding_sessions")
    .select("*")
    .eq("id",input.sessionId)
    .eq("organization_id",input.organizationId)
    .eq("membership_id",input.membershipId)
    .maybeSingle();
  if(sessionError) throw sessionError;
  if(!session) throw new Error("WhatsApp onboarding session was not found.");
  if(new Date(session.expires_at).getTime()<Date.now()) throw new Error("WhatsApp onboarding session has expired. Start again.");
  if(["complete","cancelled"].includes(String(session.status))) {
    const binding=await getTwilioWhatsAppBinding(input.organizationId);
    return {duplicate:true,binding};
  }

  const wabaId=String(input.wabaId||session.meta_waba_id||"").trim();
  if(!/^\d{5,30}$/.test(wabaId)) throw new Error("A valid WhatsApp Business Account ID is required.");
  const senderPhone=e164(String(input.senderPhoneE164||session.sender_phone_e164||""));
  const profileName=String(input.senderProfileName||session.sender_profile_name||"").trim().slice(0,256);
  if(!profileName) throw new Error("WhatsApp display name is required.");

  await admin.from("whatsapp_twilio_onboarding_sessions").update({
    status:"embedded_signup_complete",
    meta_waba_id:wabaId,
    meta_phone_number_id:String(input.metaPhoneNumberId||"").trim()||null,
    sender_phone_e164:senderPhone,
    sender_profile_name:profileName,
    updated_at:new Date().toISOString(),
  }).eq("id",session.id).eq("organization_id",input.organizationId);

  const existing=await getTwilioWhatsAppBinding(input.organizationId);
  let subaccountSid=String(existing?.twilio_subaccount_sid||"");
  let subaccountAuthToken="";

  if(subaccountSid){
    const creds=await (admin as any).rpc("get_organization_integration_credentials",{
      p_organization_id:input.organizationId,
      p_provider:"whatsapp",
    });
    const raw=(creds.data||{}) as Json;
    if(String(raw.provider_family||"")==="twilio"&&String(raw.twilio_account_sid||"")===subaccountSid){
      subaccountAuthToken=String(raw.twilio_auth_token||"");
    }
  }

  if(!subaccountSid||!subaccountAuthToken){
    const {data:org,error:orgError}=await admin.from("organizations")
      .select("name,slug")
      .eq("id",input.organizationId)
      .single();
    if(orgError) throw orgError;

    await (admin as any).rpc("upsert_whatsapp_twilio_binding",{
      p_organization_id:input.organizationId,
      p_integration_id:existing?.integration_id||null,
      p_status:"provisioning_subaccount",
      p_meta_waba_id:wabaId,
      p_meta_phone_number_id:String(input.metaPhoneNumberId||"").trim()||null,
      p_sender_phone_e164:senderPhone,
      p_sender_profile_name:profileName,
      p_number_source:session.number_source,
      p_provider_metadata:{onboarding_session_id:session.id},
    });

    const sub=await createTwilioSubaccount(`Fluxknight · ${org.name||org.slug||input.organizationId}`);
    subaccountSid=sub.sid;
    subaccountAuthToken=sub.authToken;
  }

  await admin.from("whatsapp_twilio_onboarding_sessions").update({
    status:"provisioning",updated_at:new Date().toISOString(),
  }).eq("id",session.id).eq("organization_id",input.organizationId);

  const origin=siteOrigin();
  let senderSid=String(existing?.twilio_sender_sid||"");
  let senderStatus=String(existing?.twilio_sender_status||"");

  if(!senderSid){
    await (admin as any).rpc("upsert_whatsapp_twilio_binding",{
      p_organization_id:input.organizationId,
      p_integration_id:existing?.integration_id||null,
      p_status:"registering_sender",
      p_meta_waba_id:wabaId,
      p_meta_phone_number_id:String(input.metaPhoneNumberId||"").trim()||null,
      p_sender_phone_e164:senderPhone,
      p_sender_profile_name:profileName,
      p_number_source:session.number_source,
      p_twilio_subaccount_sid:subaccountSid,
      p_provider_metadata:{onboarding_session_id:session.id},
    });

    const sender=await registerTwilioWhatsAppSender({
      accountSid:subaccountSid,
      authToken:subaccountAuthToken,
      phoneE164:senderPhone,
      wabaId,
      profileName,
      callbackUrl:`${origin}/api/whatsapp/twilio/webhook`,
      fallbackUrl:`${origin}/api/whatsapp/twilio/fallback`,
      statusCallbackUrl:`${origin}/api/whatsapp/twilio/status`,
      numberSource:session.number_source as NumberSource,
    });
    senderSid=sender.sid;
    senderStatus=sender.status||"CREATING";
  }

  const integrationId=await storeTwilioTenantCredentials({
    organizationId:input.organizationId,
    accountSid:subaccountSid,
    authToken:subaccountAuthToken,
    senderSid,
    senderPhoneE164:senderPhone,
    wabaId,
    metaPhoneNumberId:String(input.metaPhoneNumberId||"").trim()||null,
  });

  const bindingStatus=senderStatus==="ONLINE"?"connected":"awaiting_sender_online";
  const {data:binding,error:bindingError}=await (admin as any).rpc("upsert_whatsapp_twilio_binding",{
    p_organization_id:input.organizationId,
    p_integration_id:integrationId||null,
    p_status:bindingStatus,
    p_meta_waba_id:wabaId,
    p_meta_phone_number_id:String(input.metaPhoneNumberId||"").trim()||null,
    p_sender_phone_e164:senderPhone,
    p_sender_profile_name:profileName,
    p_number_source:session.number_source,
    p_twilio_subaccount_sid:subaccountSid,
    p_twilio_sender_sid:senderSid,
    p_twilio_sender_status:senderStatus,
    p_provider_metadata:{onboarding_session_id:session.id},
  });
  if(bindingError) throw bindingError;

  await admin.from("organization_integrations").update({
    status:senderStatus==="ONLINE"?"connected":"configured",
    health:{
      state:senderStatus==="ONLINE"?"ready":"provisioning",
      message:senderStatus==="ONLINE"?"Twilio WhatsApp sender is online.":"Twilio is registering the WhatsApp sender.",
      sender_status:senderStatus,
    },
    last_checked_at:new Date().toISOString(),
    ...(senderStatus==="ONLINE"?{last_connected_at:new Date().toISOString()}:{})
  }).eq("organization_id",input.organizationId).eq("provider","whatsapp");

  await admin.from("whatsapp_twilio_onboarding_sessions").update({
    status:senderStatus==="ONLINE"?"complete":"provisioning",
    completed_at:senderStatus==="ONLINE"?new Date().toISOString():null,
    updated_at:new Date().toISOString(),
  }).eq("id",session.id).eq("organization_id",input.organizationId);

  return {duplicate:false,binding};
}

export async function refreshTwilioWhatsAppBinding(organizationId:string){
  const admin=createAdminClient();
  const binding=await getTwilioWhatsAppBinding(organizationId);
  if(!binding?.twilio_sender_sid||!binding?.twilio_subaccount_sid) return binding;

  const {data:credentials,error}=await (admin as any).rpc("get_organization_integration_credentials",{
    p_organization_id:organizationId,p_provider:"whatsapp",
  });
  if(error) throw error;
  const raw=(credentials||{}) as Json;
  const authToken=String(raw.twilio_auth_token||"");
  if(!authToken) throw new Error("Tenant Twilio subaccount credential is unavailable.");

  const sender=await getTwilioWhatsAppSender({
    accountSid:binding.twilio_subaccount_sid,
    authToken,
    senderSid:binding.twilio_sender_sid,
  });
  const connected=sender.status==="ONLINE";
  const failed=["OFFLINE"].includes(sender.status)&&Array.isArray((sender.properties as any)?.offline_reasons);

  const {data:updated,error:updateError}=await (admin as any).rpc("upsert_whatsapp_twilio_binding",{
    p_organization_id:organizationId,
    p_integration_id:binding.integration_id,
    p_status:connected?"connected":failed?"degraded":"awaiting_sender_online",
    p_meta_waba_id:binding.meta_waba_id,
    p_meta_phone_number_id:binding.meta_phone_number_id,
    p_sender_phone_e164:binding.sender_phone_e164,
    p_sender_profile_name:binding.sender_profile_name,
    p_number_source:binding.number_source,
    p_twilio_subaccount_sid:binding.twilio_subaccount_sid,
    p_twilio_sender_sid:binding.twilio_sender_sid,
    p_twilio_sender_status:sender.status,
    p_last_error_message:failed?JSON.stringify((sender.properties as any)?.offline_reasons||[]):null,
    p_provider_metadata:{last_sender_fetch:new Date().toISOString()},
  });
  if(updateError) throw updateError;

  await admin.from("organization_integrations").update({
    status:connected?"connected":failed?"degraded":"configured",
    health:{
      state:connected?"ready":failed?"degraded":"provisioning",
      message:connected?"Twilio WhatsApp sender is online.":failed?"Twilio WhatsApp sender requires attention.":"Twilio is still registering the WhatsApp sender.",
      sender_status:sender.status,
    },
    last_checked_at:new Date().toISOString(),
    ...(connected?{last_connected_at:new Date().toISOString()}:{})
  }).eq("organization_id",organizationId).eq("provider","whatsapp");

  return updated;
}
