import { createHash } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoIdentity } from "@/lib/leo-core";
import { buildLeoDecisionIntelligence, type LeoDecisionInsight } from "@/lib/leo-decision-intelligence";
import { listLeoAutonomousGoals } from "@/lib/leo-autonomous-goals";
import { getLeoAutonomyGovernance, canLeoCreateControlledIntervention } from "@/lib/leo-autonomy-governance";
import { createLeoMultiAgentOrchestration, refreshLeoMultiAgentOrchestration } from "@/lib/leo-multi-agent-orchestrator";
import type { LeoSessionState } from "@/lib/leo-session-store";

export type LeoOptimizationStatus = "active" | "prepared" | "dismissed" | "superseded";
export type LeoOptimizationProposal = {
  id: string;
  status: LeoOptimizationStatus;
  category: "lead" | "campaign" | "workflow" | "goal" | "integration" | "workspace" | "portfolio";
  title: string;
  issue: string;
  workspace?: string;
  organizationId?: string;
  evidence: Record<string, unknown>;
  recommendation: string;
  interventionObjective: string;
  expectedImpact: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  rollbackStrategy: string;
  approvalRequirement: string;
  sourceIds: string[];
  createdAt: string;
  updatedAt: string;
  orchestrationId?: string;
  taskId?: string;
};

type StoredRow = { id?: string; content?: string | Record<string, unknown> };
const ROLE = "leo_optimization_proposal";
const PREFIX = "leo_optimization:";
function stableId(parts: unknown[]) { return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24); }
function parse(row?: StoredRow): LeoOptimizationProposal | null { try { const v = typeof row?.content === "string" ? JSON.parse(row.content) : row?.content; return v && typeof v === "object" && !Array.isArray(v) && (v as LeoOptimizationProposal).id ? v as LeoOptimizationProposal : null; } catch { return null; } }
function riskFor(insight: LeoDecisionInsight): LeoOptimizationProposal["riskLevel"] { if (insight.area === "campaigns" || insight.area === "workflows") return insight.severity === "high" ? "high" : "medium"; return insight.severity === "high" ? "medium" : "low"; }
function categoryFor(area: LeoDecisionInsight["area"]): LeoOptimizationProposal["category"] { return area === "leads" ? "lead" : area === "campaigns" ? "campaign" : area === "workflows" ? "workflow" : area === "goals" ? "goal" : area === "portfolio" ? "portfolio" : "workspace"; }
function impactFor(insight: LeoDecisionInsight) {
  if (insight.area === "leads") return "Reduce preventable lead-response delay while preserving review of each lead history before outreach.";
  if (insight.area === "campaigns") return "Improve campaign delivery reliability by isolating provider or recipient problems before any resend decision.";
  if (insight.area === "workflows") return "Improve workflow reliability by identifying the failing path and applying the smallest reversible correction.";
  if (insight.area === "goals") return "Return ongoing operational goals toward healthy state using current evidence and the active playbook.";
  return "Reduce current operational pressure using the smallest evidence-backed change.";
}
function rollbackFor(insight: LeoDecisionInsight) {
  if (insight.area === "campaigns") return "Do not resend by default. If a later approved routing/configuration change performs worse, restore the prior known configuration and re-check recipient-level evidence.";
  if (insight.area === "workflows") return "Preserve the previous workflow configuration. If the approved change introduces regression, revert it and verify the prior execution path before another attempt.";
  return "Keep the current state as the rollback reference and reverse any later approved change if verification shows regression.";
}
async function persist(proposal: LeoOptimizationProposal) {
  const userId = `${PREFIX}${proposal.id}`;
  const existing = await supabaseServerRequest<Array<{ id: string }>>(`bot_sessions?select=id&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => []);
  const body = JSON.stringify({ role: ROLE, user_id: userId, content: JSON.stringify(proposal), created_at: proposal.createdAt });
  if (existing[0]?.id) await supabaseServerRequest(`bot_sessions?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
  else await supabaseServerRequest("bot_sessions", { method: "POST", body });
  return proposal;
}

export async function listLeoOptimizationProposals(identity: LeoIdentity, includeInactive = false) {
  if (identity.scope !== "super_admin") return [];
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=id,content&role=eq.${ROLE}&order=created_at.desc&limit=250`).catch(() => []);
  return rows.map(parse).filter((item): item is LeoOptimizationProposal => Boolean(item)).filter((item) => includeInactive || ["active","prepared"].includes(item.status));
}

export async function refreshLeoOptimizationProposals(input: { identity: LeoIdentity; workspace?: string; organizationId?: string }) {
  if (input.identity.scope !== "super_admin") throw new Error("Autonomous optimization is restricted to Super Leo.");
  const governance = await getLeoAutonomyGovernance(input.identity);
  if (!governance.globalEnabled || governance.killSwitch || !governance.observeRecommend) return [];
  const [snapshot, goals, existing] = await Promise.all([
    buildLeoDecisionIntelligence({ identity: input.identity, workspace: input.workspace, organizationId: input.organizationId }),
    listLeoAutonomousGoals(input.identity, true).catch(() => []),
    listLeoOptimizationProposals(input.identity, true),
  ]);
  const old = new Map(existing.map((item) => [item.id, item]));
  const candidates = snapshot.insights.filter((insight) => insight.severity === "high" || insight.severity === "watch").slice(0, governance.maxProposalsPerCycle);
  const proposals: LeoOptimizationProposal[] = [];
  for (const insight of candidates) {
    const id = stableId([snapshot.scope.organizationId || snapshot.scope.workspace || "platform", insight.id]);
    const previous = old.get(id);
    const createdAt = previous?.createdAt || snapshot.generatedAt;
    const proposal: LeoOptimizationProposal = {
      id,
      status: previous?.status === "dismissed" ? "dismissed" : previous?.status === "prepared" ? "prepared" : "active",
      category: categoryFor(insight.area),
      title: insight.title,
      issue: insight.finding,
      workspace: snapshot.scope.workspace,
      organizationId: snapshot.scope.organizationId,
      evidence: insight.evidence,
      recommendation: insight.recommendation,
      interventionObjective: `${insight.recommendation} Investigate current evidence, prepare only the smallest reversible improvement, and do not execute any consequential change without canonical approval.`,
      expectedImpact: impactFor(insight),
      confidence: insight.severity === "high" ? 0.9 : 0.78,
      riskLevel: riskFor(insight),
      rollbackStrategy: rollbackFor(insight),
      approvalRequirement: "Proposal only. Any consequential action must be converted into a controlled 6M/6K operation and retain the tool registry's exact approval requirement.",
      sourceIds: [insight.id, ...goals.filter((goal) => goal.lastEvaluation && goal.lastEvaluation.state !== "healthy").map((goal) => goal.id)].slice(0, 8),
      createdAt,
      updatedAt: new Date().toISOString(),
      orchestrationId: previous?.orchestrationId,
      taskId: previous?.taskId,
    };
    proposals.push(await persist(proposal));
  }
  return proposals.filter((item) => item.status !== "dismissed");
}

export async function dismissLeoOptimizationProposal(identity: LeoIdentity, id: string) {
  const proposals = await listLeoOptimizationProposals(identity, true);
  const current = proposals.find((item) => item.id === id);
  if (!current) throw new Error("Optimization proposal was not found.");
  return persist({ ...current, status: "dismissed", updatedAt: new Date().toISOString() });
}

export async function prepareLeoOptimizationIntervention(input: { identity: LeoIdentity; session: LeoSessionState; proposalId: string }) {
  if (input.identity.scope !== "super_admin") throw new Error("Autonomous optimization is restricted to Super Leo.");
  const proposals = await listLeoOptimizationProposals(input.identity, true);
  const proposal = proposals.find((item) => item.id === input.proposalId);
  if (!proposal || proposal.status === "dismissed" || proposal.status === "superseded") throw new Error("Active optimization proposal was not found.");
  const governance = await getLeoAutonomyGovernance(input.identity);
  const gate = canLeoCreateControlledIntervention(governance, proposal.organizationId);
  if (!gate.allowed) throw new Error(gate.reason);
  const created = await createLeoMultiAgentOrchestration({ identity: input.identity, session: input.session, objective: proposal.interventionObjective, workspace: proposal.workspace, organizationId: proposal.organizationId, context: { optimization_id: proposal.id, optimization_risk: proposal.riskLevel, source_ids: proposal.sourceIds, rollback_strategy: proposal.rollbackStrategy } });
  const refreshed = await refreshLeoMultiAgentOrchestration({ identity: input.identity, session: input.session, orchestration: created });
  const updated = await persist({ ...proposal, status: "prepared", orchestrationId: created.id, taskId: created.taskId, updatedAt: new Date().toISOString() });
  return { proposal: updated, orchestration: refreshed.orchestration, task: refreshed.task, governanceGate: gate };
}

export function auditLeoOptimizationProposal(proposal: LeoOptimizationProposal) {
  return {
    proposalOnly: /Proposal only/i.test(proposal.approvalRequirement),
    rollbackDefined: Boolean(proposal.rollbackStrategy),
    evidenceAttached: Object.keys(proposal.evidence || {}).length > 0,
    controlledExecutionBoundary: /controlled 6M\/6K/i.test(proposal.approvalRequirement),
  };
}
