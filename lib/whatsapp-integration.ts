import { createAdminClient } from "@/lib/supabase/admin";
import { getTwilioWhatsAppBinding, refreshTwilioWhatsAppBinding } from "@/lib/twilio-whatsapp-onboarding";

type Json = Record<string, unknown>;

export type WhatsAppReadiness = {
  organizationId: string;
  configured: boolean;
  credentialSource: "tenant_vault" | "legacy_env" | "none";
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  accountStatus: string | null;
  coexistenceActive: boolean;
  platformType: string | null;
  webhookSecretConfigured: boolean;
  verifyTokenConfigured: boolean;
  triggerRuntimeConfigured: boolean;
  readyForCutover: boolean;
  checks: Array<{ key: string; ok: boolean; detail: string }>;
};

export async function getWhatsAppIntegration(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_integrations")
    .select("id,organization_id,provider,status,display_name,configuration,health,last_checked_at,last_connected_at")
    .eq("organization_id", organizationId)
    .in("provider", ["whatsapp", "meta_whatsapp"])
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getWhatsAppCredentials(organizationId: string) {
  const admin = createAdminClient() as any;
  for (const provider of ["whatsapp", "meta_whatsapp"]) {
    const { data, error } = await admin.rpc("get_organization_integration_credentials", {
      p_organization_id: organizationId,
      p_provider: provider,
    });
    if (!error && data && typeof data === "object") return data as Json;
  }
  return null;
}

export async function saveWhatsAppCredentials(input: {
  organizationId: string;
  phoneNumberId: string;
  accessToken: string;
  wabaId?: string;
  graphVersion?: string;
}) {
  const admin = createAdminClient() as any;
  const existing = await getWhatsAppIntegration(input.organizationId);
  const configuration = (existing?.configuration || {}) as Json;
  const graphVersion = input.graphVersion || String(configuration.graph_version || "v23.0");
  const { error } = await admin.rpc("store_organization_integration_credentials", {
    p_organization_id: input.organizationId,
    p_provider: "whatsapp",
    p_display_name: "WhatsApp",
    p_credentials: {
      phone_number_id: input.phoneNumberId,
      access_token: input.accessToken,
      waba_id: input.wabaId || null,
      graph_version: graphVersion,
    },
    p_configuration: {
      ...configuration,
      phone_number_id: input.phoneNumberId,
      waba_id: input.wabaId || null,
      graph_version: graphVersion,
      runtime_route: "trigger_dev",
      configured_at: new Date().toISOString(),
    },
  });
  if (error) throw error;
}

async function verifyMetaPhoneNumber(credentials: Json) {
  const phoneNumberId = String(credentials.phone_number_id || credentials.phoneNumberId || "");
  const accessToken = String(credentials.access_token || credentials.accessToken || "");
  const graphVersion = String(credentials.graph_version || "v23.0");
  if (!phoneNumberId || !accessToken) throw new Error("WhatsApp phone number ID or access token is missing.");
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}`);
  url.searchParams.set("fields", "display_phone_number,verified_name,quality_rating,status,is_on_biz_app,platform_type");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as Json;
  if (!response.ok) {
    const error = body.error as Json | undefined;
    throw new Error(String(error?.message || `Meta returned ${response.status}`));
  }
  return body;
}

export async function checkWhatsAppReadiness(organizationId: string): Promise<WhatsAppReadiness> {
  const admin = createAdminClient();
  const integration = await getWhatsAppIntegration(organizationId);
  let credentials = await getWhatsAppCredentials(organizationId);
  let credentialSource: WhatsAppReadiness["credentialSource"] = credentials ? "tenant_vault" : "none";
  const config=(integration?.configuration||{}) as Json;
  const providerFamily=String(credentials?.provider_family||config.provider_family||"meta");

  if(providerFamily==="twilio"){
    let binding=await getTwilioWhatsAppBinding(organizationId);
    if(binding&&["awaiting_sender_online","registering_sender","provisioning_subaccount"].includes(String(binding.status))){
      try{binding=await refreshTwilioWhatsAppBinding(organizationId);}catch{}
    }
    const accountSid=String(credentials?.twilio_account_sid||"");
    const authToken=String(credentials?.twilio_auth_token||"");
    const sender=String(credentials?.twilio_whatsapp_sender||binding?.sender_phone_e164||"");
    const online=String(binding?.twilio_sender_status||"")==="ONLINE"||String(binding?.status||"")==="connected";
    const triggerRuntimeConfigured=String(config.runtime_route||"trigger_dev")==="trigger_dev";
    const checks=[
      {key:"credentials",ok:Boolean(accountSid&&authToken&&sender),detail:accountSid&&authToken&&sender?"Tenant Twilio subaccount credentials are stored in Vault.":"Tenant Twilio subaccount credentials are incomplete."},
      {key:"meta_phone",ok:online,detail:online?"Twilio WhatsApp sender is ONLINE.":`Twilio sender status: ${binding?.twilio_sender_status||binding?.status||"pending"}.`},
      {key:"webhook_signature",ok:Boolean(authToken),detail:authToken?"Twilio webhooks are validated with the tenant subaccount Auth Token.":"Twilio webhook signature credential is unavailable."},
      {key:"verify_token",ok:true,detail:"Twilio signed webhooks do not require a Meta webhook verify token."},
      {key:"trigger_runtime",ok:triggerRuntimeConfigured,detail:triggerRuntimeConfigured?"Trigger.dev is the configured runtime route.":"Trigger.dev is not selected as the runtime route."},
      {key:"coexistence",ok:true,detail:"Twilio sender mode is active; Meta Business App coexistence is not used on this route."},
    ];
    const readyForCutover=checks.every((check)=>check.ok);
    const health={status:readyForCutover?"healthy":"attention_required",ready_for_cutover:readyForCutover,credential_source:credentialSource,provider_family:"twilio",checks,sender_status:binding?.twilio_sender_status||null};
    if(integration?.id){
      try{
        await admin.from("organization_integrations").update({
          health,last_checked_at:new Date().toISOString(),
          status:readyForCutover?"connected":integration.status,
          ...(readyForCutover?{last_connected_at:new Date().toISOString()}:{})
        }).eq("id",integration.id);
      }catch{
        // Readiness reporting remains available even if health persistence fails.
      }
    }
    return {
      organizationId,configured:Boolean(accountSid&&authToken&&sender),credentialSource,
      phoneNumberId:String(binding?.meta_phone_number_id||"")||null,
      displayPhoneNumber:String(binding?.sender_phone_e164||sender).replace(/^whatsapp:/,"")||null,
      verifiedName:String(binding?.sender_profile_name||"")||null,
      qualityRating:null,
      accountStatus:String(binding?.twilio_sender_status||binding?.status||"")||null,
      coexistenceActive:false,
      platformType:"twilio",
      webhookSecretConfigured:Boolean(authToken),
      verifyTokenConfigured:true,
      triggerRuntimeConfigured,
      readyForCutover,
      checks,
    };
  }

  if (!credentials) {
    const { data: org } = await admin.from("organizations").select("slug").eq("id", organizationId).maybeSingle();
    if (org?.slug === "limitless-realty") {
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
      const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || "";
      if (phoneNumberId && accessToken) {
        credentials = { phone_number_id:phoneNumberId,access_token:accessToken,graph_version:process.env.WHATSAPP_GRAPH_VERSION||"v23.0" };
        credentialSource="legacy_env";
      }
    }
  }

  const appSecretConfigured=Boolean(process.env.WHATSAPP_APP_SECRET||process.env.META_WHATSAPP_APP_SECRET||process.env.META_APP_SECRET);
  const verifyTokenConfigured=Boolean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN||process.env.META_WHATSAPP_VERIFY_TOKEN);
  const triggerRuntimeConfigured=String(config.runtime_route||"trigger_dev")==="trigger_dev";
  let meta:Json|null=null;
  let metaError="";
  if(credentials){try{meta=await verifyMetaPhoneNumber(credentials);}catch(error){metaError=error instanceof Error?error.message:"Meta verification failed.";}}
  const phoneNumberId=credentials?String(credentials.phone_number_id||credentials.phoneNumberId||""):"";
  const checks=[
    {key:"credentials",ok:Boolean(phoneNumberId&&credentials?.access_token),detail:credentialSource==="tenant_vault"?"Tenant-scoped credentials found in Vault.":credentialSource==="legacy_env"?"Using legacy Limitless Realty environment credentials.":"Credentials are missing."},
    {key:"meta_phone",ok:Boolean(meta),detail:meta?"Meta accepted the configured phone number credentials.":metaError||"Meta phone verification has not passed."},
    {key:"webhook_signature",ok:appSecretConfigured,detail:appSecretConfigured?"Webhook app secret is configured.":"Webhook app secret is missing."},
    {key:"verify_token",ok:verifyTokenConfigured,detail:verifyTokenConfigured?"Webhook verify token is configured.":"Webhook verify token is missing."},
    {key:"trigger_runtime",ok:triggerRuntimeConfigured,detail:triggerRuntimeConfigured?"Trigger.dev is the configured runtime route.":"Trigger.dev is not selected as the runtime route."},
    {key:"coexistence",ok:true,detail:meta?.is_on_biz_app===true?"WhatsApp Business App + Cloud API coexistence is active.":"Cloud API mode detected; Business App coexistence is not active."},
  ];
  const readyForCutover=checks.every((check)=>check.ok);
  const health={status:readyForCutover?"healthy":"attention_required",ready_for_cutover:readyForCutover,credential_source:credentialSource,checks,meta_phone:meta||null};
  if(integration?.id){
    try{await admin.from("organization_integrations").update({health,last_checked_at:new Date().toISOString(),status:readyForCutover?"connected":integration.status,...(readyForCutover?{last_connected_at:new Date().toISOString()}: {})}).eq("id",integration.id);}catch{}
  }
  return {
    organizationId,configured:Boolean(credentials),credentialSource,phoneNumberId:phoneNumberId||null,
    displayPhoneNumber:meta?.display_phone_number?String(meta.display_phone_number):null,
    verifiedName:meta?.verified_name?String(meta.verified_name):null,
    qualityRating:meta?.quality_rating?String(meta.quality_rating):null,
    accountStatus:meta?.status?String(meta.status):null,
    coexistenceActive:meta?.is_on_biz_app===true,
    platformType:meta?.platform_type?String(meta.platform_type):null,
    webhookSecretConfigured:appSecretConfigured,verifyTokenConfigured,triggerRuntimeConfigured,readyForCutover,checks,
  };
}
