import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { addCanonicalCrmMessage } from "@/lib/canonical-customer";
import { preflightChargeableFluxAi, recordChargeableFluxAiUsage } from "@/lib/flux-ai-metering-core";

function rec(value:unknown):Record<string,unknown>{
  return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
}
function str(value:unknown){return typeof value==="string"?value.trim():"";}

async function temporaryD4TestOrganization(organizationId:string){
  const {data,error}=await createAdminClient().from("organizations").select("metadata").eq("id",organizationId).maybeSingle();
  if(error) throw error;
  return rec(data?.metadata).temporary_d4_test===true;
}

export async function processDueHandoffFollowups(limit=100){
  const admin=createAdminClient();
  const now=new Date().toISOString();
  const {data:tasks,error}=await admin.from("crm_tasks")
    .select("id,organization_id,customer_id,due_at,metadata")
    .eq("task_type","handoff_follow_up")
    .eq("status","scheduled")
    .lte("due_at",now)
    .order("due_at",{ascending:true})
    .limit(Math.max(1,Math.min(250,limit)));
  if(error) throw error;

  const results:Array<Record<string,unknown>>=[];

  for(const task of tasks||[]){
    const metadata=rec(task.metadata);
    const handoffId=str(metadata.handoff_id);
    const conversationId=str(metadata.conversation_id);
    if(!task.customer_id||!handoffId||!conversationId){
      await admin.from("crm_tasks").update({
        status:"failed",updated_at:new Date().toISOString(),
        metadata:{...metadata,follow_up_error:"missing_required_context"},
      }).eq("organization_id",task.organization_id).eq("id",task.id);
      results.push({taskId:task.id,status:"failed",reason:"missing_required_context"});
      continue;
    }

    try{
      const [{data:customer,error:customerError},{data:conversation,error:conversationError},{data:lastInbound,error:lastInboundError}]=await Promise.all([
        admin.from("crm_customers").select("full_name,company_name,phone").eq("organization_id",task.organization_id).eq("id",task.customer_id).maybeSingle(),
        admin.from("crm_conversations").select("id,channel,status,metadata").eq("organization_id",task.organization_id).eq("id",conversationId).maybeSingle(),
        admin.from("crm_messages").select("created_at").eq("organization_id",task.organization_id).eq("conversation_id",conversationId).eq("direction","inbound").order("created_at",{ascending:false}).limit(1).maybeSingle(),
      ]);
      if(customerError) throw customerError;
      if(conversationError) throw conversationError;
      if(lastInboundError) throw lastInboundError;
      if(!customer?.phone) throw new Error("Customer has no WhatsApp phone number.");
      if(conversation?.channel!=="whatsapp") throw new Error("Post-handoff WhatsApp check-in requires a WhatsApp conversation.");

      const customerName=String(customer.full_name||customer.company_name||"there");
      const simulated=await temporaryD4TestOrganization(task.organization_id);
      if(!simulated){
        await preflightChargeableFluxAi({
          organizationId:task.organization_id,
          feature:"follow_ups",
          action:"whatsapp_follow_up_reminder",
        });
      }
      const text="Hi "+customerName+", just checking in after our team member assisted you. Was everything resolved, or do you still need help?";
      const delivery=simulated
        ? {
            ok:true,
            messageType:"text" as const,
            templateName:null,
            providerMessageId:"test-handoff-followup:"+task.id,
          }
        : await sendWhatsAppMessage({
            organizationId:task.organization_id,
            to:customer.phone,
            text,
            lastCustomerMessageAt:lastInbound?.created_at||null,
            deliveryMode:"auto",
            templatePurpose:"handoff_follow_up",
            variables:{
              customer_name:customerName,
              handoff_id:handoffId,
            },
          });

      await addCanonicalCrmMessage({
        organizationId:task.organization_id,
        conversationId,
        senderType:"agent",
        direction:"outbound",
        content:text,
        externalMessageId:delivery.providerMessageId||"handoff-followup:"+task.id,
        status:delivery.providerMessageId?"sent":"queued",
        metadata:{
          source:"handoff_follow_up",
          handoff_id:handoffId,
          task_id:task.id,
          message_type:delivery.messageType,
          template_name:delivery.templateName||null,
        },
      });

      if(!simulated){
        await recordChargeableFluxAiUsage({
          organizationId:task.organization_id,
          action:"whatsapp_follow_up_reminder",
          source:"handoff_follow_up",
          provider:"meta",
          metadata:{handoff_id:handoffId,task_id:task.id,conversation_id:conversationId},
        });
      }

      await admin.from("crm_tasks").update({
        status:"completed",
        completed_at:new Date().toISOString(),
        updated_at:new Date().toISOString(),
        metadata:{...metadata,follow_up_sent_at:new Date().toISOString(),provider_message_id:delivery.providerMessageId||null},
      }).eq("organization_id",task.organization_id).eq("id",task.id);

      await admin.from("human_handoffs").update({
        follow_up_status:"completed",
        updated_at:new Date().toISOString(),
      }).eq("organization_id",task.organization_id).eq("id",handoffId);

      results.push({taskId:task.id,status:"completed",handoffId,messageType:delivery.messageType});
    }catch(error){
      const message=error instanceof Error?error.message:"Handoff follow-up failed.";
      await admin.from("crm_tasks").update({
        status:"failed",updated_at:new Date().toISOString(),
        metadata:{...metadata,follow_up_error:message.slice(0,2000)},
      }).eq("organization_id",task.organization_id).eq("id",task.id);
      try {
        await admin.from("human_handoffs").update({
          follow_up_status:"failed",
          updated_at:new Date().toISOString(),
        }).eq("organization_id",task.organization_id).eq("id",handoffId);
      } catch {
        // Preserve the original follow-up failure.
      }
      results.push({taskId:task.id,status:"failed",handoffId,reason:message});
    }
  }

  return {checked:tasks?.length||0,results};
}
