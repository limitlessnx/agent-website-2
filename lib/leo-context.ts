import { collectSupportDiagnostics } from "@/lib/support-agent";
import { sanitizeSupportDiagnostics } from "@/lib/ai/support-sanitizer";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { enforceLeoOrganizationScope, type LeoIdentity } from "@/lib/leo-core";
import { LEO_PUBLIC_KNOWLEDGE } from "@/lib/leo-public-knowledge";
import { listLeoOperationalMemories } from "@/lib/leo-operational-memory";
import { compactLeoPlaybooksForContext, listLeoOperationalPlaybooks, matchLeoOperationalPlaybooks } from "@/lib/leo-operational-playbooks";
import { listLeoAutonomousGoals, summarizeLeoGoalHealth } from "@/lib/leo-autonomous-goals";
import { compactLeoWorkspacePortfolio, listLeoWorkspacePortfolio } from "@/lib/leo-workspace-portfolio";
import { buildLeoDecisionIntelligence, compactLeoDecisionIntelligence } from "@/lib/leo-decision-intelligence";
import { listLeoOptimizationProposals } from "@/lib/leo-autonomous-optimization";
import { buildLeoExecutiveBrief, compactLeoExecutiveBrief } from "@/lib/leo-executive-command";
import { getLeoAutonomyGovernance, auditLeoAutonomyGovernance } from "@/lib/leo-autonomy-governance";
import type { LeoReasoningContext } from "@/lib/ai/leo-model";

async function tenantContext(identity: LeoIdentity) {
  const organizationId = enforceLeoOrganizationScope(identity);
  if (!organizationId) throw new Error("Tenant Leo context requires an organization.");
  const [diagnostics, subscriptions, billingPlans, readiness] = await Promise.all([
    collectSupportDiagnostics("tenant", organizationId),
    supabaseServerRequest<Record<string, unknown>[]>(`organization_subscriptions?select=id,organization_id,plan_id,status,current_period_end&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=1`).catch(() => []),
    supabaseServerRequest<Record<string, unknown>[]>("billing_plans?select=id,name,status&order=created_at.asc").catch(() => []),
    supabaseServerRequest<Record<string, unknown>[]>(`agent_runtime_readiness?select=organization_id,agent_id,business_profile_ready,prompt_ready,knowledge_ready,integrations_ready,test_ready,approval_ready,workflow_ready,readiness_score,refreshed_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=refreshed_at.desc&limit=50`).catch(() => []),
  ]);
  return sanitizeSupportDiagnostics({ ...diagnostics, subscriptions, billingPlans, readiness }, "tenant", organizationId) as unknown as Record<string, unknown>;
}

function wantsDecisionIntelligence(query?: string) { return Boolean(query && /\b(trend|performance|metric|conversion|compare|comparison|anomal|declin|improv|decision|why .*chang|what changed|health|forecast|pattern|rate)\b/i.test(query)); }
function wantsOptimization(query?: string) { return Boolean(query && /\b(optimi[sz]|improve|recommend.*change|efficien|better process|fix recurring|reduce failure|reduce stale)\b/i.test(query)); }
function wantsExecutiveBrief(query?: string) { return Boolean(query && /\b(executive|brief|priority|priorities|what needs attention|what should i focus|decision needed|morning brief|operating brief)\b/i.test(query)); }

async function adminContext(identity: LeoIdentity, input: { query?: string; workspace?: string } = {}) {
  if (identity.scope !== "super_admin") throw new Error("Super-admin Leo context requires super-admin scope.");
  const diagnostics = await collectSupportDiagnostics("admin");
  const safe = sanitizeSupportDiagnostics(diagnostics as unknown as Record<string, unknown>, "admin");
  const [organizations, usage, operationalMemory, playbooks, autonomousGoals, workspacePortfolio, decisionIntelligence, optimizationProposals, executiveBrief, governance] = await Promise.all([
    supabaseServerRequest<Record<string, unknown>[]>("organizations?select=id,name,slug,status&order=created_at.desc&limit=100").catch(() => []),
    supabaseServerRequest<Record<string, unknown>[]>("usage_ledger?select=organization_id,usage_type,quantity,occurred_at&order=occurred_at.desc&limit=100").catch(() => []),
    listLeoOperationalMemories(identity, { limit: 12, includeRetired: false }).catch(() => []),
    input.query ? matchLeoOperationalPlaybooks(identity, { query: input.query, workspace: input.workspace, limit: 5 }).catch(() => []) : listLeoOperationalPlaybooks(identity).then((items) => items.filter((item) => item.status === "active").slice(0, 5)).catch(() => []),
    listLeoAutonomousGoals(identity).catch(() => []),
    listLeoWorkspacePortfolio(identity).catch(() => []),
    wantsDecisionIntelligence(input.query) ? buildLeoDecisionIntelligence({ identity, workspace: input.workspace }).then(compactLeoDecisionIntelligence).catch(() => null) : Promise.resolve(null),
    wantsOptimization(input.query) ? listLeoOptimizationProposals(identity).then((items) => items.slice(0, 8)).catch(() => []) : Promise.resolve([]),
    wantsExecutiveBrief(input.query) ? buildLeoExecutiveBrief({ identity, workspace: input.workspace, refreshOptimizations: true }).then(compactLeoExecutiveBrief).catch(() => null) : Promise.resolve(null),
    getLeoAutonomyGovernance(identity).catch(() => null),
  ]);
  return {
    diagnostics: safe,
    platform: { organizationCount: organizations.length, activeOrganizationCount: organizations.filter((item) => String(item.status || "").toLowerCase() === "active").length, recentUsageEvents: usage.length },
    operationalMemory: operationalMemory.map((memory) => ({ id: memory.id, kind: memory.kind, title: memory.title, summary: memory.summary, workspace: memory.workspace || null, organizationId: memory.organizationId || null, confidence: memory.confidence, source: memory.source, updatedAt: memory.updatedAt })),
    memoryRules: { scope: "super_admin_only", usage: "Use relevant operational memory as historical context, never as fresh execution evidence or permission.", conflictRule: "Current verified system state and explicit current user instructions override older memory." },
    operationalPlaybooks: compactLeoPlaybooksForContext(playbooks),
    playbookRules: { scope: "super_admin_only", usage: "Treat matched active playbooks as the preferred operating procedure for the objective, while still using current evidence and canonical Leo permissions.", authority: "A playbook cannot grant a tool, bypass approval, change tenant scope, or prove execution. Canonical tool policy and current evidence remain authoritative.", versioning: "Use the active version supplied in context. Never silently reconstruct retired or draft procedures from memory.", conflictRule: "Explicit current user instruction and current verified state override a playbook when they conflict, but permission and approval boundaries never weaken." },
    autonomousGoals: autonomousGoals.map((goal) => ({ id: goal.id, key: goal.key, title: goal.title, objective: goal.objective, workspace: goal.workspace || null, status: goal.status, minimumSeverity: goal.minimumSeverity, categories: goal.signalCategories, lastEvaluation: goal.lastEvaluation || null })),
    autonomousGoalHealth: summarizeLeoGoalHealth(autonomousGoals),
    autonomousGoalRules: { mode: "observe_recommend", usage: "Ongoing goals are evaluated automatically against current monitoring evidence. They may surface an intervention objective but do not themselves send messages, mutate workflows, change integrations, or bypass approvals.", intervention: "When an active goal needs action, create or continue a controlled 6K/6M operational task. Consequential steps retain canonical confirmation requirements." },
    workspacePortfolio: compactLeoWorkspacePortfolio(workspacePortfolio),
    workspacePortfolioSummary: { total: workspacePortfolio.length, owned: workspacePortfolio.filter((item) => item.relation === "owned").length, clients: workspacePortfolio.filter((item) => item.relation === "client").length },
    crossWorkspaceRules: { scope: "super_admin_only", isolation: "Every operational action must resolve to one exact organization ID before private inspection or execution. Never mix leads, campaigns, workflows, agents, memories, evidence, or approvals between workspaces.", multiWorkspace: "For an objective spanning multiple workspaces, create isolated child segments and activate only one workspace segment at a time. Each child orchestration must carry that workspace's exact organization ID.", comparison: "Cross-workspace comparison may aggregate sanitized counts or summaries, but underlying tenant records remain separately scoped and must not be exposed across tenant contexts.", precedence: "An explicit current workspace target overrides inferred workspace aliases. If the target is ambiguous, resolve it before acting." },
    decisionIntelligence,
    decisionIntelligenceRules: { evidence: "Use computed trend and anomaly evidence only within its stated coverage window. Missing history means insufficient data, not permission to estimate.", causality: "Never turn correlation or timing into a causal claim without source evidence explaining the change.", forecasting: "Do not project future revenue, conversions, campaign outcomes or reliability from sparse history. State assumptions and coverage when forecasting is explicitly requested.", action: "Decision intelligence prioritizes and recommends. Consequential action still flows through active playbooks, controlled orchestration, approval and post-action verification." },
    optimizationProposals,
    optimizationRules: { mode: "proposal_only", execution: "Optimization proposals may prepare a controlled 6M/6K intervention but never directly execute a consequential change.", rollback: "Prefer the smallest reversible change and preserve a rollback strategy before preparation.", evidence: "Do not infer an exact configuration change when evidence only establishes a symptom or correlation." },
    executiveBrief,
    autonomyGovernance: governance ? { ...governance, audit: auditLeoAutonomyGovernance(governance) } : null,
    autonomyRules: { killSwitch: "The governance kill switch blocks controlled autonomous preparation when active.", approval: "No Phase 7 layer can self-approve or downgrade canonical tool approval.", retries: "Consequential retries require evidence about the prior attempt before repetition.", humanDelegation: "7F Human Delegation & Escalation is deferred; do not invent an escalation team or assign humans automatically." },
  } as Record<string, unknown>;
}

export async function buildLeoReasoningContext(input: { identity: LeoIdentity; pageContext?: unknown; query?: string; workspace?: string }): Promise<LeoReasoningContext> {
  const base: LeoReasoningContext = { pageContext: input.pageContext, publicKnowledge: LEO_PUBLIC_KNOWLEDGE as unknown as Record<string, unknown> };
  if (input.identity.scope === "tenant") return { ...base, tenantSnapshot: await tenantContext(input.identity) };
  if (input.identity.scope === "super_admin") return { ...base, adminSnapshot: await adminContext(input.identity, { query: input.query, workspace: input.workspace }) };
  return base;
}
