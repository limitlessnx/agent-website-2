import { createAdminClient } from "@/lib/supabase/admin";

type Json = Record<string, unknown>;

export type FailureClassification = {
  category: "transient" | "configuration" | "entitlement" | "permission" | "data" | "unknown";
  retryable: boolean;
  severity: "normal" | "high" | "critical";
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

export function classifyOrchestrationFailure(message: string | null | undefined): FailureClassification {
  const value = String(message || "").toLowerCase();

  if (/timeout|timed out|rate limit|too many requests|\b429\b|\b5\d\d\b|service unavailable|bad gateway|gateway timeout|network|fetch failed|connection reset|econnreset|econnrefused|socket/i.test(value)) {
    return { category: "transient", retryable: true, severity: "normal" };
  }
  if (/entitl|not active in organization|system is not active|subscription|package|plan does not allow/i.test(value)) {
    return { category: "entitlement", retryable: false, severity: "high" };
  }
  if (/permission|forbidden|unauthorized|cross-tenant|cross organization|security|credential access/i.test(value)) {
    return { category: "permission", retryable: false, severity: "critical" };
  }
  if (/not configured|missing.*integration|calendar.*required|no provisioned target agent|unsupported.*provider|credentials are missing|template.*configured/i.test(value)) {
    return { category: "configuration", retryable: false, severity: "high" };
  }
  if (/missing required|not found in this organization|invalid|requires .*id|customer has no|requires a valid/i.test(value)) {
    return { category: "data", retryable: false, severity: "normal" };
  }
  return { category: "unknown", retryable: false, severity: "high" };
}

export async function inspectOrchestrationChain(input: {
  organizationId: string;
  eventId?: string | null;
  correlationId?: string | null;
}) {
  const admin = createAdminClient();
  let correlationId = text(input.correlationId);

  if (!correlationId && input.eventId) {
    const { data, error } = await admin
      .from("domain_events")
      .select("id,organization_id,correlation_id")
      .eq("organization_id", input.organizationId)
      .eq("id", input.eventId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("System event was not found in this organization.");
    correlationId = String(data.correlation_id || "");
  }
  if (!correlationId) throw new Error("event_id or correlation_id is required.");

  const { data, error } = await (admin as any).rpc("get_system_event_chain_diagnostics", {
    p_organization_id: input.organizationId,
    p_correlation_id: correlationId,
  });
  if (error) throw error;
  return data as Json;
}

export async function retryFailedSystemEvent(input: {
  organizationId: string;
  eventId: string;
  actor: string;
  reason?: string | null;
}) {
  const admin = createAdminClient();
  const { data, error } = await (admin as any).rpc("retry_failed_system_event", {
    p_organization_id: input.organizationId,
    p_event_id: input.eventId,
    p_actor: input.actor,
    p_reason: input.reason || null,
  });
  if (error) throw error;
  return data as Json;
}

async function ensureFailureSupportCase(input: {
  organizationId: string;
  eventId: string;
  correlationId: string;
  eventType: string;
  errorMessage: string;
  classification: FailureClassification;
  metadata: Json;
}) {
  const admin = createAdminClient();
  const existingId = text(input.metadata.orchestration_support_conversation_id);
  if (existingId) return existingId;

  const assignedAgent =
    input.classification.category === "permission"
    || input.classification.category === "entitlement"
    || (input.classification.category === "transient" && input.classification.severity === "high")
      ? "super-admin-support"
      : "agent-leo";

  const { data, error } = await admin
    .from("support_conversations")
    .insert({
      organization_id: input.organizationId,
      title: `Orchestration failure: ${input.eventType}`,
      status: assignedAgent === "super-admin-support" ? "waiting_approval" : "open",
      priority: input.classification.severity,
      created_by: "orchestration-recovery",
      assigned_agent: assignedAgent,
      summary: input.errorMessage.slice(0, 2000),
      metadata: {
        source: "orchestration-recovery",
        orchestration_event_id: input.eventId,
        correlation_id: input.correlationId,
        event_type: input.eventType,
        failure_category: input.classification.category,
        retryable: input.classification.retryable,
        escalation_required: assignedAgent === "super-admin-support",
        recommended_action: input.classification.retryable
          ? "Review retry history and retry only after the transient dependency is healthy."
          : "Inspect the failing hop and correct configuration, permission, entitlement, or data before retrying.",
      },
    })
    .select("id")
    .single();
  if (error) throw error;

  const supportConversationId = String(data.id);
  const { error: updateError } = await admin
    .from("domain_events")
    .update({
      metadata: {
        ...input.metadata,
        recovery_failure_category: input.classification.category,
        recovery_retryable: input.classification.retryable,
        orchestration_support_conversation_id: supportConversationId,
        recovery_escalated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.eventId);
  if (updateError) throw updateError;

  return supportConversationId;
}

export async function recoverFailedSystemEvents(limit = 50) {
  const admin = createAdminClient();
  const { data: events, error } = await admin
    .from("domain_events")
    .select("id,organization_id,event_type,correlation_id,last_error,metadata,attempts,updated_at")
    .eq("status", "failed")
    .order("updated_at", { ascending: true })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) throw error;

  const results: Json[] = [];

  for (const event of events || []) {
    const metadata = record(event.metadata);
    const classification = classifyOrchestrationFailure(event.last_error);
    const autoRetryCount = Math.max(0, Number(metadata.orchestration_auto_retry_count || 0));

    if (classification.retryable && autoRetryCount < 2) {
      try {
        const retry = await retryFailedSystemEvent({
          organizationId: event.organization_id,
          eventId: event.id,
          actor: "trigger:orchestration-recovery",
          reason: `Automatic retry for transient ${classification.category} failure`,
        });
        await admin
          .from("domain_events")
          .update({
            metadata: {
              ...metadata,
              orchestration_auto_retry_count: autoRetryCount + 1,
              recovery_failure_category: classification.category,
              recovery_retryable: true,
              last_auto_retry_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", event.organization_id)
          .eq("id", event.id);
        results.push({ eventId: event.id, action: "auto_retry", classification, retry });
        continue;
      } catch (retryError) {
        const message = retryError instanceof Error ? retryError.message : "Automatic retry could not be queued.";
        const supportConversationId = await ensureFailureSupportCase({
          organizationId: event.organization_id,
          eventId: event.id,
          correlationId: event.correlation_id,
          eventType: event.event_type,
          errorMessage: `${event.last_error || "Unknown failure"}; retry error: ${message}`,
          classification: { ...classification, severity: "high" },
          metadata,
        });
        results.push({ eventId: event.id, action: "escalated", supportConversationId, classification, retryError: message });
        continue;
      }
    }

    const escalatedClassification: FailureClassification =
      classification.retryable && autoRetryCount >= 2
        ? { ...classification, severity: "high" }
        : classification;

    const supportConversationId = await ensureFailureSupportCase({
      organizationId: event.organization_id,
      eventId: event.id,
      correlationId: event.correlation_id,
      eventType: event.event_type,
      errorMessage: text(event.last_error) || "Unknown orchestration failure.",
      classification: escalatedClassification,
      metadata,
    });

    results.push({
      eventId: event.id,
      action: "escalated",
      supportConversationId,
      classification: escalatedClassification,
      autoRetryCount,
    });
  }

  return { checked: events?.length || 0, results };
}
