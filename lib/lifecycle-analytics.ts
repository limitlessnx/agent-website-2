import { getUnifiedLifecycleSnapshots, type LifecycleAttention, type LifecycleStage, type UnifiedLifecycleSnapshot } from "@/lib/lifecycle-intelligence";

export type LifecycleAnalyticsSnapshot = {
  generatedAt: string;
  organizations: number;
  activeOrganizations: number;
  churnedOrganizations: number;
  atRiskOrganizations: number;
  expansionReadyOrganizations: number;
  organizationsWithMeasuredValue: number;
  organizationsWithoutOperationalValue: number;
  healthyOrganizations: number;
  supportPressureOrganizations: number;
  totalConversations30d: number;
  totalLeads30d: number;
  totalSuccessfulActions30d: number;
  totalUnresolvedSupportCases: number;
  averageHealthScore: number | null;
  averageRetentionRiskScore: number | null;
  lifecycleDistribution: Record<LifecycleStage, number>;
  attentionDistribution: Record<LifecycleAttention, number>;
  activationProxyRate: number | null;
  measuredValueRate: number | null;
  riskRate: number | null;
  churnRate: number | null;
  expansionReadinessRate: number | null;
  priorityQueue: UnifiedLifecycleSnapshot[];
  expansionQueue: UnifiedLifecycleSnapshot[];
  dataNotes: string[];
};

function percent(numerator: number, denominator: number) {
  if (!denominator) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function average(values: number[]) {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export async function getLifecycleAnalyticsSnapshot(periodDays = 30): Promise<LifecycleAnalyticsSnapshot> {
  const snapshots = await getUnifiedLifecycleSnapshots(periodDays);

  const lifecycleDistribution: Record<LifecycleStage, number> = {
    setup: 0,
    adoption: 0,
    value: 0,
    retention: 0,
    expansion: 0,
    risk: 0,
    churned: 0,
  };
  const attentionDistribution: Record<LifecycleAttention, number> = {
    normal: 0,
    watch: 0,
    high: 0,
    critical: 0,
  };

  for (const snapshot of snapshots) {
    lifecycleDistribution[snapshot.stage] += 1;
    attentionDistribution[snapshot.attention] += 1;
  }

  const organizations = snapshots.length;
  const churnedOrganizations = lifecycleDistribution.churned;
  const activeOrganizations = snapshots.filter((item) => item.organizationStatus === "active").length;
  const atRiskOrganizations = snapshots.filter((item) => item.stage === "risk" || ["high", "critical"].includes(item.attention)).length;
  const expansionReadyOrganizations = snapshots.filter((item) => item.stage === "expansion" && item.attention !== "high" && item.attention !== "critical").length;
  const organizationsWithMeasuredValue = snapshots.filter((item) => item.conversations > 0 || item.leadsCaptured > 0 || item.successfulActions > 0).length;
  const organizationsWithoutOperationalValue = snapshots.filter((item) => !["churned", "risk"].includes(item.stage) && item.conversations === 0 && item.leadsCaptured === 0 && item.successfulActions === 0).length;
  const healthyOrganizations = snapshots.filter((item) => item.healthScore >= 80 && item.retentionRiskScore < 20 && item.organizationStatus === "active").length;
  const supportPressureOrganizations = snapshots.filter((item) => item.unresolvedSupportCases > 0).length;

  const priorityQueue = snapshots
    .filter((item) => item.attention === "critical" || item.attention === "high")
    .slice(0, 12);
  const expansionQueue = snapshots
    .filter((item) => item.stage === "expansion" && item.attention !== "high" && item.attention !== "critical")
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    organizations,
    activeOrganizations,
    churnedOrganizations,
    atRiskOrganizations,
    expansionReadyOrganizations,
    organizationsWithMeasuredValue,
    organizationsWithoutOperationalValue,
    healthyOrganizations,
    supportPressureOrganizations,
    totalConversations30d: snapshots.reduce((sum, item) => sum + item.conversations, 0),
    totalLeads30d: snapshots.reduce((sum, item) => sum + item.leadsCaptured, 0),
    totalSuccessfulActions30d: snapshots.reduce((sum, item) => sum + item.successfulActions, 0),
    totalUnresolvedSupportCases: snapshots.reduce((sum, item) => sum + item.unresolvedSupportCases, 0),
    averageHealthScore: average(snapshots.map((item) => item.healthScore)),
    averageRetentionRiskScore: average(snapshots.map((item) => item.retentionRiskScore)),
    lifecycleDistribution,
    attentionDistribution,
    activationProxyRate: percent(snapshots.filter((item) => !["setup", "churned"].includes(item.stage)).length, organizations - churnedOrganizations),
    measuredValueRate: percent(organizationsWithMeasuredValue, activeOrganizations),
    riskRate: percent(atRiskOrganizations, Math.max(activeOrganizations, 1)),
    churnRate: percent(churnedOrganizations, organizations),
    expansionReadinessRate: percent(expansionReadyOrganizations, Math.max(activeOrganizations, 1)),
    priorityQueue,
    expansionQueue,
    dataNotes: [
      "Activation rate is currently a proxy based on lifecycle stage because Phase 4 activation instrumentation remains deferred.",
      "Revenue metrics such as MRR, ARR, expansion revenue and plan conversion remain intentionally excluded until the replacement billing model is finalized.",
      "Time-to-value is not shown until first-value milestone timestamps are explicitly recorded rather than inferred from current-state data.",
      "All customer counts and operating metrics are derived from existing organization-scoped lifecycle, usage, integration and support records.",
    ],
  };
}
