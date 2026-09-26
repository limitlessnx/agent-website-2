import { createAdminClient } from "@/lib/supabase/admin";
import { executeSystemWorkflowAdapter } from "@/lib/system-event-adapters";

export type SystemEventEnvelope = {
  id: string;
  organizationId: string;
  sourceSystemId: string;
  targetSystemId?: string | null;
  customerId?: string | null;
  conversationId?: string | null;
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
  correlationId: string;
  causationId?: string | null;
  idempotencyKey?: string | null;
  attempts: number;
};

type DomainEventRow = {
  id: string;
  organization_id: string;
  source_system_id: string;
  target_system_id?: string | null;
  customer_id?: string | null;
  conversation_id?: string | null;
  event_type: string;
  source: string;
  payload: Record<string, unknown> | null;
  correlation_id: string;
  causation_id?: string | null;
  idempotency_key?: string | null;
  attempts: number;
};

type RouteRow = {
  id: string;
  organization_id: string;
  source_system_id: string;
  event_type: string;
  target_system_id: string;
  priority: number;
  dispatch_mode: "auto" | "agent_runtime" | "workflow_adapter";
  configuration: Record<string, unknown> | null;
};

function mapEvent(row: DomainEventRow): SystemEventEnvelope {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceSystemId: row.source_system_id,
    targetSystemId: row.target_system_id || null,
    customerId: row.customer_id || null,
    conversationId: row.conversation_id || null,
    eventType: row.event_type,
    source: row.source,
    payload: row.payload || {},
    correlationId: row.correlation_id,
    causationId: row.causation_id || null,
    idempotencyKey: row.idempotency_key || null,
    attempts: Number(row.attempts || 0),
  };
}

export async function publishSystemEvent(input: {
  organizationId: string;
  sourceSystemId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  targetSystemId?: string | null;
  customerId?: string | null;
  conversationId?: string | null;
  correlationId?: string | null;
  causationId?: string | null;
  idempotencyKey?: string | null;
  source?: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("publish_system_event", {
    p_organization_id: input.organizationId,
    p_source_system_id: input.sourceSystemId,
    p_event_type: input.eventType,
    p_payload: input.payload || {},
    p_target_system_id: input.targetSystemId || null,
    p_customer_id: input.customerId || null,
    p_conversation_id: input.conversationId || null,
    p_correlation_id: input.correlationId || null,
    p_causation_id: input.causationId || null,
    p_idempotency_key: input.idempotencyKey || null,
    p_source: input.source || "system",
  });
  if (error) throw error;
  return String(data);
}

export async function claimSystemEvent(eventId?: string | null) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_system_event", {
    p_event_id: eventId || null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return mapEvent(row as DomainEventRow);
}

async function resolveRoutes(event: SystemEventEnvelope) {
  const supabase = createAdminClient();
  let query = supabase
    .from("system_event_routes")
    .select("id,organization_id,source_system_id,event_type,target_system_id,priority,dispatch_mode,configuration")
    .eq("organization_id", event.organizationId)
    .eq("source_system_id", event.sourceSystemId)
    .eq("event_type", event.eventType)
    .eq("status", "active")
    .order("priority", { ascending: true });

  if (event.targetSystemId) query = query.eq("target_system_id", event.targetSystemId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as RouteRow[];
}

async function validateTargetSystem(organizationId: string, installationId: string) {
  const supabase = createAdminClient();
  const { data: installation, error } = await supabase
    .from("organization_systems")
    .select("id,organization_id,system_id,status")
    .eq("organization_id", organizationId)
    .eq("id", installationId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!installation) throw new Error("Target system is not active in organization.");

  const { data: entitled, error: entitlementError } = await supabase.rpc("organization_can_use_system", {
    p_organization_id: organizationId,
    p_system_id: installation.system_id,
  });
  if (entitlementError) throw entitlementError;
  if (!entitled) throw new Error("Target system is no longer entitled for organization.");

  return installation;
}

async function resolveTargetAgent(organizationId: string, catalogSystemId: string) {
  const supabase = createAdminClient();
  const { data: selections, error } = await supabase
    .from("organization_agent_selections")
    .select("id,status,configuration")
    .eq("organization_id", organizationId)
    .eq("system_catalog_id", catalogSystemId)
    .in("status", ["selected", "paid", "provisioning", "active"])
    .order("created_at", { ascending: true });
  if (error) throw error;

  for (const selection of selections || []) {
    const configuration = (selection.configuration || {}) as Record<string, unknown>;
    const agentId = String(configuration.provisioned_agent_id || "").trim();
    if (!agentId) continue;

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id,organization_id,status")
      .eq("organization_id", organizationId)
      .eq("id", agentId)
      .maybeSingle();
    if (agentError) throw agentError;
    if (agent) return agent.id;
  }
  return null;
}

async function createDelivery(event: SystemEventEnvelope, route: RouteRow) {
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("system_event_deliveries")
    .select("id,status,attempt,result,error_message")
    .eq("event_id", event.id)
    .eq("route_id", route.id)
    .eq("attempt", 1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing && existing.status === "delivered") return existing;

  if (existing) {
    const { data, error } = await supabase
      .from("system_event_deliveries")
      .update({ status: "processing", started_at: new Date().toISOString(), error_message: null })
      .eq("organization_id", event.organizationId)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("system_event_deliveries")
    .insert({
      organization_id: event.organizationId,
      event_id: event.id,
      route_id: route.id,
      target_system_id: route.target_system_id,
      status: "processing",
      attempt: 1,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function finishDelivery(input: {
  organizationId: string;
  deliveryId: string;
  status: "delivered" | "failed" | "skipped";
  result?: Record<string, unknown>;
  errorMessage?: string | null;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("system_event_deliveries")
    .update({
      status: input.status,
      result: input.result || null,
      error_message: input.errorMessage || null,
      completed_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.deliveryId);
  if (error) throw error;
}

async function dispatchRoute(event: SystemEventEnvelope, route: RouteRow) {
  const delivery = await createDelivery(event, route);
  if (delivery.status === "delivered") {
    return { routeId: route.id, status: "delivered", duplicate: true, result: delivery.result || null };
  }

  try {
    const target = await validateTargetSystem(event.organizationId, route.target_system_id);

    if (route.dispatch_mode === "workflow_adapter") {
      const result = await executeSystemWorkflowAdapter({
        event,
        routeId: route.id,
        targetSystemId: route.target_system_id,
        configuration: route.configuration,
      });
      await finishDelivery({
        organizationId: event.organizationId,
        deliveryId: delivery.id,
        status: "delivered",
        result,
      });
      return { routeId: route.id, status: "delivered", result };
    }

    const agentId = await resolveTargetAgent(event.organizationId, target.system_id);
    if (!agentId) {
      const result = { adapter_required: true, reason: "No provisioned target agent is bound to this system yet." };
      await finishDelivery({
        organizationId: event.organizationId,
        deliveryId: delivery.id,
        status: "skipped",
        result,
      });
      return { routeId: route.id, status: "skipped", result };
    }

    const supabase = createAdminClient();
    const idempotencyKey = `system-event:${event.id}:route:${route.id}`;
    const { data: executionId, error } = await supabase.rpc("enqueue_agent_execution", {
      p_organization_id: event.organizationId,
      p_agent_id: agentId,
      p_conversation_id: event.conversationId || null,
      p_input: {
        event: {
          id: event.id,
          eventType: event.eventType,
          sourceSystemId: event.sourceSystemId,
          targetSystemId: route.target_system_id,
          customerId: event.customerId || null,
          conversationId: event.conversationId || null,
          correlationId: event.correlationId,
          causationId: event.causationId || null,
          payload: event.payload,
        },
      },
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;

    const result = { runtime_execution_id: String(executionId), target_agent_id: agentId };
    await finishDelivery({
      organizationId: event.organizationId,
      deliveryId: delivery.id,
      status: "delivered",
      result,
    });
    return { routeId: route.id, status: "delivered", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "System event delivery failed.";
    await finishDelivery({
      organizationId: event.organizationId,
      deliveryId: delivery.id,
      status: "failed",
      errorMessage: message,
    }).catch(() => undefined);
    return { routeId: route.id, status: "failed", error: message };
  }
}

export async function processSystemEvent(eventId?: string | null) {
  const event = await claimSystemEvent(eventId);
  if (!event) return { status: "idle" as const };

  const supabase = createAdminClient();
  try {
    const routes = await resolveRoutes(event);
    if (!routes.length) {
      const message = "No active authorized system route matched this event.";
      await supabase
        .from("domain_events")
        .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
        .eq("organization_id", event.organizationId)
        .eq("id", event.id);
      return { status: "failed" as const, eventId: event.id, error: message, deliveries: [] };
    }

    const deliveries = [];
    for (const route of routes) deliveries.push(await dispatchRoute(event, route));

    const failed = deliveries.filter((item) => item.status === "failed");
    const finalStatus = failed.length ? "failed" : "published";
    const { error } = await supabase
      .from("domain_events")
      .update({
        status: finalStatus,
        published_at: finalStatus === "published" ? new Date().toISOString() : null,
        last_error: failed.length ? failed.map((item) => item.error).filter(Boolean).join("; ").slice(0, 2000) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", event.organizationId)
      .eq("id", event.id);
    if (error) throw error;

    return { status: finalStatus, eventId: event.id, correlationId: event.correlationId, deliveries };
  } catch (error) {
    const message = error instanceof Error ? error.message : "System event processing failed.";
    await supabase
      .from("domain_events")
      .update({ status: "failed", last_error: message.slice(0, 2000), updated_at: new Date().toISOString() })
      .eq("organization_id", event.organizationId)
      .eq("id", event.id)
      .catch(() => undefined);
    throw error;
  }
}
