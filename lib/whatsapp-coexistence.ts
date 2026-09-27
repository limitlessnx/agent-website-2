import { createAdminClient } from "@/lib/supabase/admin";
import { addCanonicalCrmMessage, getOrCreateCanonicalConversation, resolveCanonicalCustomer } from "@/lib/canonical-customer";

function cleanPhone(value: unknown) {
  return String(value || "").replace(/[^0-9]/g, "");
}

export async function recordWhatsAppBusinessAppEcho(input:{
  organizationId:string;
  sourceSystemId:string;
  agentId:string;
  customerPhone:string;
  messageId:string;
  text:string;
  phoneNumberId:string;
  timestamp?:string|null;
}) {
  const phone=cleanPhone(input.customerPhone);
  if(!phone) throw new Error("Coexistence echo has no customer phone.");
  const customer=await resolveCanonicalCustomer({
    organizationId:input.organizationId,
    phone,
    externalKey:`whatsapp:${phone}`,
    fullName:"WhatsApp customer",
    source:"whatsapp_coexistence",
  });
  const conversationId=await getOrCreateCanonicalConversation({
    organizationId:input.organizationId,
    customerId:customer.customerId,
    channel:"whatsapp",
    externalThreadId:phone,
    agentId:input.agentId,
    metadata:{
      source_system_id:input.sourceSystemId,
      provider:"meta_whatsapp",
      coexistence:true,
    },
  });

  await addCanonicalCrmMessage({
    organizationId:input.organizationId,
    conversationId,
    senderType:"human",
    direction:"outbound",
    content:input.text,
    externalMessageId:`whatsapp-business-app:${input.messageId}`,
    status:"sent",
    metadata:{
      provider:"meta_whatsapp",
      origin:"whatsapp_business_app",
      phone_number_id:input.phoneNumberId,
      provider_message_id:input.messageId,
      provider_timestamp:input.timestamp||null,
    },
  });

  const admin=createAdminClient();
  const {data:active,error:activeError}=await admin.from("human_handoffs")
    .select("id,assigned_membership_id,status")
    .eq("organization_id",input.organizationId)
    .eq("conversation_id",conversationId)
    .in("status",["open","assigned","in_progress","waiting_customer"])
    .order("created_at",{ascending:false})
    .limit(1)
    .maybeSingle();
  if(activeError) throw activeError;

  let handoffId=active?.id ? String(active.id) : "";
  if(!handoffId){
    const {data,error}=await (admin as any).rpc("create_human_handoff",{
      p_organization_id:input.organizationId,
      p_customer_id:customer.customerId,
      p_conversation_id:conversationId,
      p_reason:"Human replied from the WhatsApp Business App",
      p_category:"manual_whatsapp_takeover",
      p_priority:"normal",
      p_source_system_id:input.sourceSystemId,
      p_source_agent_id:input.agentId,
      p_correlation_id:null,
      p_sla_due_at:null,
      p_created_by_type:"human",
      p_created_by_id:"whatsapp_business_app",
      p_metadata:{
        source:"whatsapp_coexistence",
        source_echo_id:input.messageId,
      },
    });
    if(error) throw error;
    handoffId=String(data);
  }

  const now=new Date().toISOString();
  await admin.from("human_handoffs").update({
    status:"in_progress",
    claimed_at:active?.status==="in_progress" ? undefined : now,
    updated_at:now,
    metadata:{
      source:"whatsapp_coexistence",
      last_business_app_echo_id:input.messageId,
      last_business_app_echo_at:now,
    },
  }).eq("organization_id",input.organizationId).eq("id",handoffId);

  const {data:conversation,error:conversationError}=await admin.from("crm_conversations")
    .select("metadata")
    .eq("organization_id",input.organizationId)
    .eq("id",conversationId)
    .maybeSingle();
  if(conversationError) throw conversationError;
  await admin.from("crm_conversations").update({
    status:"human_active",
    metadata:{
      ...((conversation?.metadata||{}) as Record<string,unknown>),
      active_handoff_id:handoffId,
      ai_response_mode:"human_takeover",
      human_takeover_source:"whatsapp_business_app",
      last_human_message_at:now,
    },
    updated_at:now,
  }).eq("organization_id",input.organizationId).eq("id",conversationId);

  return {
    customerId:customer.customerId,
    conversationId,
    handoffId,
    humanTakeover:true,
  };
}
