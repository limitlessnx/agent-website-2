import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoIdentity } from "@/lib/leo-core";
import type { RuntimeChannel } from "@/lib/ai-runtime/types";

type RuntimeSessionRow = { id: string; organization_id: string; agent_id: string; channel: string; status: string; external_conversation_id?: string | null; context?: Record<string, unknown>; step_count?: number };

function exactOrganization(identity: LeoIdentity, requested?: string) {
  if (identity.scope === "tenant") {
    if (!identity.organizationId) throw new Error("Tenant runtime session requires an organization ID.");
    if (requested && requested !== identity.organizationId) throw new Error("Cross-organization runtime session access is forbidden.");
    return identity.organizationId;
  }
  if (identity.scope === "super_admin" || identity.scope === "internal_service") {
    if (!requested) throw new Error("Runtime session requires an explicit organization ID.");
    return requested;
  }
  throw new Error("Public sessions do not use tenant runtime persistence.");
}

export async function resolveRuntimeSession(input: { identity: LeoIdentity; organizationId?: string; agentId: string; channel: RuntimeChannel; sessionId?: string; externalConversationId?: string; context?: Record<string, unknown> }) {
  const organizationId = exactOrganization(input.identity, input.organizationId);
  if (!input.agentId?.trim()) throw new Error("agentId is required for persistent runtime sessions.");
  if (input.sessionId) {
    const rows = await supabaseServerRequest<RuntimeSessionRow[]>(`agent_runtime_sessions?select=*&id=eq.${encodeURIComponent(input.sessionId)}&organization_id=eq.${encodeURIComponent(organizationId)}&agent_id=eq.${encodeURIComponent(input.agentId)}&limit=1`);
    if (!rows[0]) throw new Error("Runtime session was not found in the current organization and agent boundary.");
    return rows[0];
  }
  if (input.externalConversationId) {
    const rows = await supabaseServerRequest<RuntimeSessionRow[]>(`agent_runtime_sessions?select=*&organization_id=eq.${encodeURIComponent(organizationId)}&agent_id=eq.${encodeURIComponent(input.agentId)}&external_conversation_id=eq.${encodeURIComponent(input.externalConversationId)}&status=eq.active&order=updated_at.desc&limit=1`);
    if (rows[0]) return rows[0];
  }
  const rows = await supabaseServerRequest<RuntimeSessionRow[]>("agent_runtime_sessions", { method: "POST", body: JSON.stringify({ organization_id: organizationId, agent_id: input.agentId, channel: input.channel, external_conversation_id: input.externalConversationId || null, status: "active", context: input.context || {} }) });
  if (!rows[0]?.id) throw new Error("Runtime session could not be created.");
  return rows[0];
}

export async function advanceRuntimeSession(input: { identity: LeoIdentity; organizationId?: string; agentId: string; sessionId: string; stepCount: number; lastModelId?: string }) {
  const organizationId = exactOrganization(input.identity, input.organizationId);
  return supabaseServerRequest(`agent_runtime_sessions?id=eq.${encodeURIComponent(input.sessionId)}&organization_id=eq.${encodeURIComponent(organizationId)}&agent_id=eq.${encodeURIComponent(input.agentId)}`, { method: "PATCH", body: JSON.stringify({ step_count: Math.max(0, input.stepCount), last_model_id: input.lastModelId || null, updated_at: new Date().toISOString() }) });
}
