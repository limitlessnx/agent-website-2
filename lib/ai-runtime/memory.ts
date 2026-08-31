import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoIdentity } from "@/lib/leo-core";
import type { RuntimeMessage } from "@/lib/ai-runtime/types";

function organizationFor(identity: LeoIdentity, requested?: string) {
  if (identity.scope === "tenant") {
    if (!identity.organizationId) throw new Error("Tenant runtime memory requires an organization ID.");
    if (requested && requested !== identity.organizationId) throw new Error("Cross-organization runtime memory access is forbidden.");
    return identity.organizationId;
  }
  if (identity.scope === "super_admin" || identity.scope === "internal_service") {
    if (!requested) throw new Error("Runtime memory requires an explicit organization ID.");
    return requested;
  }
  throw new Error("Public runtime memory is ephemeral.");
}

export async function loadRuntimeMemory(input: { identity: LeoIdentity; organizationId?: string; agentId: string; sessionId: string; limit?: number }): Promise<RuntimeMessage[]> {
  const organizationId = organizationFor(input.identity, input.organizationId);
  const limit = Math.max(1, Math.min(Number(input.limit || 24), 100));
  const rows = await supabaseServerRequest<Array<Record<string, unknown>>>(`agent_runtime_messages?select=id,role,content,tool_name,tool_call_id,metadata,created_at&organization_id=eq.${encodeURIComponent(organizationId)}&agent_id=eq.${encodeURIComponent(input.agentId)}&session_id=eq.${encodeURIComponent(input.sessionId)}&order=created_at.desc&limit=${limit}`);
  return rows.reverse().map((row) => ({ id: String(row.id || ""), role: (["system", "user", "assistant", "tool"] as string[]).includes(String(row.role)) ? String(row.role) as RuntimeMessage["role"] : "assistant", content: String(row.content || ""), toolName: row.tool_name ? String(row.tool_name) : undefined, toolCallId: row.tool_call_id ? String(row.tool_call_id) : undefined, metadata: row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {}, createdAt: row.created_at ? String(row.created_at) : undefined }));
}

export async function appendRuntimeMessage(input: { identity: LeoIdentity; organizationId?: string; agentId: string; sessionId: string; message: RuntimeMessage }) {
  const organizationId = organizationFor(input.identity, input.organizationId);
  return supabaseServerRequest<Array<Record<string, unknown>>>("agent_runtime_messages", { method: "POST", body: JSON.stringify({ organization_id: organizationId, agent_id: input.agentId, session_id: input.sessionId, role: input.message.role, content: String(input.message.content || "").slice(0, 24000), tool_name: input.message.toolName || null, tool_call_id: input.message.toolCallId || null, metadata: input.message.metadata || {} }) });
}
