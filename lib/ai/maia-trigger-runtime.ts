import { createAdminClient } from "@/lib/supabase/admin";

export type MaiaInboundPayload = {
  organizationId: string;
  agentId: string;
  channel: string;
  provider?: string;
  externalEventId: string;
  externalConversationId?: string;
  customerPhone?: string;
  customerName?: string;
  message: string;
  metadata?: Record<string, unknown>;
};

type InboundEventRow = {
  id: string;
  status: string;
  attempts: number;
};

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);

export async function validateMaiaTenantContext(payload: MaiaInboundPayload) {
  const admin = createAdminClient();
  const [{ data: organization, error: organizationError }, { data: agent, error: agentError }] = await Promise.all([
    admin.from("organizations").select("id,name,slug,status").eq("id", payload.organizationId).maybeSingle(),
    admin.from("agents").select("id,organization_id,name,slug,status,agent_type,communication_channels,configuration").eq("id", payload.agentId).eq("organization_id", payload.organizationId).maybeSingle(),
  ]);

  if (organizationError) throw organizationError;
  if (agentError) throw agentError;
  if (!organization || organization.status !== "active") throw new Error("Maia tenant organization is not active.");
  if (!agent) throw new Error("Maia agent is not assigned to this organization.");
  if (!["published", "active"].includes(String(agent.status || "").toLowerCase())) {
    throw new Error("Maia agent is not active.");
  }

  return { organization, agent };
}

export async function registerMaiaInboundEvent(payload: MaiaInboundPayload) {
  const admin = createAdminClient();
  const provider = clean(payload.provider || "unknown", 80);
  const channel = clean(payload.channel, 80);
  const externalEventId = clean(payload.externalEventId, 240);

  if (!payload.organizationId || !payload.agentId) throw new Error("organizationId and agentId are required.");
  if (!channel) throw new Error("channel is required.");
  if (!externalEventId) throw new Error("externalEventId is required.");
  if (!clean(payload.message, 20000)) throw new Error("message is required.");

  const match = () => admin
    .from("maia_inbound_events")
    .select("id,status,attempts")
    .eq("organization_id", payload.organizationId)
    .eq("agent_id", payload.agentId)
    .eq("channel", channel)
    .eq("provider", provider)
    .eq("external_event_id", externalEventId)
    .maybeSingle();

  const existing = await match();
  if (existing.error) throw existing.error;
  if (existing.data?.status === "completed") {
    return { event: existing.data as InboundEventRow, duplicate: true };
  }

  if (existing.data) {
    const { data, error } = await admin
      .from("maia_inbound_events")
      .update({
        status: "processing",
        attempts: Number(existing.data.attempts || 0) + 1,
        processing_started_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.data.id)
      .select("id,status,attempts")
      .single();
    if (error) throw error;
    return { event: data as InboundEventRow, duplicate: false };
  }

  const { data, error } = await admin
    .from("maia_inbound_events")
    .insert({
      organization_id: payload.organizationId,
      agent_id: payload.agentId,
      channel,
      provider,
      external_event_id: externalEventId,
      external_conversation_id: clean(payload.externalConversationId, 300) || null,
      customer_phone: clean(payload.customerPhone, 80) || null,
      customer_name: clean(payload.customerName, 180) || null,
      message: clean(payload.message, 20000),
      payload: payload.metadata || {},
      status: "processing",
      attempts: 1,
      processing_started_at: new Date().toISOString(),
    })
    .select("id,status,attempts")
    .single();

  if (error?.code === "23505") {
    const raced = await match();
    if (raced.error) throw raced.error;
    if (!raced.data) throw error;
    if (raced.data.status === "completed") return { event: raced.data as InboundEventRow, duplicate: true };
    return { event: raced.data as InboundEventRow, duplicate: false };
  }
  if (error) throw error;

  return { event: data as InboundEventRow, duplicate: false };
}

export async function claimMaiaConversationLock(payload: MaiaInboundPayload, lockOwner: string) {
  if (!clean(payload.externalConversationId, 300)) return true;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_maia_conversation_lock", {
    p_organization_id: payload.organizationId,
    p_agent_id: payload.agentId,
    p_channel: clean(payload.channel, 80),
    p_external_conversation_id: clean(payload.externalConversationId, 300),
    p_lock_owner: lockOwner,
    p_lease_seconds: 180,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function releaseMaiaConversationLock(payload: MaiaInboundPayload, lockOwner: string) {
  if (!clean(payload.externalConversationId, 300)) return true;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("release_maia_conversation_lock", {
    p_organization_id: payload.organizationId,
    p_agent_id: payload.agentId,
    p_channel: clean(payload.channel, 80),
    p_external_conversation_id: clean(payload.externalConversationId, 300),
    p_lock_owner: lockOwner,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function markMaiaInboundCompleted(eventId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("maia_inbound_events").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_error: null,
  }).eq("id", eventId);
  if (error) throw error;
}

export async function markMaiaInboundFailed(eventId: string, errorMessage: string) {
  const admin = createAdminClient();
  const { error } = await admin.from("maia_inbound_events").update({
    status: "failed",
    last_error: clean(errorMessage, 2000),
    updated_at: new Date().toISOString(),
  }).eq("id", eventId);
  if (error) throw error;
}

export async function recordMaiaRuntimeEvent(args: {
  organizationId: string;
  agentId: string;
  eventType: string;
  status: string;
  payload?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { error } = await admin.from("agent_runtime_events").insert({
    organization_id: args.organizationId,
    agent_id: args.agentId,
    event_type: clean(args.eventType, 120),
    status: clean(args.status, 80),
    payload: args.payload || {},
  });
  if (error) throw error;
}
