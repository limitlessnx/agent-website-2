import { isN8nApiConfigured, listN8nExecutions, listN8nWorkflows } from "@/lib/n8n-api";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { getWorkflowRegistrySummary } from "@/lib/workflow-registry";

export type SupportConversation = {
  id: string;
  organization_id?: string | null;
  title: string;
  status: string;
  priority: string;
  updated_at: string;
};

export type SupportMessage = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  diagnostics?: Record<string, unknown>;
  created_at: string;
};

export type SupportAction = {
  id: string;
  conversation_id: string;
  organization_id?: string | null;
  action_key: string;
  title: string;
  description: string;
  risk_level: "low" | "medium" | "high";
  status: string;
  created_at: string;
};

type OrganizationRow = { id: string; name: string; slug: string; status: string };
type AgentRow = { id: string; name: string; status: string; agent_type?: string | null };
type IntegrationRow = { id: string; provider: string; display_name?: string | null; status: string; last_checked_at?: string | null };
type TenantWorkflowRow = { id: string; name: string; workflow_key: string; status: string; provider: string; last_run_at?: string | null; last_error_at?: string | null };
type TenantRunRow = { id: string; workflow_key?: string | null; status: string; error_message?: string | null; created_at: string };
type RuntimeExecutionRow = { id: string; status: string; error_code?: string | null; created_at: string };

export type SupportScope = "admin" | "tenant";

async function safeLoad<T>(loader: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await loader();
  } catch {
    return fallback;
  }
}

function orgFilter(organizationId?: string) {
  return organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "";
}

function orgUuidFilter(organizationId?: string) {
  return organizationId ? `&organization_uuid=eq.${encodeURIComponent(organizationId)}` : "";
}

export async function getSupportConversationForScope(
  conversationId: string,
  scope: SupportScope,
  organizationId?: string,
) {
  if (!conversationId) return null;
  const filter = scope === "tenant"
    ? `&organization_id=eq.${encodeURIComponent(String(organizationId || ""))}`
    : "";
  const rows = await supabaseServerRequest<SupportConversation[]>(
    `support_conversations?select=id,organization_id,title,status,priority,updated_at&id=eq.${encodeURIComponent(conversationId)}${filter}&limit=1`,
  ).catch(() => []);
  return rows[0] || null;
}

export async function listSupportConversationsForScope(scope: SupportScope, organizationId?: string) {
  const filter = scope === "tenant"
    ? `&organization_id=eq.${encodeURIComponent(String(organizationId || ""))}`
    : "";
  return supabaseServerRequest<SupportConversation[]>(
    `support_conversations?select=id,organization_id,title,status,priority,updated_at${filter}&order=updated_at.desc&limit=50`,
  ).catch(() => []);
}

export async function collectSupportDiagnostics(scope: SupportScope, organizationId?: string) {
  const [registry, organizations, agents, integrations, tenantWorkflows, tenantRuns, runtimeExecutions] = await Promise.all([
    scope === "admin"
      ? safeLoad(() => getWorkflowRegistrySummary(), { configured: false, workflows: [], runs: [], active: 0, paused: 0, failures: 0, successRate: 0 })
      : Promise.resolve(null),
    safeLoad(
      () => supabaseServerRequest<OrganizationRow[]>(
        `organizations?select=id,name,slug,status${organizationId ? `&id=eq.${encodeURIComponent(organizationId)}` : ""}&order=created_at.desc&limit=20`,
      ),
      [],
    ),
    safeLoad(
      () => supabaseServerRequest<AgentRow[]>(
        `agents?select=id,name,status,agent_type${orgFilter(organizationId)}&order=created_at.desc&limit=50`,
      ),
      [],
    ),
    safeLoad(
      () => supabaseServerRequest<IntegrationRow[]>(
        `organization_integrations?select=id,provider,display_name,status,last_checked_at${orgFilter(organizationId)}&order=provider.asc&limit=50`,
      ),
      [],
    ),
    safeLoad(
      () => supabaseServerRequest<TenantWorkflowRow[]>(
        `workflow_registry?select=id,name,workflow_key,status,provider,last_run_at,last_error_at${orgUuidFilter(organizationId)}&order=updated_at.desc.nullslast&limit=100`,
      ),
      [],
    ),
    safeLoad(
      () => supabaseServerRequest<TenantRunRow[]>(
        `workflow_runs?select=id,workflow_key,status,error_message,created_at${orgUuidFilter(organizationId)}&order=created_at.desc&limit=50`,
      ),
      [],
    ),
    safeLoad(
      () => supabaseServerRequest<RuntimeExecutionRow[]>(
        `runtime_executions?select=id,status,error_code,created_at${orgFilter(organizationId)}&order=created_at.desc&limit=50`,
      ),
      [],
    ),
  ]);

  let n8n: Record<string, unknown> = { configured: isN8nApiConfigured(), visibleToTenant: false };
  if (scope === "admin" && isN8nApiConfigured()) {
    const [workflows, executions] = await Promise.all([
      listN8nWorkflows(100).catch(() => []),
      listN8nExecutions({ limit: 50, includeData: true }).catch(() => []),
    ]);
    n8n = {
      configured: true,
      workflows: workflows.length,
      activeWorkflows: workflows.filter((workflow) => workflow.active).length,
      recentExecutions: executions.length,
      recentErrors: executions.filter((execution) => execution.status === "error").length,
      visibleToTenant: false,
    };
  }

  const workflowFailures = tenantRuns.filter((run) => ["failed", "timed_out"].includes(run.status)).length;
  const workflowSuccesses = tenantRuns.filter((run) => run.status === "succeeded").length;
  const completed = workflowFailures + workflowSuccesses;

  return {
    scope,
    organizationId: organizationId || null,
    collectedAt: new Date().toISOString(),
    organizations,
    agents,
    integrations,
    workflows: tenantWorkflows,
    workflowRuns: tenantRuns,
    runtimeExecutions,
    workflowRegistry: registry
      ? { total: registry.workflows.length, active: registry.active, failures: registry.failures, successRate: registry.successRate }
      : {
          total: tenantWorkflows.length,
          active: tenantWorkflows.filter((workflow) => workflow.status === "active").length,
          failures: workflowFailures,
          successRate: completed ? Math.round((workflowSuccesses / completed) * 100) : 0,
        },
    n8n,
  };
}

function wantsExplanation(text: string) {
  return /(more detail|more details|explain|why|how did|what does|break it down|tell me more|elaborate)/i.test(text);
}

function navigationReply(scope: SupportScope) {
  const base = scope === "tenant"
    ? [
        "Use Dashboard for overall setup progress.",
        "Use Agents for agent setup and approval.",
        "Use Runtime setup for prompts, knowledge, and channel configuration.",
        "Use Agent execution for recent conversations, errors, handoffs, and usage.",
        "Use Integrations to confirm connected tools.",
        "Use Settings for workspace/account settings.",
      ]
    : [
        "Use Organizations to inspect client tenants.",
        "Use Automations/Workflows to inspect workflow mappings.",
        "Use Integrations to inspect platform credentials.",
        "Use Agent Leo Support for support cases and approval-gated repairs.",
      ];
  return ["Navigation guide:", "", ...base.map((item) => `- ${item}`)].join("\n");
}

export function buildSupportReply(
  message: string,
  diagnostics: Awaited<ReturnType<typeof collectSupportDiagnostics>>,
  history: SupportMessage[],
) {
  const text = message.toLowerCase();
  const scope = diagnostics.scope;
  const registry = diagnostics.workflowRegistry;
  const n8n = diagnostics.n8n as { configured?: boolean; recentErrors?: number; activeWorkflows?: number; workflows?: number };
  const previousAssistant = [...history].reverse().find((item) => item.role === "assistant");

  if (/menu|navigate|where do i|where can i|find|page|dashboard/i.test(message)) {
    return { content: navigationReply(scope), actions: [] as Array<Omit<SupportAction, "id" | "conversation_id" | "status" | "created_at">> };
  }

  if (wantsExplanation(message) && previousAssistant) {
    return {
      content: [
        "Detailed explanation:",
        "",
        "- I only inspect data inside the current support scope.",
        scope === "tenant"
          ? "- This tenant session is locked to your organization ID, so another tenant's data is not queried."
          : "- This super-admin session can inspect multiple organizations, but individual tenant repair actions still carry an organization ID.",
        "- Workflow status comes from Fluxknight registry records and recent execution history.",
        "- Integration status comes from the tenant integration records.",
        "- Production changes are approval-gated. I can propose a fix, but I do not silently change workflows or credentials.",
      ].join("\n"),
      actions: [] as Array<Omit<SupportAction, "id" | "conversation_id" | "status" | "created_at">>,
    };
  }

  const findings: string[] = [];
  const actions: Array<Omit<SupportAction, "id" | "conversation_id" | "status" | "created_at">> = [];
  const failedRuns = diagnostics.workflowRuns.filter((run) => ["failed", "timed_out"].includes(run.status));
  const disconnectedIntegrations = diagnostics.integrations.filter((integration) => !["connected", "active", "healthy"].includes(String(integration.status).toLowerCase()));
  const inactiveAgents = diagnostics.agents.filter((agent) => !["published", "testing", "active"].includes(String(agent.status).toLowerCase()));

  if (!diagnostics.organizations.length) findings.push("No organization record was found for this support scope.");
  if (!diagnostics.agents.length) findings.push("No agents are visible in this tenant workspace yet.");
  if (inactiveAgents.length) findings.push(`${inactiveAgents.length} agent(s) are not published or testing.`);
  if (disconnectedIntegrations.length) findings.push(`${disconnectedIntegrations.length} integration(s) need attention.`);
  if (failedRuns.length) findings.push(`${failedRuns.length} recent workflow run(s) failed or timed out.`);
  if (scope === "admin" && !n8n.configured) findings.push("The n8n API connection is not available to Agent Leo in this deployment.");
  if (scope === "admin" && (n8n.recentErrors || 0) > 0) findings.push(`${n8n.recentErrors} recent n8n execution error(s) were detected.`);
  if (registry.total > 0 && registry.active === 0) findings.push("Workflows exist, but none are currently active.");

  if (/workflow|automation|n8n|failed|error|not working|broken/i.test(text)) {
    actions.push({
      organization_id: diagnostics.organizationId,
      action_key: "inspect_tenant_workflow_failures",
      title: "Inspect workflow failures",
      description: "Review this tenant's recent workflow runs, statuses, and error messages. This is read-only.",
      risk_level: "low",
    });
  }
  if (/integration|connect|credential|api|whatsapp|telegram|supabase|vercel/i.test(text)) {
    actions.push({
      organization_id: diagnostics.organizationId,
      action_key: "verify_tenant_integrations",
      title: "Verify tenant integrations",
      description: "Check this tenant's integration records and identify disconnected or unhealthy tools. This is read-only.",
      risk_level: "low",
    });
  }
  if (/fix|repair|reset|retry|solve/i.test(text)) {
    actions.push({
      organization_id: diagnostics.organizationId,
      action_key: scope === "tenant" ? "request_admin_repair" : "prepare_admin_repair",
      title: scope === "tenant" ? "Request admin repair" : "Prepare admin repair",
      description: scope === "tenant"
        ? "Create a tenant-scoped support action for platform admin review. No production change is performed by the tenant agent."
        : "Prepare an approval-gated repair plan for the scoped tenant. No production change is performed automatically.",
      risk_level: "medium",
    });
  }

  if (!findings.length) findings.push("No obvious issue appeared in the scoped diagnostic pass.");

  return {
    content: [
      scope === "tenant" ? "Tenant diagnostic complete." : "Platform diagnostic complete.",
      "",
      "Findings:",
      ...findings.map((finding) => `- ${finding}`),
      "",
      `Scoped snapshot: ${registry.active}/${registry.total} workflows active, ${registry.successRate}% recorded workflow success rate, ${diagnostics.integrations.length} integration(s), ${diagnostics.agents.length} agent(s).`,
      "",
      actions.length
        ? "I prepared the next safe actions below. Approve only the action you want recorded for review."
        : "Tell me the affected agent, channel, page, or exact error message so I can narrow the diagnosis.",
    ].join("\n"),
    actions,
  };
}
