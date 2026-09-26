import { logger, task } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentRuntimeSDK } from "@/lib/ai-runtime/sdk";
import { internalRuntimeIdentity, runPhase12Agent } from "@/lib/ai-runtime/migration";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export type TenantChannelInboundPayload = {
  organizationId: string;
  agentId: string;
  sourceSystemId: string;
  channel: "whatsapp";
  provider: string;
  externalEventId: string;
  externalConversationId?: string;
  customerPhone?: string;
  customerName?: string;
  message: string;
  metadata?: Record<string, unknown>;
};

async function resolveCustomer(payload: TenantChannelInboundPayload) {
  const phone = String(payload.customerPhone || "").replace(/[^0-9]/g, "");
  if (!phone) return null;
  const admin = createAdminClient();

  const byPhone = await admin
    .from("crm_customers")
    .select("id")
    .eq("organization_id", payload.organizationId)
    .eq("phone", phone)
    .limit(1)
    .maybeSingle();
  if (byPhone.error) throw byPhone.error;
  if (byPhone.data) return byPhone.data.id;

  const externalKey = `whatsapp:${phone}`;
  const byKey = await admin
    .from("crm_customers")
    .select("id")
    .eq("organization_id", payload.organizationId)
    .eq("external_key", externalKey)
    .maybeSingle();
  if (byKey.error) throw byKey.error;
  if (byKey.data) return byKey.data.id;

  const created = await admin
    .from("crm_customers")
    .insert({
      organization_id: payload.organizationId,
      external_key: externalKey,
      full_name: String(payload.customerName || "").trim() || "WhatsApp customer",
      phone,
      status: "active",
      profile: { preferred_channel: "whatsapp" },
      metadata: { created_by: "tenant-channel-runtime" },
    })
    .select("id")
    .single();
  if (created.error) throw created.error;
  return created.data.id;
}

async function validateRuntimeBinding(payload: TenantChannelInboundPayload) {
  const admin = createAdminClient();
  const [organization, agent, installation] = await Promise.all([
    admin.from("organizations").select("id,status").eq("id", payload.organizationId).maybeSingle(),
    admin.from("agents").select("id,organization_id,status").eq("organization_id", payload.organizationId).eq("id", payload.agentId).maybeSingle(),
    admin.from("organization_systems").select("id,system_id,status").eq("organization_id", payload.organizationId).eq("id", payload.sourceSystemId).maybeSingle(),
  ]);
  if (organization.error) throw organization.error;
  if (agent.error) throw agent.error;
  if (installation.error) throw installation.error;
  if (!organization.data || organization.data.status !== "active") throw new Error("Tenant organization is not active.");
  if (!agent.data || !["published","active","testing"].includes(String(agent.data.status))) throw new Error("Tenant channel agent is not active.");
  if (!installation.data || installation.data.status !== "active") throw new Error("Tenant channel system is not active.");

  const selection = await admin
    .from("organization_agent_selections")
    .select("id")
    .eq("organization_id", payload.organizationId)
    .eq("system_catalog_id", installation.data.system_id)
    .contains("configuration", { provisioned_agent_id: payload.agentId })
    .in("status", ["selected","paid","provisioning","active"])
    .limit(1)
    .maybeSingle();
  if (selection.error) throw selection.error;
  if (!selection.data) throw new Error("Tenant channel agent is not bound to the source system.");
}

async function claimInbound(payload: TenantChannelInboundPayload, customerId: string | null) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_channel_inbound_event", {
    p_organization_id: payload.organizationId,
    p_agent_id: payload.agentId,
    p_source_system_id: payload.sourceSystemId,
    p_channel: payload.channel,
    p_provider: payload.provider,
    p_external_event_id: payload.externalEventId,
    p_external_conversation_id: payload.externalConversationId || null,
    p_customer_id: customerId,
    p_customer_phone: payload.customerPhone || null,
    p_customer_name: payload.customerName || null,
    p_message: payload.message,
    p_payload: payload.metadata || {},
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) throw new Error("Inbound event could not be claimed.");
  return row as { id:string; status:string; attempts:number };
}

async function completeInbound(organizationId:string,eventId:string) {
  const { error } = await createAdminClient().from("channel_inbound_events").update({
    status:"completed",completed_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString(),
  }).eq("organization_id",organizationId).eq("id",eventId);
  if(error) throw error;
}

async function failInbound(organizationId:string,eventId:string,errorMessage:string) {
  await createAdminClient().from("channel_inbound_events").update({
    status:"failed",last_error:errorMessage.slice(0,2000),updated_at:new Date().toISOString(),
  }).eq("organization_id",organizationId).eq("id",eventId);
}

export const tenantWhatsAppInbound = task({
  id: "tenant-whatsapp-process-inbound-message",
  maxDuration: 300,
  retry: { maxAttempts: 3, minTimeoutInMs: 2_000, maxTimeoutInMs: 20_000, factor: 2 },
  run: async (payload: TenantChannelInboundPayload) => {
    await validateRuntimeBinding(payload);
    const customerId = await resolveCustomer(payload);
    const inbound = await claimInbound(payload, customerId);
    if (inbound.status === "completed") {
      return { ok:true, duplicate:true, inboundEventId:inbound.id };
    }

    try {
      const sdk = new AgentRuntimeSDK();
      const identity = internalRuntimeIdentity(payload.organizationId, "whatsapp");
      const result = await runPhase12Agent({
        kind:"specialist",
        organizationId:payload.organizationId,
        agentId:payload.agentId,
        channel:"whatsapp",
        externalConversationId:payload.externalConversationId,
        objective:payload.message,
        identity,
        sdk,
        metadata:{
          source:"tenant-whatsapp-trigger",
          sourceSystemId:payload.sourceSystemId,
          inboundEventId:inbound.id,
          customerId,
          customerPhone:payload.customerPhone || null,
        },
      });

      const executedTools = [];
      for (const call of result.toolCalls) {
        if (!call.toolKey.startsWith("flux.system.") || call.approval !== "none") continue;
        const execution = await sdk.executeTool({
          identity,
          executionId:result.executionId,
          organizationId:payload.organizationId,
          agentId:payload.agentId,
          sessionId:result.sessionId,
          toolKey:call.toolKey,
          arguments:{
            ...call.arguments,
            customer_id:customerId,
            correlation_id:inbound.id,
            customer_phone:payload.customerPhone || null,
            customer_name:payload.customerName || null,
          },
        });
        executedTools.push(execution);
      }

      if (payload.customerPhone && result.reply.trim()) {
        await sendWhatsAppMessage({
          organizationId:payload.organizationId,
          to:payload.customerPhone,
          text:result.reply,
          deliveryMode:"direct",
          lastCustomerMessageAt:new Date().toISOString(),
        });
      }

      await completeInbound(payload.organizationId,inbound.id);
      logger.info("Tenant WhatsApp runtime completed",{
        organizationId:payload.organizationId,
        agentId:payload.agentId,
        inboundEventId:inbound.id,
        runtimeExecutionId:result.executionId,
        proposedTools:result.toolCalls.length,
        executedTools:executedTools.length,
      });
      return {
        ok:true,duplicate:false,inboundEventId:inbound.id,runtimeExecutionId:result.executionId,
        sessionId:result.sessionId || null,executedTools,
      };
    } catch(error) {
      const message=error instanceof Error?error.message:"Tenant WhatsApp runtime failed.";
      await failInbound(payload.organizationId,inbound.id,message).catch(()=>undefined);
      throw error;
    }
  },
});
