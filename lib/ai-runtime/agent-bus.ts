import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoIdentity } from "@/lib/leo-core";
import type { RuntimeAgentMessage } from "@/lib/ai-runtime/types";

type RouteRow = { id: string; organization_id: string; source_agent_id: string; target_agent_id?: string | null; target_type: string; trigger_event: string; status: string; configuration?: Record<string, unknown> };
type EventRow = { id: string; organization_id: string; agent_id: string; event_type: string; payload: Record<string, unknown>; status: string; created_at: string };

function assertBusOrganization(identity: LeoIdentity, organizationId: string) {
  if (!organizationId) throw new Error("Agent communication requires an organization ID.");
  if (identity.scope === "tenant" && identity.organizationId !== organizationId) throw new Error("Cross-organization agent communication is forbidden.");
  if (identity.scope === "public") throw new Error("Public identities cannot use the agent communication bus.");
}

export async function publishRuntimeAgentMessage(identity: LeoIdentity, message: RuntimeAgentMessage) {
  assertBusOrganization(identity, message.organizationId);
  if (!message.sourceAgentId || !message.targetAgentId || !message.event || !message.correlationId) throw new Error("Agent message is missing routing identifiers.");
  const routes = await supabaseServerRequest<RouteRow[]>(`agent_orchestration_routes?select=id,organization_id,source_agent_id,target_agent_id,target_type,trigger_event,status,configuration&organization_id=eq.${encodeURIComponent(message.organizationId)}&source_agent_id=eq.${encodeURIComponent(message.sourceAgentId)}&target_type=eq.agent&target_agent_id=eq.${encodeURIComponent(message.targetAgentId)}&trigger_event=eq.${encodeURIComponent(message.event)}&status=eq.active&limit=1`);
  const route = routes[0];
  if (!route) throw new Error("No active same-organization agent route permits this message.");
  const rows = await supabaseServerRequest<EventRow[]>("agent_runtime_events", { method: "POST", body: JSON.stringify({ organization_id: message.organizationId, agent_id: message.targetAgentId, event_type: "agent.message", status: "queued", payload: { sourceAgentId: message.sourceAgentId, targetAgentId: message.targetAgentId, triggerEvent: message.event, correlationId: message.correlationId, routeId: route.id, data: message.payload } }) });
  if (!rows[0]?.id) throw new Error("Agent message could not be persisted.");
  return rows[0];
}

export async function consumeRuntimeAgentMessages(input: { identity: LeoIdentity; organizationId: string; agentId: string; limit?: number }) {
  assertBusOrganization(input.identity, input.organizationId);
  const limit = Math.max(1, Math.min(Number(input.limit || 20), 100));
  return supabaseServerRequest<EventRow[]>(`agent_runtime_events?select=id,organization_id,agent_id,event_type,payload,status,created_at&organization_id=eq.${encodeURIComponent(input.organizationId)}&agent_id=eq.${encodeURIComponent(input.agentId)}&event_type=eq.agent.message&status=eq.queued&order=created_at.asc&limit=${limit}`);
}
