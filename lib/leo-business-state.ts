import type { LeoIdentity } from "@/lib/leo-core";
import { listLeoWorkspacePortfolio, resolveLeoWorkspaceTarget, type LeoWorkspaceTarget } from "@/lib/leo-workspace-portfolio";
import { listLeoAutonomousGoals, summarizeLeoGoalHealth } from "@/lib/leo-autonomous-goals";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";
import { getWorkflowRuns, getWorkflows } from "@/lib/workflow-registry";
import { getLeads, type Lead } from "@/lib/limitless-data";
import { getDetailedCampaignReports, type DetailedCampaignReport } from "@/lib/campaign-report-reader";
import { createAdminClient } from "@/lib/supabase/admin";

export type LeoBusinessStateScope = {
  type: "platform" | "workspace";
  organizationId?: string;
  workspace?: string;
  relation?: "owned" | "client";
};

export type LeoBusinessState = {
  generatedAt: string;
  scope: LeoBusinessStateScope;
  health: "healthy" | "attention" | "critical" | "unknown";
  summary: {
    activeWorkspaces: number;
    leads?: { total: number; qualified: number; staleQualified: number };
    campaigns?: { total: number; accepted: number; delivered: number; read: number; failed: number; unresolved: number };
    workflows: { total: number; active: number; error: number; recentFailedRuns: number };
    integrations: { total: number; unhealthy: number };
    goals: ReturnType<typeof summarizeLeoGoalHealth>;
    signals: { total: number; critical: number; high: number; medium: number; low: number };
  };
  entities: {
    workspaces: Array<{ organizationId: string; name: string; slug: string; status: string; relation: "owned" | "client" }>;
    unhealthyIntegrations: Array<{ id: string; organizationId: string; provider: string; displayName?: string; status: string }>;
  };
  rules: {
    sourceOfTruth: string;
    freshness: string;
    isolation: string;
  };
};

function isLimitless(target?: LeoWorkspaceTarget | null, workspace?: string) {
  return /limitless|realty|maia/i.test(`${target?.name || ""} ${target?.slug || ""} ${target?.aliases?.join(" ") || ""} ${workspace || ""}`);
}
function qualifiedLead(lead: Lead) {
  const status = String(lead.status || "").toLowerCase();
  const score = String(lead.score || "").toLowerCase();
  return ["qualified", "hot", "ready", "ready_to_buy"].includes(status) || score === "hot";
}
function staleLead(lead: Lead, now: number) {
  const raw = String(lead.last_contacted_at || lead.last_follow_up_at || lead.created_at || "");
  const ts = raw ? Date.parse(raw) : Number.NaN;
  return !Number.isFinite(ts) || now - ts > 24 * 60 * 60 * 1000;
}
function integrationUnhealthy(status: string) {
  return ["error", "disconnected", "expired", "failed", "invalid", "revoked"].includes(status.toLowerCase());
}

export async function buildLeoUnifiedBusinessState(input: { identity: LeoIdentity; workspace?: string; organizationId?: string; now?: Date }): Promise<LeoBusinessState> {
  if (input.identity.scope !== "super_admin") throw new Error("Unified business state is restricted to Super Leo.");
  const now = input.now || new Date();
  let target: LeoWorkspaceTarget | null = null;
  if (input.organizationId || input.workspace) target = await resolveLeoWorkspaceTarget(input.identity, input.organizationId || input.workspace || "").catch(() => null);
  const limitless = isLimitless(target, input.workspace);

  const admin = createAdminClient();
  const [portfolio, goals, signalSnapshot, workflows, runs, integrationsResult, leads, campaigns] = await Promise.all([
    listLeoWorkspacePortfolio(input.identity).catch(() => []),
    listLeoAutonomousGoals(input.identity).catch(() => []),
    scanLeoProactiveSignals({ limit: 100, now }).catch(() => ({ generatedAt: now.toISOString(), total: 0, critical: 0, high: 0, medium: 0, low: 0, audit: {}, signals: [] })),
    getWorkflows(250, true).catch(() => []),
    getWorkflowRuns(500).catch(() => []),
    admin.from("organization_integrations").select("id,organization_id,provider,display_name,status").limit(500),
    limitless || !target ? getLeads(800).catch(() => [] as Lead[]) : Promise.resolve([] as Lead[]),
    limitless || !target ? getDetailedCampaignReports(150).catch(() => [] as DetailedCampaignReport[]) : Promise.resolve([] as DetailedCampaignReport[]),
  ]);

  const organizationId = target?.organizationId;
  const scopedWorkspaces = target ? portfolio.filter((item) => item.organizationId === organizationId) : portfolio;
  const scopedGoals = target ? goals.filter((goal) => !goal.organizationId || goal.organizationId === organizationId || (limitless && goal.workspace === "limitless_realty")) : goals;
  const scopedSignals = target ? signalSnapshot.signals.filter((signal) => signal.workspace === organizationId || (limitless && signal.workspace === "limitless_realty")) : signalSnapshot.signals;
  const scopedWorkflows = target ? workflows.filter((item) => item.organization_id === organizationId || item.organization_uuid === organizationId) : workflows;
  const scopedRuns = target ? runs.filter((item) => item.organization_id === organizationId || item.organization_uuid === organizationId) : runs;
  const integrations = (integrationsResult.error ? [] : integrationsResult.data || []).map((item) => ({
    id: String(item.id), organizationId: String(item.organization_id), provider: String(item.provider || "unknown"), displayName: item.display_name ? String(item.display_name) : undefined, status: String(item.status || "unknown"),
  }));
  const scopedIntegrations = target ? integrations.filter((item) => item.organizationId === organizationId) : integrations;
  const unhealthyIntegrations = scopedIntegrations.filter((item) => integrationUnhealthy(item.status));

  const qualified = leads.filter(qualifiedLead);
  const staleQualified = qualified.filter((lead) => staleLead(lead, now.getTime()));
  const campaignSummary = campaigns.reduce((acc, item) => {
    acc.total += 1;
    acc.accepted += item.accepted;
    acc.delivered += item.delivered;
    acc.read += item.read;
    acc.failed += item.failed;
    acc.unresolved += item.unresolved;
    return acc;
  }, { total: 0, accepted: 0, delivered: 0, read: 0, failed: 0, unresolved: 0 });
  const goalHealth = summarizeLeoGoalHealth(scopedGoals);
  const recentFailedRuns = scopedRuns.filter((run) => ["failed", "timed_out"].includes(String(run.status))).filter((run) => {
    const raw = run.created_at || run.started_at || run.completed_at;
    const ts = raw ? Date.parse(String(raw)) : Number.NaN;
    return Number.isFinite(ts) && now.getTime() - ts <= 24 * 60 * 60 * 1000;
  }).length;
  const signalCounts = {
    total: scopedSignals.length,
    critical: scopedSignals.filter((item) => item.severity === "critical").length,
    high: scopedSignals.filter((item) => item.severity === "high").length,
    medium: scopedSignals.filter((item) => item.severity === "medium").length,
    low: scopedSignals.filter((item) => item.severity === "low").length,
  };
  const health: LeoBusinessState["health"] = signalCounts.critical > 0 || scopedWorkflows.some((item) => item.status === "error") ? "critical" : signalCounts.high > 0 || goalHealth.critical > 0 || goalHealth.attention > 0 || unhealthyIntegrations.length > 0 ? "attention" : scopedSignals.length || scopedWorkflows.length || scopedGoals.length ? "healthy" : "unknown";

  return {
    generatedAt: now.toISOString(),
    scope: target ? { type: "workspace", organizationId: target.organizationId, workspace: target.name, relation: target.relation } : { type: "platform" },
    health,
    summary: {
      activeWorkspaces: scopedWorkspaces.filter((item) => ["active", "live"].includes(item.status.toLowerCase())).length,
      ...(limitless || !target ? { leads: { total: leads.length, qualified: qualified.length, staleQualified: staleQualified.length }, campaigns: campaignSummary } : {}),
      workflows: { total: scopedWorkflows.length, active: scopedWorkflows.filter((item) => ["active", "live", "enabled"].includes(String(item.status).toLowerCase())).length, error: scopedWorkflows.filter((item) => item.status === "error").length, recentFailedRuns },
      integrations: { total: scopedIntegrations.length, unhealthy: unhealthyIntegrations.length },
      goals: goalHealth,
      signals: signalCounts,
    },
    entities: {
      workspaces: scopedWorkspaces.map((item) => ({ organizationId: item.organizationId, name: item.name, slug: item.slug, status: item.status, relation: item.relation })),
      unhealthyIntegrations,
    },
    rules: {
      sourceOfTruth: "This state is assembled from authoritative Fluxknight runtime sources. It does not replace those source systems and must not be used to mutate them directly.",
      freshness: "generatedAt records when the snapshot was assembled. Rebuild before consequential decisions when the current state may have changed.",
      isolation: "Workspace-scoped state is pinned to one exact organization ID. Cross-workspace summaries may aggregate counts but must not blend private tenant records.",
    },
  };
}

export function compactLeoUnifiedBusinessState(state: LeoBusinessState) {
  return { generatedAt: state.generatedAt, scope: state.scope, health: state.health, summary: state.summary, entities: { workspaces: state.entities.workspaces, unhealthyIntegrations: state.entities.unhealthyIntegrations.slice(0, 10) }, rules: state.rules };
}
