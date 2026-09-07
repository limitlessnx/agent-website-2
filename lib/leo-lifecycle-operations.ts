import type { LeoIdentity } from "@/lib/leo-core";
import { getUnifiedLifecycleSnapshots, type UnifiedLifecycleSnapshot } from "@/lib/lifecycle-intelligence";

export type LeoLifecycleOperationsSnapshot = {
  generatedAt: string;
  scope: { type: "platform" | "workspace"; organizationId?: string; organizationName?: string };
  summary: {
    organizations: number;
    critical: number;
    high: number;
    watch: number;
    normal: number;
    atRisk: number;
    churned: number;
    expansionReady: number;
  };
  attentionQueue: Array<{
    organizationId: string;
    organizationName: string;
    stage: UnifiedLifecycleSnapshot["stage"];
    attention: UnifiedLifecycleSnapshot["attention"];
    healthScore: number;
    retentionRiskScore: number;
    unresolvedSupportCases: number;
    connectedIntegrations: number;
    reasons: string[];
    recommendedNextAction: string;
  }>;
  expansionQueue: Array<{
    organizationId: string;
    organizationName: string;
    opportunityScore: number;
    opportunityCount: number;
    healthScore: number;
    retentionRiskScore: number;
    recommendedNextAction: string;
  }>;
  organizations: UnifiedLifecycleSnapshot[];
  rules: {
    authority: string;
    evidence: string;
    prioritization: string;
  };
};

const attentionRank: Record<UnifiedLifecycleSnapshot["attention"], number> = {
  critical: 4,
  high: 3,
  watch: 2,
  normal: 1,
};

function matchesOrganization(item: UnifiedLifecycleSnapshot, organizationId?: string) {
  return !organizationId || item.organizationId === organizationId;
}

export async function buildLeoLifecycleOperations(input: {
  identity: LeoIdentity;
  organizationId?: string;
  periodDays?: number;
  now?: Date;
}): Promise<LeoLifecycleOperationsSnapshot> {
  if (input.identity.scope !== "super_admin") throw new Error("Lifecycle operational intelligence is restricted to Super Leo.");

  const generatedAt = (input.now || new Date()).toISOString();
  const all = await getUnifiedLifecycleSnapshots(input.periodDays || 30);
  const organizations = all.filter((item) => matchesOrganization(item, input.organizationId));
  const selected = organizations[0];

  if (input.organizationId && !selected) {
    throw new Error("Organization lifecycle evidence was not found.");
  }

  const attentionQueue = organizations
    .filter((item) => item.attention !== "normal" || item.stage === "risk" || item.stage === "churned")
    .sort((a, b) => attentionRank[b.attention] - attentionRank[a.attention] || b.retentionRiskScore - a.retentionRiskScore)
    .map((item) => ({
      organizationId: item.organizationId,
      organizationName: item.organizationName,
      stage: item.stage,
      attention: item.attention,
      healthScore: item.healthScore,
      retentionRiskScore: item.retentionRiskScore,
      unresolvedSupportCases: item.unresolvedSupportCases,
      connectedIntegrations: item.connectedIntegrations,
      reasons: item.reasons.slice(0, 5),
      recommendedNextAction: item.recommendedNextAction,
    }));

  const expansionQueue = organizations
    .filter((item) => item.stage === "expansion" && !["high", "critical"].includes(item.attention) && item.opportunityScore > 0)
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .map((item) => ({
      organizationId: item.organizationId,
      organizationName: item.organizationName,
      opportunityScore: item.opportunityScore,
      opportunityCount: item.opportunityCount,
      healthScore: item.healthScore,
      retentionRiskScore: item.retentionRiskScore,
      recommendedNextAction: item.recommendedNextAction,
    }));

  return {
    generatedAt,
    scope: selected && input.organizationId
      ? { type: "workspace", organizationId: selected.organizationId, organizationName: selected.organizationName }
      : { type: "platform" },
    summary: {
      organizations: organizations.length,
      critical: organizations.filter((item) => item.attention === "critical").length,
      high: organizations.filter((item) => item.attention === "high").length,
      watch: organizations.filter((item) => item.attention === "watch").length,
      normal: organizations.filter((item) => item.attention === "normal").length,
      atRisk: organizations.filter((item) => item.stage === "risk").length,
      churned: organizations.filter((item) => item.stage === "churned").length,
      expansionReady: expansionQueue.length,
    },
    attentionQueue,
    expansionQueue,
    organizations,
    rules: {
      authority: "Lifecycle operational intelligence is read-only. It can prioritize and recommend, but it cannot execute account, billing, support, integration or outreach changes.",
      evidence: "Leo must explain recommendations using current lifecycle evidence. Missing activity, value, revenue or cause is reported as unavailable rather than estimated.",
      prioritization: "Customer risk overrides expansion. High or critical attention removes an organization from the expansion-ready queue until the operating risk is addressed.",
    },
  };
}

export function answerLeoLifecycleQuestion(snapshot: LeoLifecycleOperationsSnapshot, question: string) {
  const normalized = question.trim().toLowerCase();
  const scoped = snapshot.scope.type === "workspace" ? snapshot.organizations[0] : null;

  if (scoped && (normalized.includes("why") || normalized.includes("risk") || normalized.includes("attention"))) {
    return {
      type: "workspace_risk_explanation",
      answer: scoped.reasons.length
        ? `${scoped.organizationName} is ${scoped.attention} attention in the ${scoped.stage} lifecycle stage because ${scoped.reasons.join(" ")}`
        : `${scoped.organizationName} currently has no recorded lifecycle reason requiring elevated attention.`,
      evidence: {
        healthScore: scoped.healthScore,
        retentionRiskScore: scoped.retentionRiskScore,
        unresolvedSupportCases: scoped.unresolvedSupportCases,
        connectedIntegrations: scoped.connectedIntegrations,
      },
      recommendedNextAction: scoped.recommendedNextAction,
    };
  }

  if (normalized.includes("expansion") || normalized.includes("growth") || normalized.includes("upsell")) {
    return {
      type: "expansion_ready",
      answer: snapshot.expansionQueue.length
        ? `${snapshot.expansionQueue.length} organization${snapshot.expansionQueue.length === 1 ? " is" : "s are"} currently expansion-ready without a conflicting high-risk signal.`
        : "No organization currently qualifies as expansion-ready without a conflicting high-risk signal.",
      organizations: snapshot.expansionQueue.slice(0, 10),
    };
  }

  if (normalized.includes("next action") || normalized.includes("what should") || normalized.includes("do next")) {
    return {
      type: "next_actions",
      answer: snapshot.attentionQueue.length
        ? `Start with ${snapshot.attentionQueue[0].organizationName}: ${snapshot.attentionQueue[0].recommendedNextAction}`
        : "No elevated lifecycle intervention is currently required.",
      actions: snapshot.attentionQueue.slice(0, 10).map((item) => ({
        organizationId: item.organizationId,
        organizationName: item.organizationName,
        attention: item.attention,
        recommendedNextAction: item.recommendedNextAction,
      })),
    };
  }

  return {
    type: "attention_queue",
    answer: snapshot.attentionQueue.length
      ? `${snapshot.attentionQueue.length} organization${snapshot.attentionQueue.length === 1 ? " needs" : "s need"} elevated attention. ${snapshot.summary.critical} critical, ${snapshot.summary.high} high and ${snapshot.summary.watch} watch.`
      : "No organization currently has an elevated lifecycle attention signal.",
    organizations: snapshot.attentionQueue.slice(0, 10),
  };
}

export function compactLeoLifecycleOperations(snapshot: LeoLifecycleOperationsSnapshot) {
  return {
    generatedAt: snapshot.generatedAt,
    scope: snapshot.scope,
    summary: snapshot.summary,
    attentionQueue: snapshot.attentionQueue.slice(0, 12),
    expansionQueue: snapshot.expansionQueue.slice(0, 12),
    rules: snapshot.rules,
  };
}
