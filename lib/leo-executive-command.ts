import type { LeoIdentity } from "@/lib/leo-core";
import { buildLeoDecisionIntelligence } from "@/lib/leo-decision-intelligence";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";
import { listLeoAutonomousGoals, summarizeLeoGoalHealth } from "@/lib/leo-autonomous-goals";
import { listLeoOperationalMemories } from "@/lib/leo-operational-memory";
import { listLeoOptimizationProposals, refreshLeoOptimizationProposals } from "@/lib/leo-autonomous-optimization";
import { listLeoWorkspacePortfolio, resolveLeoWorkspaceTarget } from "@/lib/leo-workspace-portfolio";
import { getLeoAutonomyGovernance, auditLeoAutonomyGovernance } from "@/lib/leo-autonomy-governance";

export type LeoExecutiveBrief = {
  generatedAt: string;
  scope: { type: "platform" | "workspace"; organizationId?: string; workspace?: string };
  headline: string;
  decisionsNeeded: Array<{ title: string; reason: string; sourceId: string }>;
  criticalRisks: Array<{ severity: string; title: string; summary: string; workspace?: string; sourceId: string }>;
  goalsOffTrack: Array<{ id: string; title: string; state: string; matchingSignals: number }>;
  completedWork: Array<{ id: string; title: string; summary: string; confidence: number }>;
  recommendedImprovements: Array<{ id: string; title: string; issue: string; expectedImpact: string; riskLevel: string }>;
  portfolio: { total: number; owned: number; clients: number; active: number };
  metrics: Record<string, unknown>;
  governance: { killSwitch: boolean; globalEnabled: boolean; auditPassed: boolean; consequentialAutonomousExecution: false };
  rules: { evidence: string; financialBoundary: string; actionBoundary: string };
};

export async function buildLeoExecutiveBrief(input: { identity: LeoIdentity; workspace?: string; organizationId?: string; refreshOptimizations?: boolean }): Promise<LeoExecutiveBrief> {
  if (input.identity.scope !== "super_admin") throw new Error("Executive command is restricted to Super Leo.");
  let targetOrganizationId = input.organizationId;
  let targetWorkspace = input.workspace;
  if (!targetOrganizationId && input.workspace) {
    const target = await resolveLeoWorkspaceTarget(input.identity, input.workspace).catch(() => null);
    if (target) { targetOrganizationId = target.organizationId; targetWorkspace = target.name; }
  }
  const [intelligence, signalSnapshot, goals, memories, portfolio, governance] = await Promise.all([
    buildLeoDecisionIntelligence({ identity: input.identity, workspace: targetWorkspace, organizationId: targetOrganizationId }),
    scanLeoProactiveSignals({ limit: 100 }),
    listLeoAutonomousGoals(input.identity, true),
    listLeoOperationalMemories(input.identity, { limit: 60, includeRetired: false, organizationId: targetOrganizationId }).catch(() => []),
    listLeoWorkspacePortfolio(input.identity),
    getLeoAutonomyGovernance(input.identity),
  ]);
  const optimizations = input.refreshOptimizations === false
    ? await listLeoOptimizationProposals(input.identity).catch(() => [])
    : await refreshLeoOptimizationProposals({ identity: input.identity, workspace: targetWorkspace, organizationId: targetOrganizationId }).catch(() => listLeoOptimizationProposals(input.identity));
  const scopedSignals = targetOrganizationId
    ? signalSnapshot.signals.filter((signal) => signal.workspace === targetOrganizationId || (/limitless|realty/i.test(targetWorkspace || "") && signal.workspace === "limitless_realty"))
    : signalSnapshot.signals;
  const scopedGoals = targetOrganizationId
    ? goals.filter((goal) => !goal.organizationId || goal.organizationId === targetOrganizationId || (/limitless|realty/i.test(targetWorkspace || "") && goal.workspace === "limitless_realty"))
    : goals;
  const goalHealth = summarizeLeoGoalHealth(scopedGoals);
  const criticalRisks = scopedSignals.filter((signal) => signal.severity === "critical" || signal.severity === "high").slice(0, 8).map((signal) => ({ severity: signal.severity, title: signal.title, summary: signal.summary, workspace: signal.workspace, sourceId: signal.id }));
  const goalsOffTrack = scopedGoals.filter((goal) => goal.lastEvaluation && goal.lastEvaluation.state !== "healthy").slice(0, 8).map((goal) => ({ id: goal.id, title: goal.title, state: goal.lastEvaluation!.state, matchingSignals: goal.lastEvaluation!.matchingSignals }));
  const activeOptimizations = optimizations.filter((item) => item.status === "active" || item.status === "prepared").slice(0, 8);
  const decisionsNeeded = activeOptimizations.filter((item) => item.riskLevel === "high" || item.status === "prepared").slice(0, 6).map((item) => ({ title: item.title, reason: item.status === "prepared" ? "A controlled intervention has been prepared and may reach an approval checkpoint." : `${item.issue} Recommended change remains proposal-only until reviewed.`, sourceId: item.id }));
  const completedWork = memories.filter((memory) => memory.kind === "outcome").slice(0, 8).map((memory) => ({ id: memory.id, title: memory.title, summary: memory.summary, confidence: memory.confidence }));
  const activePortfolio = portfolio.filter((item) => ["active","live"].includes(item.status.toLowerCase())).length;
  const pressure = criticalRisks.length + goalsOffTrack.length + activeOptimizations.filter((item) => item.riskLevel === "high").length;
  const headline = pressure > 0
    ? `${pressure} priority operating item${pressure === 1 ? "" : "s"} need attention across current evidence.`
    : "No high-priority operating exception is visible in the current evidence snapshot.";
  const governanceAudit = auditLeoAutonomyGovernance(governance);
  return {
    generatedAt: new Date().toISOString(),
    scope: targetOrganizationId ? { type: "workspace", organizationId: targetOrganizationId, workspace: targetWorkspace } : { type: "platform" },
    headline,
    decisionsNeeded,
    criticalRisks,
    goalsOffTrack,
    completedWork,
    recommendedImprovements: activeOptimizations.map((item) => ({ id: item.id, title: item.title, issue: item.issue, expectedImpact: item.expectedImpact, riskLevel: item.riskLevel })),
    portfolio: { total: portfolio.length, owned: portfolio.filter((item) => item.relation === "owned").length, clients: portfolio.filter((item) => item.relation === "client").length, active: activePortfolio },
    metrics: intelligence.metrics,
    governance: { killSwitch: governance.killSwitch, globalEnabled: governance.globalEnabled, auditPassed: governanceAudit.passed, consequentialAutonomousExecution: false },
    rules: {
      evidence: "Executive command summarizes current verified platform evidence, persisted outcomes and bounded recommendations. Missing data is not estimated.",
      financialBoundary: "Do not invent revenue, profit, conversion value or financial forecasts when authoritative financial data is absent.",
      actionBoundary: "The brief can prioritize and prepare controlled work, but consequential execution still requires canonical 6K/6M approvals and evidence verification.",
    },
  };
}

export function compactLeoExecutiveBrief(brief: LeoExecutiveBrief) {
  return { generatedAt: brief.generatedAt, scope: brief.scope, headline: brief.headline, decisionsNeeded: brief.decisionsNeeded.slice(0, 5), criticalRisks: brief.criticalRisks.slice(0, 5), goalsOffTrack: brief.goalsOffTrack.slice(0, 5), completedWork: brief.completedWork.slice(0, 5), recommendedImprovements: brief.recommendedImprovements.slice(0, 5), portfolio: brief.portfolio, governance: brief.governance, rules: brief.rules };
}
