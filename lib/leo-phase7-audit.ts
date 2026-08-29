import type { LeoIdentity } from "@/lib/leo-core";
import { getLeoAutonomyGovernance, auditLeoAutonomyGovernance } from "@/lib/leo-autonomy-governance";
import { listLeoAutonomousGoals } from "@/lib/leo-autonomous-goals";
import { listLeoOptimizationProposals, auditLeoOptimizationProposal } from "@/lib/leo-autonomous-optimization";
import { listLeoOperationalMemories } from "@/lib/leo-operational-memory";
import { listLeoWorkspacePortfolio } from "@/lib/leo-workspace-portfolio";

export type LeoPhase7Audit = {
  generatedAt: string;
  version: "7J-1";
  status: "pass" | "warn" | "fail";
  roadmap: Record<string, "closed" | "deferred">;
  checks: Record<string, { passed: boolean; detail: string }>;
  counts: Record<string, number>;
};

export async function auditLeoPhase7(input: { identity: LeoIdentity }): Promise<LeoPhase7Audit> {
  if (input.identity.scope !== "super_admin") throw new Error("Phase 7 audit is restricted to Super Leo.");
  const [governance, goals, proposals, memories, portfolio] = await Promise.all([
    getLeoAutonomyGovernance(input.identity),
    listLeoAutonomousGoals(input.identity, true),
    listLeoOptimizationProposals(input.identity, true),
    listLeoOperationalMemories(input.identity, { limit: 250, includeRetired: true }),
    listLeoWorkspacePortfolio(input.identity),
  ]);
  const governanceAudit = auditLeoAutonomyGovernance(governance);
  const proposalAudits = proposals.map(auditLeoOptimizationProposal);
  const checks = {
    operationalMemoryBounded: { passed: memories.every((memory) => memory.confidence >= 0 && memory.confidence <= 1 && Boolean(memory.source?.type)), detail: "Operational memory remains provenance-tagged and confidence-bounded; current state still overrides historical memory." },
    autonomousGoalsObserveRecommend: { passed: goals.every((goal) => goal.autonomy === "observe_recommend"), detail: "Ongoing goals observe, evaluate and recommend; they do not directly execute consequential work." },
    optimizationProposalOnly: { passed: proposalAudits.every((audit) => audit.proposalOnly && audit.rollbackDefined && audit.controlledExecutionBoundary), detail: "Optimization remains proposal-first with rollback guidance and a controlled 6M/6K bridge." },
    governanceSafeDefaults: { passed: governanceAudit.passed, detail: "Kill switch, no-self-approval, canonical approval, exact workspace and evidence-before-retry controls are active." },
    consequentialAutonomyDisabled: { passed: governance.consequentialAutonomousExecution === false, detail: "Phase 7 does not grant autonomous consequential execution." },
    workspacePortfolioResolvable: { passed: portfolio.every((workspace) => Boolean(workspace.organizationId) && ["owned","client"].includes(workspace.relation)), detail: "Cross-workspace operations retain exact organization identity and owned/client classification." },
    humanEscalationDeferred: { passed: true, detail: "7F Human Delegation & Escalation is intentionally deferred. No escalation team or automatic human assignment is introduced by 7G-7J." },
  };
  const failed = Object.values(checks).filter((item) => !item.passed).length;
  const status: LeoPhase7Audit["status"] = failed ? "fail" : proposals.length === 0 || goals.some((goal) => !goal.lastEvaluation) ? "warn" : "pass";
  return {
    generatedAt: new Date().toISOString(),
    version: "7J-1",
    status,
    roadmap: { "7A": "closed", "7B": "closed", "7C": "closed", "7D": "closed", "7E": "closed", "7F": "deferred", "7G": "closed", "7H": "closed", "7I": "closed", "7J": "closed" },
    checks,
    counts: { goals: goals.length, optimizationProposals: proposals.length, memories: memories.length, workspaces: portfolio.length, failedChecks: failed },
  };
}
