import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { addCanonicalCrmMessage } from "@/lib/canonical-customer";

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
  const session=await getClientSession();
  if(!session) return NextResponse.json({error:"Unauthorized"},{status:401});
  const access=await getOrganizationAccessContext(session.organizationId,session.userId);
  try{assertAnyOrganizationPermission(access,["conversations.reply"]);}catch{
    return NextResponse.json({error:"conversations.reply required"},{status:403});
  }

  const {id}=await params;
  const body=await req.json().catch(()=>({})) as Record<string,unknown>;
  const message=String(body.message||"").trim();
  if(!message) return NextResponse.json({error:"Message is required"},{status:400});

  const admin=createAdminClient();
  const {data:conversation,error:conversationError}=await admin.from("crm_conversations")
    .select("id,customer_id,channel,status,metadata")
    .eq("organization_id",session.organizationId).eq("id",id).maybeSingle();
  if(conversationError) return NextResponse.json({error:conversationError.message},{status:400});
  if(!conversation) return NextResponse.json({error:"Conversation not found"},{status:404});
  if(conversation.channel!=="whatsapp") return NextResponse.json({error:"Human send is currently implemented for WhatsApp conversations only"},{status:400});

  const {data:customer,error:customerError}=await admin.from("crm_customers")
    .select("id,phone,full_name,company_name").eq("organization_id",session.organizationId).eq("id",conversation.customer_id).maybeSingle();
  if(customerError) return NextResponse.json({error:customerError.message},{status:400});
  if(!customer?.phone) return NextResponse.json({error:"Customer has no WhatsApp phone number"},{status:400});

  const {data:lastInbound,error:lastInboundError}=await admin.from("crm_messages")
    .select("created_at").eq("organization_id",session.organizationId).eq("conversation_id",id)
    .eq("direction","inbound").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(lastInboundError) return NextResponse.json({error:lastInboundError.message},{status:400});

  try{
    const delivery=await sendWhatsAppMessage({
      organizationId:session.organizationId,
      to:customer.phone,
      text:message,
      lastCustomerMessageAt:lastInbound?.created_at||null,
      deliveryMode:"auto",
      templatePurpose:"human_reply_outside_24h",
      variables:{
        customer_name:String(customer.full_name||customer.company_name||"Customer"),
        message,
      },
    });

    await addCanonicalCrmMessage({
      organizationId:session.organizationId,
      conversationId:id,
      senderType:"human",
      direction:"outbound",
      content:message,
      externalMessageId:delivery.providerMessageId||"human-dashboard:"+crypto.randomUUID(),
      status:delivery.providerMessageId?"sent":"queued",
      metadata:{
        source:"fluxknight_dashboard",
        membership_id:access.membershipId,
        message_type:delivery.messageType,
        template_name:delivery.templateName||null,
      },
    });

    const {data:active}=await admin.from("human_handoffs")
      .select("id,assigned_membership_id,claimed_by_membership_id,status")
      .eq("organization_id",session.organizationId)
      .eq("conversation_id",id)
      .in("status",["open","assigned","in_progress","waiting_customer"])
      .order("created_at",{ascending:false}).limit(1).maybeSingle();

    if(active){
      await admin.from("human_handoffs").update({
        assigned_membership_id:active.assigned_membership_id||access.membershipId,
        claimed_by_membership_id:access.membershipId,
        status:"in_progress",
        claimed_at:new Date().toISOString(),
        updated_at:new Date().toISOString(),
      }).eq("organization_id",session.organizationId).eq("id",active.id);
    }

    const metadata={...((conversation.metadata||{}) as Record<string,unknown>)};
    await admin.from("crm_conversations").update({
      status:"human_active",
      metadata:{
        ...metadata,
        ...(active?.id?{active_handoff_id:active.id}:{}),
        ai_response_mode:"human_takeover",
        human_takeover_source:"fluxknight_dashboard",
        last_human_message_at:new Date().toISOString(),
      },
      updated_at:new Date().toISOString(),
    }).eq("organization_id",session.organizationId).eq("id",id);

    return NextResponse.json({
      ok:true,
      messageType:delivery.messageType,
      providerMessageId:delivery.providerMessageId||null,
      humanTakeover:true,
    });
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"WhatsApp send failed"},{status:400});
  }
}
