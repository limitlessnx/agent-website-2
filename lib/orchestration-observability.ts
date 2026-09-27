import { createAdminClient } from "@/lib/supabase/admin";
import { classifyOrchestrationFailure } from "@/lib/orchestration-operations";

export type OrchestrationFailureItem = {
  eventId: string;
  correlationId: string;
  eventType: string;
  status: string;
  sourceSystem: string | null;
  targetSystem: string | null;
  failedHop: string | null;
  error: string | null;
  retryCount: number;
  failureCategory: string;
  retryable: boolean;
  supportConversationId: string | null;
  updatedAt: string;
};

export async function getRecentOrchestrationFailures(
  organizationId: string,
  limit = 25,
): Promise<OrchestrationFailureItem[]> {
  const admin = createAdminClient();
  const { data: events, error } = await admin
    .from("domain_events")
    .select("id,organization_id,event_type,status,correlation_id,source_system_id,target_system_id,last_error,metadata,updated_at")
    .eq("organization_id", organizationId)
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) throw error;
  if (!events?.length) return [];

  const eventIds = events.map((event) => event.id);
  const sourceIds = [...new Set(events.map((event) => event.source_system_id).filter(Boolean))] as string[];
  const targetIds = [...new Set(events.map((event) => event.target_system_id).filter(Boolean))] as string[];

  const [deliveriesResult, installationsResult] = await Promise.all([
    admin
      .from("system_event_deliveries")
      .select("event_id,target_system_id,status,retry_count,error_message,created_at")
      .eq("organization_id", organizationId)
      .in("event_id", eventIds)
      .eq("status", "failed"),
    sourceIds.length || targetIds.length
      ? admin
          .from("organization_systems")
          .select("id,system_id")
          .eq("organization_id", organizationId)
          .in("id", [...new Set([...sourceIds, ...targetIds])])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (deliveriesResult.error) throw deliveriesResult.error;
  if (installationsResult.error) throw installationsResult.error;

  const installationRows = installationsResult.data || [];
  const catalogIds = [...new Set(installationRows.map((row) => row.system_id).filter(Boolean))];
  const catalogResult = catalogIds.length
    ? await admin.from("system_catalog").select("id,slug").in("id", catalogIds)
    : { data: [], error: null };
  if (catalogResult.error) throw catalogResult.error;

  const slugByCatalog = new Map((catalogResult.data || []).map((row) => [row.id, row.slug]));
  const slugByInstallation = new Map(
    installationRows.map((row) => [row.id, slugByCatalog.get(row.system_id) || null]),
  );
  const failedByEvent = new Map(
    (deliveriesResult.data || []).map((row) => [row.event_id, row]),
  );

  return events.map((event) => {
    const delivery = failedByEvent.get(event.id);
    const metadata = (event.metadata || {}) as Record<string, unknown>;
    const errorMessage = String(delivery?.error_message || event.last_error || "").trim() || null;
    const classification = classifyOrchestrationFailure(errorMessage);
    return {
      eventId: event.id,
      correlationId: event.correlation_id,
      eventType: event.event_type,
      status: event.status,
      sourceSystem: event.source_system_id ? slugByInstallation.get(event.source_system_id) || null : null,
      targetSystem: event.target_system_id
        ? slugByInstallation.get(event.target_system_id) || null
        : delivery?.target_system_id
          ? slugByInstallation.get(delivery.target_system_id) || null
          : null,
      failedHop: delivery?.target_system_id ? slugByInstallation.get(delivery.target_system_id) || null : null,
      error: errorMessage,
      retryCount: Number(delivery?.retry_count || 0),
      failureCategory: classification.category,
      retryable: classification.retryable,
      supportConversationId: String(metadata.orchestration_support_conversation_id || "").trim() || null,
      updatedAt: event.updated_at,
    };
  });
}

export async function getOrchestrationOperationsSnapshot(organizationId: string) {
  const failures = await getRecentOrchestrationFailures(organizationId, 50);
  return {
    failures,
    summary: {
      failedEvents: failures.length,
      retryable: failures.filter((item) => item.retryable).length,
      escalated: failures.filter((item) => Boolean(item.supportConversationId)).length,
      retried: failures.filter((item) => item.retryCount > 0).length,
    },
  };
}
