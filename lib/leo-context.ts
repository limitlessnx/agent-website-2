import { collectSupportDiagnostics } from "@/lib/support-agent";
import { sanitizeSupportDiagnostics } from "@/lib/ai/support-sanitizer";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { enforceLeoOrganizationScope, type LeoIdentity } from "@/lib/leo-core";
import { LEO_PUBLIC_KNOWLEDGE } from "@/lib/leo-public-knowledge";
import type { LeoReasoningContext } from "@/lib/ai/leo-model";
import { getAgentManagementSummary } from "@/lib/agent-management";
import { getPlatformEngineSummary } from "@/lib/platform-engine";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";

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

type DashboardPageContext = {
  pathname?: string;
  section?: string;
  resourceType?: string;
  resourceId?: string;
};

function normalizePageContext(value: unknown): DashboardPageContext {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (candidate: unknown, max: number) => typeof candidate === "string" ? candidate.trim().slice(0, max) : "";
  return {
    pathname: text(input.pathname, 300) || "/dashboard",
    section: text(input.section, 80) || "dashboard",
    resourceType: text(input.resourceType, 80) || "dashboard",
    resourceId: text(input.resourceId, 120) || undefined,
  };
}

async function dashboardResourceContext(pageContext: unknown) {
  const page = normalizePageContext(pageContext);
  const section = page.section.toLowerCase();
  const resourceType = page.resourceType.toLowerCase();
  const resourceId = page.resourceId;

  if (section === "automations" || resourceType.includes("workflow") || resourceType.includes("automation")) {
    const summary = await getWorkflowRegistrySummary().catch(() => null);
    if (!summary) return { type: "automation", available: false };
    const selected = resourceId ? summary.workflows.find((item) => item.id === resourceId) : null;
    const recentRuns = selected ? summary.runs.filter((run) => run.workflow_id === selected.id).slice(0, 10) : summary.runs.slice(0, 10);
    return {
      type: "automation",
      available: true,
      selected: selected ? {
        id: selected.id,
        name: selected.name,
        status: selected.status,
        provider: selected.provider,
        environment: selected.environment,
        lastRunAt: selected.last_run_at,
        lastSuccessAt: selected.last_success_at,
        lastErrorAt: selected.last_error_at,
      } : null,
      summary: {
        configured: summary.configured,
        active: summary.active,
        paused: summary.paused,
        failures: summary.failures,
        successRate: summary.successRate,
      },
      recentRuns: recentRuns.map((run) => ({ id: run.id, workflowId: run.workflow_id, status: run.status, attempt: run.attempt, errorMessage: run.error_message, createdAt: run.created_at, completedAt: run.completed_at })),
    };
  }

  if (section === "agents" || resourceType === "agent") {
    const summary = await getAgentManagementSummary().catch(() => null);
    if (!summary) return { type: "agent", available: false };
    const selected = resourceId ? summary.agents.find((agent) => agent.id === resourceId) : null;
    const agents = selected ? [selected] : summary.agents.filter((agent) => agent.status !== "draft").slice(0, 50);
    return {
      type: "agent",
      available: true,
      selected: selected ? {
        id: selected.id,
        name: selected.name,
        status: selected.status,
        agentType: selected.agent_type,
        projectId: selected.project_id,
        channels: selected.communication_channels,
        knowledgeSources: selected.knowledge_sources?.length || 0,
        humanHandoffConfigured: Boolean(selected.human_handoff_destination && Object.keys(selected.human_handoff_destination).length),
        updatedAt: selected.updated_at,
      } : null,
      summary: {
        configured: summary.configured,
        total: summary.agents.length,
        active: summary.agents.filter((agent) => agent.status === "active").length,
        paused: summary.agents.filter((agent) => agent.status === "paused").length,
        errors: summary.agents.filter((agent) => agent.status === "error").length,
        workflowLinks: summary.links.length,
      },
      agents: agents.map((agent) => ({ id: agent.id, name: agent.name, status: agent.status, agentType: agent.agent_type, projectId: agent.project_id })),
    };
  }

  if (section === "crm" || resourceType === "lead" || resourceType === "customer" || resourceType === "customers") {
    const [leads, customers] = await Promise.all([
      supabaseServerRequest<Record<string, unknown>[]>("crm_leads?select=id,title,status,stage,source,created_at,customer_id&order=created_at.desc&limit=100").catch(() => []),
      supabaseServerRequest<Record<string, unknown>[]>("crm_customers?select=id,display_name,email,phone,status,created_at&order=created_at.desc&limit=100").catch(() => []),
    ]);
    const selectedLead = resourceId ? leads.find((lead) => String(lead.id) === resourceId) : null;
    const selectedCustomer = resourceId ? customers.find((customer) => String(customer.id) === resourceId) : null;
    return {
      type: selectedLead ? "lead" : selectedCustomer ? "customer" : "crm",
      available: true,
      selected: selectedLead || selectedCustomer || null,
      summary: { leadCount: leads.length, customerCount: customers.length, openLeads: leads.filter((lead) => !["closed", "lost"].includes(String(lead.status || "").toLowerCase())).length },
      recentLeads: leads.slice(0, 10).map((lead) => ({ id: lead.id, title: lead.title, status: lead.status, stage: lead.stage, source: lead.source, customerId: lead.customer_id, createdAt: lead.created_at })),
    };
  }

  if (section === "integrations" || resourceType === "integration") {
    const summary = await getPlatformEngineSummary().catch(() => null);
    if (!summary) return { type: "integration", available: false };
    const selected = resourceId ? summary.integrations.find((item) => item.id === resourceId) : null;
    return {
      type: "integration",
      available: true,
      selected: selected ? {
        id: selected.id,
        provider: selected.provider,
        displayName: selected.display_name,
        organizationId: selected.organization_id,
        status: selected.status,
        hasCredentials: selected.has_credentials,
        health: selected.health,
        lastCheckedAt: selected.last_checked_at,
        lastConnectedAt: selected.last_connected_at,
      } : null,
      summary: {
        total: summary.integrations.length,
        connected: summary.integrations.filter((item) => item.status === "connected").length,
        attention: summary.integrations.filter((item) => ["error", "authentication_failed"].includes(item.status)).length,
      },
    };
  }

  return { type: resourceType || section || "dashboard", available: false, selected: null };
}

async function adminContext(identity: LeoIdentity, pageContext?: unknown) {
  if (identity.scope !== "super_admin") throw new Error("Super-admin Leo context requires super-admin scope.");
  const diagnostics = await collectSupportDiagnostics("admin");
  const safe = sanitizeSupportDiagnostics(
    diagnostics as unknown as Record<string, unknown>,
    "admin",
  );

  const [organizations, usage, resourceContext] = await Promise.all([
    supabaseServerRequest<Record<string, unknown>[]>(
      "organizations?select=id,name,slug,status&order=created_at.desc&limit=100",
    ).catch(() => []),
    supabaseServerRequest<Record<string, unknown>[]>(
      "usage_ledger?select=organization_id,usage_type,quantity,occurred_at&order=occurred_at.desc&limit=100",
    ).catch(() => []),
    dashboardResourceContext(pageContext).catch(() => ({ type: "dashboard", available: false, selected: null })),
  ]);

  return {
    diagnostics: safe,
    platform: {
      organizationCount: organizations.length,
      activeOrganizationCount: organizations.filter((item) => String(item.status || "").toLowerCase() === "active").length,
      recentUsageEvents: usage.length,
    },
    dashboardResourceContext: resourceContext,
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
    return { ...base, adminSnapshot: await adminContext(input.identity, input.pageContext) };
  }
  return base;
}
