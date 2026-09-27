import { createAdminClient } from "@/lib/supabase/admin";

function clean(value: unknown, max=500) {
  return typeof value === "string" ? value.trim().slice(0,max) : "";
}

export async function getFluxknightPlatformOrganizationId() {
  const admin=createAdminClient();
  const {data,error}=await admin.from("organizations").select("id").eq("slug","fluxknight").eq("status","active").maybeSingle();
  if(error) throw error;
  if(!data?.id) throw new Error("Fluxknight platform organization is unavailable.");
  return String(data.id);
}

export async function resolveCanonicalCustomer(input:{
  organizationId:string;
  email?:unknown;
  phone?:unknown;
  externalKey?:unknown;
  fullName?:unknown;
  companyName?:unknown;
  source:string;
}) {
  const admin=createAdminClient() as any;
  const {data,error}=await admin.rpc("resolve_crm_customer",{
    p_organization_id:input.organizationId,
    p_email:clean(input.email,240)||null,
    p_phone:clean(input.phone,80)||null,
    p_external_key:clean(input.externalKey,240)||null,
    p_full_name:clean(input.fullName,180)||null,
    p_company_name:clean(input.companyName,180)||null,
    p_source:input.source,
  });
  if(error) throw error;
  if(data?.status==="conflict") {
    throw new Error(`Customer identity requires review: ${String(data.conflict_id||"unknown")}`);
  }
  const customerId=String(data?.customer_id||"");
  if(!customerId) throw new Error("Canonical customer resolution returned no customer.");
  return {customerId,status:String(data.status||"matched")};
}

export async function getOrCreateCanonicalConversation(input:{
  organizationId:string;
  customerId:string;
  channel:"whatsapp"|"email"|"web"|"telegram"|"voice"|"sms"|"internal";
  externalThreadId?:string|null;
  agentId?:string|null;
  metadata?:Record<string,unknown>;
}) {
  const admin=createAdminClient() as any;
  const {data,error}=await admin.rpc("get_or_create_crm_conversation",{
    p_organization_id:input.organizationId,
    p_customer_id:input.customerId,
    p_channel:input.channel,
    p_external_thread_id:input.externalThreadId||null,
    p_agent_id:input.agentId||null,
    p_metadata:input.metadata||{},
  });
  if(error) throw error;
  return String(data);
}

export async function addCanonicalCrmMessage(input:{
  organizationId:string;
  conversationId:string;
  senderType:"customer"|"agent"|"human"|"system"|"tool";
  direction:"inbound"|"outbound"|"internal";
  content:string;
  externalMessageId?:string|null;
  status?:"received"|"queued"|"sent"|"delivered"|"read"|"failed";
  metadata?:Record<string,unknown>;
}) {
  const admin=createAdminClient();
  if(input.externalMessageId) {
    const {data:existing,error:lookupError}=await admin.from("crm_messages").select("id")
      .eq("organization_id",input.organizationId)
      .eq("external_message_id",input.externalMessageId).limit(1).maybeSingle();
    if(lookupError) throw lookupError;
    if(existing?.id) return String(existing.id);
  }
  const {data,error}=await admin.from("crm_messages").insert({
    organization_id:input.organizationId,
    conversation_id:input.conversationId,
    sender_type:input.senderType,
    direction:input.direction,
    content_type:"text",
    content:input.content.slice(0,8000),
    external_message_id:input.externalMessageId||null,
    status:input.status|| (input.direction==="inbound"?"received":"sent"),
    metadata:input.metadata||{},
  }).select("id").single();
  if(error) throw error;
  return String(data.id);
}

export async function canonicalizePublicLeoLead(input:{
  leadId:string;
  sessionId:string;
  fullName?:unknown;
  email?:unknown;
  phone?:unknown;
  companyName?:unknown;
}) {
  const organizationId=await getFluxknightPlatformOrganizationId();
  const {customerId}=await resolveCanonicalCustomer({
    organizationId,
    email:input.email,
    phone:input.phone,
    externalKey:`public-leo:${input.sessionId}`,
    fullName:input.fullName,
    companyName:input.companyName,
    source:"public_leo",
  });
  const conversationId=await getOrCreateCanonicalConversation({
    organizationId,customerId,channel:"web",externalThreadId:`public-leo:${input.sessionId}`,
    metadata:{source:"public_leo",public_lead_id:input.leadId},
  });
  const admin=createAdminClient();
  const {error}=await admin.from("leo_public_leads").update({
    organization_id:organizationId,customer_id:customerId,conversation_id:conversationId,updated_at:new Date().toISOString()
  }).eq("id",input.leadId);
  if(error) throw error;
  return {organizationId,customerId,conversationId};
}

export async function syncPublicLeoMessage(input:{
  sessionId:string;
  role:"user"|"assistant";
  content:string;
  externalMessageId:string;
}) {
  const admin=createAdminClient();
  const {data:lead,error}=await admin.from("leo_public_leads")
    .select("organization_id,customer_id,conversation_id").eq("session_id",input.sessionId).maybeSingle();
  if(error) throw error;
  if(!lead?.organization_id||!lead.customer_id||!lead.conversation_id) return null;
  return addCanonicalCrmMessage({
    organizationId:String(lead.organization_id),
    conversationId:String(lead.conversation_id),
    senderType:input.role==="user"?"customer":"agent",
    direction:input.role==="user"?"inbound":"outbound",
    content:input.content,
    externalMessageId:input.externalMessageId,
    metadata:{source:"public_leo",session_id:input.sessionId},
  });
}

export async function canonicalizeEvaluationLead(input:{
  evaluationId:string;
  fullName:string;
  email:string;
  phone:string;
  companyName:string;
}) {
  const organizationId=await getFluxknightPlatformOrganizationId();
  const {customerId}=await resolveCanonicalCustomer({
    organizationId,email:input.email,phone:input.phone,
    externalKey:`evaluation:${input.evaluationId}`,fullName:input.fullName,
    companyName:input.companyName,source:"website_evaluation",
  });
  const conversationId=await getOrCreateCanonicalConversation({
    organizationId,customerId,channel:"web",externalThreadId:`evaluation:${input.evaluationId}`,
    metadata:{source:"website_evaluation",evaluation_id:input.evaluationId},
  });
  const admin=createAdminClient();
  const {error}=await admin.from("evaluation_leads").update({
    organization_id:organizationId,customer_id:customerId,conversation_id:conversationId,updated_at:new Date().toISOString()
  }).eq("id",input.evaluationId);
  if(error) throw error;
  return {organizationId,customerId,conversationId};
}
