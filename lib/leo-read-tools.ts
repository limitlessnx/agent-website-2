import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { enforceLeoOrganizationScope, type LeoIdentity } from "@/lib/leo-core";
import { getAgentManagementSummary } from "@/lib/agent-management";
import { getPlatformEngineSummary } from "@/lib/platform-engine";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";

function safeText(value: unknown, max = 500) {
  if (typeof value !== "string") return value;
  return value.replace(/https?:\/\/\S+/gi, "[url]").slice(0, max);
}

function safeRow(row: Record<string, unknown>) {
  const blocked = new Set(["access_token", "refresh_token", "api_key", "secret", "password", "credential", "credentials", "authorization", "private_key"]);
  return Object.fromEntries(Object.entries(row).filter(([key]) => !blocked.has(key.toLowerCase())).map(([key, value]) => [key, typeof value === "string" ? safeText(value) : value]));
}

function scopedQuery(identity: LeoIdentity, base: string) {
  const organizationId = enforceLeoOrganizationScope(identity);
  if (!organizationId) return base;
  return `${base}${base.includes("?") ? "&" : "?"}organization_id=eq.${encodeURIComponent(organizationId)}`;
}

export async function executeLeoReadTool(input: { identity: LeoIdentity; toolKey: string; arguments?: Record<string, unknown> }) {
  const { identity, toolKey } = input;
  const args = input.arguments || {};
  const requestedId = typeof args.id === "string" ? args.id.trim() : "";
  const organizationId = enforceLeoOrganizationScope(identity, typeof args.organizationId === "string" ? args.organizationId : undefined);

  if (toolKey === "leo.agent.inspect") {
    const summary = await getAgentManagementSummary();
    const selected = requestedId ? summary.agents.find((agent) => agent.id === requestedId) : null;
    return { tool: toolKey, scope: organizationId || identity.scope, selected: selected ? safeRow(selected as unknown as Record<string, unknown>) : null, summary: { total: summary.agents.length, configured: summary.configured, active: summary.agents.filter((agent) => agent.status === "active").length, paused: summary.agents.filter((agent) => agent.status === "paused").length, errors: summary.agents.filter((agent) => agent.status === "error").length } };
  }

  if (toolKey === "leo.workflow.inspect" || toolKey === "leo.workflow.inspect_failures") {
    const summary = await getWorkflowRegistrySummary();
    const selected = requestedId ? summary.workflows.find((workflow) => workflow.id === requestedId) : null;
    const runs = selected ? summary.runs.filter((run) => run.workflow_id === selected.id) : summary.runs;
    const filteredRuns = toolKey === "leo.workflow.inspect_failures" ? runs.filter((run) => ["failed", "error", "timed_out"].includes(String(run.status).toLowerCase())) : runs;
    return { tool: toolKey, scope: organizationId || identity.scope, selected: selected ? safeRow(selected as unknown as Record<string, unknown>) : null, summary: { configured: summary.configured, active: summary.active, paused: summary.paused, failures: summary.failures, successRate: summary.successRate }, runs: filteredRuns.slice(0, 25).map((run) => safeRow(run as unknown as Record<string, unknown>)) };
  }

  if (toolKey === "leo.integration.inspect") {
    const summary = await getPlatformEngineSummary();
    const selected = requestedId ? summary.integrations.find((integration) => integration.id === requestedId) : null;
    const integrations = selected ? [selected] : summary.integrations;
    return { tool: toolKey, scope: organizationId || identity.scope, selected: selected ? safeRow(selected as unknown as Record<string, unknown>) : null, integrations: integrations.slice(0, 50).map((integration) => safeRow(integration as unknown as Record<string, unknown>)) };
  }

  if (toolKey === "leo.crm.leads.read") {
    const limit = Math.min(Math.max(Number(args.limit) || 25, 1), 100);
    const query = scopedQuery(identity, `crm_leads?select=id,title,status,stage,source,created_at,customer_id&order=created_at.desc&limit=${limit}`);
    const leads = await supabaseServerRequest<Record<string, unknown>[]>(query);
    const filtered = requestedId ? leads.filter((lead) => String(lead.id) === requestedId) : leads;
    return { tool: toolKey, scope: organizationId || identity.scope, count: filtered.length, leads: filtered.map(safeRow) };
  }

  if (toolKey === "leo.billing.inspect") {
    const query = organizationId
      ? `organization_subscriptions?select=id,organization_id,plan_id,status,current_period_end&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=1`
      : "organization_subscriptions?select=id,organization_id,plan_id,status,current_period_end&order=updated_at.desc&limit=50";
    const [subscriptions, plans] = await Promise.all([
      supabaseServerRequest<Record<string, unknown>[]>(query),
      supabaseServerRequest<Record<string, unknown>[]>("billing_plans?select=id,name,status&order=created_at.asc"),
    ]);
    return { tool: toolKey, scope: organizationId || identity.scope, subscriptions: subscriptions.map(safeRow), plans: plans.map(safeRow) };
  }

  if (toolKey === "leo.tenant.inspect") {
    const [agents, workflows, integrations] = await Promise.all([
      executeLeoReadTool({ identity, toolKey: "leo.agent.inspect", arguments: {} }),
      executeLeoReadTool({ identity, toolKey: "leo.workflow.inspect_failures", arguments: {} }),
      executeLeoReadTool({ identity, toolKey: "leo.integration.inspect", arguments: {} }),
    ]);
    return { tool: toolKey, scope: organizationId || identity.scope, agents, workflows, integrations };
  }

  if (toolKey === "leo.platform.organizations.read") {
    const organizations = await supabaseServerRequest<Record<string, unknown>[]>("organizations?select=id,name,slug,status&order=created_at.desc&limit=100");
    return { tool: toolKey, scope: identity.scope, count: organizations.length, organizations: organizations.map(safeRow) };
  }

  throw new Error(`Leo read tool is not implemented: ${toolKey}`);
}
