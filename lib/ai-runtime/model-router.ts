import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoIdentity } from "@/lib/leo-core";
import type { RuntimeModelRoute } from "@/lib/ai-runtime/types";

type CatalogModel = { id: string; provider: string; model_key: string; status: string; capabilities?: Record<string, unknown> };
type AgentAssignment = { ai_model_id?: string | null; fallback_ai_model_id?: string | null; status: string };
type OrganizationAssignment = { model_id: string };
type AgentRow = { ai_model?: string | null };

async function activeCatalogModel(id: string | undefined | null) {
  if (!id) return null;
  const rows = await supabaseServerRequest<CatalogModel[]>(`ai_model_catalog?select=id,provider,model_key,status,capabilities&id=eq.${encodeURIComponent(id)}&status=eq.active&limit=1`);
  return rows[0] || null;
}

function orgFor(identity: LeoIdentity, requested?: string) {
  if (identity.scope === "tenant") {
    if (!identity.organizationId) throw new Error("Tenant model routing requires an organization ID.");
    if (requested && requested !== identity.organizationId) throw new Error("Cross-organization model routing is forbidden.");
    return identity.organizationId;
  }
  return requested;
}

export async function routeRuntimeModel(input: { identity: LeoIdentity; organizationId?: string; agentId?: string; overrideModelId?: string }): Promise<RuntimeModelRoute> {
  const organizationId = orgFor(input.identity, input.organizationId);

  if (input.overrideModelId) {
    if (input.identity.scope !== "super_admin") throw new Error("Only Super Admin can override the runtime model.");
    const selected = await activeCatalogModel(input.overrideModelId);
    if (!selected) throw new Error("Requested model override is not active or does not exist.");
    return { provider: selected.provider, modelId: selected.id, modelKey: selected.model_key, source: "super_admin_override" };
  }

  if (organizationId && input.agentId) {
    const assignments = await supabaseServerRequest<AgentAssignment[]>(`agent_provider_assignments?select=ai_model_id,fallback_ai_model_id,status&organization_id=eq.${encodeURIComponent(organizationId)}&agent_id=eq.${encodeURIComponent(input.agentId)}&status=eq.active&limit=1`).catch(() => []);
    const assigned = assignments[0];
    const primary = await activeCatalogModel(assigned?.ai_model_id);
    if (primary) {
      const fallback = await activeCatalogModel(assigned?.fallback_ai_model_id);
      return { provider: primary.provider, modelId: primary.id, modelKey: primary.model_key, source: "agent_assignment", fallbackModelKey: fallback?.model_key };
    }
  }

  if (organizationId) {
    const rows = await supabaseServerRequest<OrganizationAssignment[]>(`organization_ai_model_assignments?select=model_id&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`).catch(() => []);
    const model = await activeCatalogModel(rows[0]?.model_id);
    if (model) return { provider: model.provider, modelId: model.id, modelKey: model.model_key, source: "organization_assignment" };
  }

  if (organizationId && input.agentId) {
    const agents = await supabaseServerRequest<AgentRow[]>(`agents?select=ai_model&organization_id=eq.${encodeURIComponent(organizationId)}&id=eq.${encodeURIComponent(input.agentId)}&limit=1`).catch(() => []);
    const key = String(agents[0]?.ai_model || "").trim();
    if (key) return { provider: "openai", modelKey: key, source: "agent_default" };
  }

  return { provider: "openai", modelKey: process.env.LEO_AI_MODEL?.trim() || process.env.SUPPORT_AI_MODEL?.trim() || "gpt-4o-mini", source: "environment_default" };
}
