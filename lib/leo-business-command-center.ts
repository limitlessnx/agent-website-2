import type { LeoIdentity } from "@/lib/leo-core";
import { buildLeoUnifiedBusinessState } from "@/lib/leo-business-state";
import { buildLeoWorkspaceKpis } from "@/lib/leo-business-kpis";
import { evaluateLeoBusinessRules } from "@/lib/leo-business-rules";
import { buildLeoOperationalCalendarSnapshot } from "@/lib/leo-operational-calendar";
import { buildLeoBusinessEventSnapshot } from "@/lib/leo-business-events";
import { listLeoWorkspacePortfolio } from "@/lib/leo-workspace-portfolio";
import { listLeoOptimizationProposals } from "@/lib/leo-autonomous-optimization";
import { listLeoAutonomousGoals, summarizeLeoGoalHealth } from "@/lib/leo-autonomous-goals";
import { listLeoWorkspaceBusinessModels } from "@/lib/leo-workspace-business-models";
import { buildLeoLifecycleOperations } from "@/lib/leo-lifecycle-operations";

export type LeoCommandCenterStatus = "healthy" | "attention" | "critical" | "unknown";

export type LeoBusinessCommandCenter = {
  generatedAt: string;
  scope: { type: "platform" | "workspace"; workspace?: string; organizationId?: string };
  status: LeoCommandCenterStatus;
  headline: string;
  metrics: {
    workspaces: number;
    activeWorkspaces: number;
    kpis: { total: number; healthy: number; attention: number; critical: number; insufficientData: number };
    risks: { matchedRules: number; blockedRecommendations: number; overdue: number; dueSoon: number; criticalEvents: number; highEvents: number };
    lifecycle: { organizations: number; critical: number; high: number; watch: number; normal: number; atRisk: number; churned: number; expansionReady: number };
    goals: ReturnType<typeof summarizeLeoGoalHealth>;
    optimizations: number;
    businessModels: number;
  };
  priorityRisks: Array<{ key: string; severity: string; title: string; detail: string; source: string }>;
  upcoming: Array<{ id: string; title: string; type: string; priority: string; dueAt: string; timing: string; workspace?: string; organizationId?: string }>;
  recentEvents: Array<{ id: string; type: string; severity: string; occurredAt: string; workspace?: string; organizationId: string; subjectType?: string; subjectId?: string }>;
  recommendations: Array<{ title: string; detail: string; source: string; requiresApproval: boolean }>;
  workspaceHealth: Array<{
    organizationId: string;
    name: string;
    slug: string;
    relation: "owned" | "client";
    status: string;
    lifecycleStage?: string;
    attention?: string;
    healthScore?: number;
    retentionRiskScore?: number;
    nextAction?: string;
  }>;
  rules: {
    authority: string;
    freshness: string;
    isolation: string;
    evidence: string;
  };
};

function severityRank(value: string) {
  return value === "critical" ? 4 : value === "high" ? 3 : value === "medium" || value === "watch" ? 2 : value === "low" ? 1 : 0;
}

export async function buildLeoBusinessCommandCenter(input: { identity: LeoIdentity; workspace?: string; organizationId?: string; now?: Date }): Promise<LeoBusinessCommandCenter> {
  if (input.identity.scope !== "super_admin") throw new Error("Business Command Center is restricted to Super Leo.");
  const now = input.now || new Date();
  const [state, kpis, businessRules, calendar, events, portfolio, optimizations, goals, businessModels, lifecycle] = await Promise.all([
    buildLeoUnifiedBusinessState({ identity: input.identity, workspace: input.workspace, organizationId: input.organizationId, now }),
    buildLeoWorkspaceKpis({ identity: input.identity, workspace: input.workspace, organizationId: input.organizationId }),
    evaluateLeoBusinessRules({ identity: input.identity, workspace: input.workspace, organizationId: input.organizationId }),
    buildLeoOperationalCalendarSnapshot({ identity: input.identity, workspace: input.workspace, organizationId: input.organizationId, now }),
    buildLeoBusinessEventSnapshot(input.identity, { workspace: input.workspace, organizationId: input.organizationId, hours: 24 }),
    listLeoWorkspacePortfolio(input.identity),
    listLeoOptimizationProposals(input.identity).catch(() => []),
    listLeoAutonomousGoals(input.identity).catch(() => []),
    listLeoWorkspaceBusinessModels(input.identity).catch(() => []),
    buildLeoLifecycleOperations({ identity: input.identity, organizationId: input.organizationId, now }).catch(() => null),
  ]);

  const priorityRisks = [
    ...(lifecycle?.attentionQueue || []).filter(item => ["critical", "high"].includes(item.attention)).map(item => ({
      key: `lifecycle:${item.organizationId}`,
      severity: item.attention,
      title: `${item.organizationName} lifecycle risk`,
      detail: item.reasons[0] || item.recommendedNextAction,
      source: "customer_lifecycle",
    })),
    ...businessRules.evaluations.filter(item => item.matched).map(item => ({ key: `rule:${item.ruleKey}`, severity: item.severity || "medium", title: item.ruleKey.replaceAll("-", " "), detail: item.recommendation || item.evidence, source: "business_rule" })),
    ...calendar.entries.filter(item => item.timing === "overdue").map(item => ({ key: `calendar:${item.id}`, severity: item.priority === "critical" ? "critical" : item.priority === "high" ? "high" : "medium", title: item.title, detail: `Overdue since ${item.dueAt}`, source: "operational_calendar" })),
    ...events.recent.filter(item => ["critical", "high"].includes(item.severity)).map(item => ({ key: `event:${item.id}`, severity: item.severity, title: item.type.replaceAll(".", " "), detail: `${item.workspace || item.organizationId} · ${item.occurredAt}`, source: "business_event" })),
  ].sort((a,b) => severityRank(b.severity) - severityRank(a.severity)).slice(0, 12);

  const recommendations: LeoBusinessCommandCenter["recommendations"] = [];
  for (const item of (lifecycle?.attentionQueue || []).slice(0, 4)) {
    recommendations.push({
      title: `${item.organizationName}: ${item.attention} attention`,
      detail: item.recommendedNextAction,
      source: "customer_lifecycle",
      requiresApproval: true,
    });
  }
  for (const item of businessRules.evaluations.filter(item => item.matched && item.recommendation).slice(0, Math.max(0, 8 - recommendations.length))) {
    recommendations.push({
      title: item.ruleKey.replaceAll("-", " "),
      detail: item.recommendation || item.evidence,
      source: "business_rule",
      requiresApproval: true,
    });
  }
  for (const proposal of optimizations.slice(0, Math.max(0, 8 - recommendations.length))) {
    recommendations.push({ title: proposal.title || "Optimization proposal", detail: proposal.recommendation || proposal.issue || "Review the prepared optimization proposal.", source: "optimization", requiresApproval: true });
  }

  const lifecycleCritical = (lifecycle?.summary.critical || 0) > 0;
  const lifecycleAttention = (lifecycle?.summary.high || 0) > 0 || (lifecycle?.summary.watch || 0) > 0;
  const status: LeoCommandCenterStatus = lifecycleCritical || priorityRisks.some(item => item.severity === "critical") || kpis.summary.critical > 0 ? "critical"
    : lifecycleAttention || priorityRisks.some(item => item.severity === "high") || kpis.summary.attention > 0 || calendar.summary.overdue > 0 ? "attention"
    : state.health === "healthy" ? "healthy" : state.health;
  const headline = status === "critical" ? "Critical operating conditions require review."
    : status === "attention" ? "The business is operating, with items requiring attention."
    : status === "healthy" ? "Business operations are within current operating thresholds."
    : "Business state is available, but evidence coverage is incomplete.";

  const scopedPortfolio = state.scope.type === "workspace" ? portfolio.filter(item => item.organizationId === state.scope.organizationId) : portfolio;
  const modelCount = state.scope.type === "workspace" ? businessModels.filter(model => model.organizationId === state.scope.organizationId || (!model.organizationId && model.status === "active")).length : businessModels.filter(model => model.status === "active").length;
  const lifecycleByOrg = new Map((lifecycle?.organizations || []).map(item => [item.organizationId, item]));

  return {
    generatedAt: now.toISOString(),
    scope: state.scope.type === "workspace" ? { type: "workspace", workspace: state.scope.workspace, organizationId: state.scope.organizationId } : { type: "platform" },
    status,
    headline,
    metrics: {
      workspaces: scopedPortfolio.length,
      activeWorkspaces: state.summary.activeWorkspaces,
      kpis: kpis.summary,
      risks: { matchedRules: businessRules.matchedRules, blockedRecommendations: businessRules.blockedRecommendations, overdue: calendar.summary.overdue, dueSoon: calendar.summary.dueSoon, criticalEvents: events.severity.critical, highEvents: events.severity.high },
      lifecycle: lifecycle?.summary || { organizations: 0, critical: 0, high: 0, watch: 0, normal: 0, atRisk: 0, churned: 0, expansionReady: 0 },
      goals: summarizeLeoGoalHealth(goals),
      optimizations: optimizations.length,
      businessModels: modelCount,
    },
    priorityRisks,
    upcoming: calendar.entries.filter(item => item.timing !== "later").slice(0, 12).map(item => ({ id: item.id, title: item.title, type: item.type, priority: item.priority, dueAt: item.dueAt, timing: item.timing, workspace: item.workspace, organizationId: item.organizationId })),
    recentEvents: events.recent.slice(0, 16).map(item => ({ id: item.id, type: item.type, severity: item.severity, occurredAt: item.occurredAt, workspace: item.workspace, organizationId: item.organizationId, subjectType: item.subjectType, subjectId: item.subjectId })),
    recommendations,
    workspaceHealth: scopedPortfolio.map(item => {
      const lifecycleItem = lifecycleByOrg.get(item.organizationId);
      return {
        organizationId: item.organizationId,
        name: item.name,
        slug: item.slug,
        relation: item.relation,
        status: item.status,
        lifecycleStage: lifecycleItem?.stage,
        attention: lifecycleItem?.attention,
        healthScore: lifecycleItem?.healthScore,
        retentionRiskScore: lifecycleItem?.retentionRiskScore,
        nextAction: lifecycleItem?.recommendedNextAction,
      };
    }),
    rules: {
      authority: "The Command Center is a read-only executive operating view. It cannot execute actions, approve itself, or override canonical Leo permissions.",
      freshness: "Every snapshot carries generatedAt. Rebuild before consequential decisions when source state may have changed.",
      isolation: "Workspace views resolve to one exact organization ID. Platform views may aggregate safe summaries but never merge private tenant records.",
      evidence: "Counts and recommendations are derived from current Fluxknight state, KPIs, customer lifecycle, business rules, calendar and event evidence. Missing evidence is not estimated.",
    },
  };
}

export function compactLeoBusinessCommandCenter(snapshot: LeoBusinessCommandCenter) {
  return { generatedAt: snapshot.generatedAt, scope: snapshot.scope, status: snapshot.status, headline: snapshot.headline, metrics: snapshot.metrics, priorityRisks: snapshot.priorityRisks.slice(0, 8), upcoming: snapshot.upcoming.slice(0, 8), recentEvents: snapshot.recentEvents.slice(0, 8), recommendations: snapshot.recommendations.slice(0, 6), workspaceHealth: snapshot.workspaceHealth.slice(0, 20), rules: snapshot.rules };
}
