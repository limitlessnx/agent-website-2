import { collectSupportDiagnostics } from "@/lib/support-agent";
import { sanitizeSupportDiagnostics } from "@/lib/ai/support-sanitizer";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { enforceLeoOrganizationScope, type LeoIdentity } from "@/lib/leo-core";
import { LEO_PUBLIC_KNOWLEDGE } from "@/lib/leo-public-knowledge";
import { listLeoOperationalMemories } from "@/lib/leo-operational-memory";
import type { LeoReasoningContext } from "@/lib/ai/leo-model";

async function tenantContext(identity: LeoIdentity) {
  const organizationId = enforceLeoOrganizationScope(identity);
  if (!organizationId) throw new Error("Tenant Leo context requires an organization.");

  const [diagnostics, subscriptions, billingPlans, readiness] = await Promise.all([
    collectSupportDiagnostics("tenant", organizationId),
    supabaseServerRequest<Record<string, unknown>[]>(
      `organization_subscriptions?select=id,organization_id,plan_id,status,current_period_end&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=1`,
    ).catch(() => []),
    supabaseServerRequest<Record<string, unknown>[]>(
      "billing_plans?select=id,name,status&order=created_at.asc",
    ).catch(() => []),
    supabaseServerRequest<Record<string, unknown>[]>(
      `agent_runtime_readiness?select=organization_id,agent_id,business_profile_ready,prompt_ready,knowledge_ready,integrations_ready,test_ready,approval_ready,workflow_ready,readiness_score,refreshed_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=refreshed_at.desc&limit=50`,
    ).catch(() => []),
  ]);

  return sanitizeSupportDiagnostics(
    { ...diagnostics, subscriptions, billingPlans, readiness },
    "tenant",
    organizationId,
  ) as unknown as Record<string, unknown>;
}

async function adminContext(identity: LeoIdentity) {
  if (identity.scope !== "super_admin") throw new Error("Super-admin Leo context requires super-admin scope.");
  const diagnostics = await collectSupportDiagnostics("admin");
  const safe = sanitizeSupportDiagnostics(
    diagnostics as unknown as Record<string, unknown>,
    "admin",
  );

  const [organizations, usage, operationalMemory] = await Promise.all([
    supabaseServerRequest<Record<string, unknown>[]>(
      "organizations?select=id,name,slug,status&order=created_at.desc&limit=100",
    ).catch(() => []),
    supabaseServerRequest<Record<string, unknown>[]>(
      "usage_ledger?select=organization_id,usage_type,quantity,occurred_at&order=occurred_at.desc&limit=100",
    ).catch(() => []),
    listLeoOperationalMemories(identity, { limit: 12, includeRetired: false }).catch(() => []),
  ]);

  return {
    diagnostics: safe,
    platform: {
      organizationCount: organizations.length,
      activeOrganizationCount: organizations.filter((item) => String(item.status || "").toLowerCase() === "active").length,
      recentUsageEvents: usage.length,
    },
    operationalMemory: operationalMemory.map((memory) => ({
      id: memory.id,
      kind: memory.kind,
      title: memory.title,
      summary: memory.summary,
      workspace: memory.workspace || null,
      organizationId: memory.organizationId || null,
      confidence: memory.confidence,
      source: memory.source,
      updatedAt: memory.updatedAt,
    })),
    memoryRules: {
      scope: "super_admin_only",
      usage: "Use relevant operational memory as historical context, never as fresh execution evidence or permission.",
      conflictRule: "Current verified system state and explicit current user instructions override older memory.",
    },
  } as Record<string, unknown>;
}

export async function buildLeoReasoningContext(input: {
  identity: LeoIdentity;
  pageContext?: unknown;
}): Promise<LeoReasoningContext> {
  const base: LeoReasoningContext = {
    pageContext: input.pageContext,
    publicKnowledge: LEO_PUBLIC_KNOWLEDGE as unknown as Record<string, unknown>,
  };

  if (input.identity.scope === "tenant") {
    return { ...base, tenantSnapshot: await tenantContext(input.identity) };
  }
  if (input.identity.scope === "super_admin") {
    return { ...base, adminSnapshot: await adminContext(input.identity) };
  }
  return base;
}
