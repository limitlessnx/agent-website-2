import { getExpansionSnapshots, type OrganizationExpansionSnapshot } from "@/lib/expansion-intelligence";
import { getRetentionSnapshots, type RetentionSnapshot } from "@/lib/retention-intelligence";
import { getOrganizationValueReports, type OrganizationValueReport } from "@/lib/usage-reporting";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type LifecycleStage = "setup" | "adoption" | "value" | "retention" | "expansion" | "risk" | "churned";
export type LifecycleAttention = "normal" | "watch" | "high" | "critical";

export type UnifiedLifecycleSnapshot = {
  organizationId: string;
  organizationName: string;
  stage: LifecycleStage;
  attention: LifecycleAttention;
  organizationStatus: string;
  healthScore: number;
  healthBand: "healthy" | "watch" | "risk" | "critical";
  retentionRiskScore: number;
  retentionStage: RetentionSnapshot["stage"];
  opportunityScore: number;
  opportunityCount: number;
  current30DayUsage: number;
  previous30DayUsage: number;
  conversations: number;
  leadsCaptured: number;
  successfulActions: number;
  activeAgents: number;
  connectedIntegrations: number;
  unresolvedSupportCases: number;
  lastActivityAt: string | null;
  reasons: string[];
  recommendedNextAction: string;
};

type OrganizationRow = { id: string; name: string; status: string };
type IntegrationRow = { organization_id: string; status: string; last_checked_at: string | null; last_connected_at: string | null; updated_at: string };
type SupportRow = { organization_id: string | null; status: string; priority: string; metadata: Record<string, unknown> | null };

function healthBand(score: number): UnifiedLifecycleSnapshot["healthBand"] {
  if (score >= 80) return "healthy";
  if (score >= 60) return "watch";
  if (score >= 40) return "risk";
  return "critical";
}

function deriveHealth(integrations: IntegrationRow[], support: SupportRow[], retention: RetentionSnapshot | undefined) {
  let score = 100;
  const reasons: string[] = [];
  const connected = integrations.filter((item) => ["connected", "active", "healthy"].includes(String(item.status).toLowerCase())).length;
  const failed = integrations.filter((item) => ["error", "authentication_failed"].includes(String(item.status).toLowerCase())).length;
  const degraded = integrations.filter((item) => String(item.status).toLowerCase() === "degraded").length;
  const urgentSupport = support.filter((item) => !["resolved", "closed"].includes(item.status) && ["high", "critical"].includes(item.priority)).length;

  if (failed) {
    const impact = Math.min(50, failed * 25);
    score -= impact;
    reasons.push(`${failed} integration${failed === 1 ? " is" : "s are"} failing.`);
  }
  if (degraded) {
    const impact = Math.min(24, degraded * 12);
    score -= impact;
    reasons.push(`${degraded} integration${degraded === 1 ? " is" : "s are"} degraded.`);
  }
  if (integrations.length > 0 && connected === 0) {
    score -= 15;
    reasons.push("No configured integration is currently healthy or connected.");
  }
  if (urgentSupport) {
    score -= Math.min(24, urgentSupport * 12);
    reasons.push(`${urgentSupport} urgent support case${urgentSupport === 1 ? " is" : "s are"} unresolved.`);
  }
  if ((retention?.riskScore || 0) >= 70) score -= 15;
  else if ((retention?.riskScore || 0) >= 45) score -= 8;

  score = Math.max(0, Math.min(100, score));
  return { score, band: healthBand(score), connected, reasons };
}

function lifecycleStage(input: {
  status: string;
  report?: OrganizationValueReport;
  retention?: RetentionSnapshot;
  expansion?: OrganizationExpansionSnapshot;
  healthScore: number;
}): LifecycleStage {
  if (input.status === "archived" || input.retention?.stage === "churned") return "churned";
  if ((input.retention?.riskScore || 0) >= 45 || input.healthScore < 60 || ["suspended", "cancellation_requested"].includes(input.retention?.stage || "")) return "risk";
  if ((input.expansion?.opportunityScore || 0) >= 30) return "expansion";
  if (input.report?.hasOperationalData && ((input.report.metrics.successfulActions.current > 0) || (input.report.metrics.conversations.current > 0))) return "value";
  if ((input.report?.metrics.activeAgents || 0) > 0 || (input.retention?.connectedIntegrations || 0) > 0) return "adoption";
  if (input.status === "active") return "setup";
  return "retention";
}

function attention(input: { stage: LifecycleStage; retentionRisk: number; healthScore: number }): LifecycleAttention {
  if (input.stage === "churned" || input.retentionRisk >= 70 || input.healthScore < 40) return "critical";
  if (input.retentionRisk >= 45 || input.healthScore < 60) return "high";
  if (input.retentionRisk >= 20 || input.healthScore < 80) return "watch";
  return "normal";
}

function recommendedAction(input: {
  stage: LifecycleStage;
  retention?: RetentionSnapshot;
  expansion?: OrganizationExpansionSnapshot;
  report?: OrganizationValueReport;
  healthReasons: string[];
}) {
  if (input.stage === "churned") return input.retention?.recommendedAction || "Review churn reason before considering a controlled win-back path.";
  if (input.stage === "risk") return input.retention?.recommendedAction || input.healthReasons[0] || "Assign customer-success review and address the highest-impact operational risk first.";
  if (input.stage === "expansion") return input.expansion?.strongestOpportunity?.recommendedAction || "Review the strongest measured growth opportunity with the customer.";
  if (input.stage === "value") return "Keep proving measurable value and watch for a stable expansion or retention signal before changing the account.";
  if (input.stage === "adoption") return "Help the customer reach a repeatable successful workflow and first measurable value milestone.";
  if (input.stage === "setup") return "Complete the minimum working setup: active agent, connected channel and first successful customer interaction.";
  return "Maintain value delivery and monitor health, usage and support signals.";
}

export async function getUnifiedLifecycleSnapshots(periodDays = 30): Promise<UnifiedLifecycleSnapshot[]> {
  const [organizations, reports, retention, expansion, integrations, support] = await Promise.all([
    supabaseServerRequest<OrganizationRow[]>("organizations?select=id,name,status&order=name.asc&limit=500").catch(() => []),
    getOrganizationValueReports(periodDays),
    getRetentionSnapshots(),
    getExpansionSnapshots(periodDays),
    supabaseServerRequest<IntegrationRow[]>("organization_integrations?select=organization_id,status,last_checked_at,last_connected_at,updated_at&limit=5000").catch(() => []),
    supabaseServerRequest<SupportRow[]>("support_conversations?select=organization_id,status,priority,metadata&limit=5000").catch(() => []),
  ]);

  const reportByOrg = new Map(reports.map((item) => [item.organizationId, item]));
  const retentionByOrg = new Map(retention.map((item) => [item.organizationId, item]));
  const expansionByOrg = new Map(expansion.map((item) => [item.organizationId, item]));

  return organizations.map((org) => {
    const report = reportByOrg.get(org.id);
    const retentionSnapshot = retentionByOrg.get(org.id);
    const expansionSnapshot = expansionByOrg.get(org.id);
    const orgIntegrations = integrations.filter((item) => item.organization_id === org.id);
    const orgSupport = support.filter((item) => item.organization_id === org.id);
    const health = deriveHealth(orgIntegrations, orgSupport, retentionSnapshot);
    const stage = lifecycleStage({ status: org.status, report, retention: retentionSnapshot, expansion: expansionSnapshot, healthScore: health.score });
    const retentionRiskScore = retentionSnapshot?.riskScore || 0;
    const lifecycleAttention = attention({ stage, retentionRisk: retentionRiskScore, healthScore: health.score });
    const reasons = [
      ...health.reasons,
      ...(retentionSnapshot?.signals.slice(0, 3).map((signal) => signal.detail) || []),
      ...(expansionSnapshot?.strongestOpportunity ? [expansionSnapshot.strongestOpportunity.rationale] : []),
    ].slice(0, 5);

    return {
      organizationId: org.id,
      organizationName: org.name,
      stage,
      attention: lifecycleAttention,
      organizationStatus: org.status,
      healthScore: health.score,
      healthBand: health.band,
      retentionRiskScore,
      retentionStage: retentionSnapshot?.stage || "retained",
      opportunityScore: expansionSnapshot?.opportunityScore || 0,
      opportunityCount: expansionSnapshot?.opportunities.length || 0,
      current30DayUsage: retentionSnapshot?.current30DayUsage || 0,
      previous30DayUsage: retentionSnapshot?.previous30DayUsage || 0,
      conversations: report?.metrics.conversations.current || 0,
      leadsCaptured: report?.metrics.leadsCaptured.current || 0,
      successfulActions: report?.metrics.successfulActions.current || 0,
      activeAgents: report?.metrics.activeAgents || 0,
      connectedIntegrations: health.connected,
      unresolvedSupportCases: retentionSnapshot?.unresolvedSupportCases || 0,
      lastActivityAt: report?.lastActivityAt || null,
      reasons,
      recommendedNextAction: recommendedAction({ stage, retention: retentionSnapshot, expansion: expansionSnapshot, report, healthReasons: health.reasons }),
    };
  }).sort((a, b) => {
    const attentionRank = { critical: 3, high: 2, watch: 1, normal: 0 } as const;
    return attentionRank[b.attention] - attentionRank[a.attention] || b.retentionRiskScore - a.retentionRiskScore || a.organizationName.localeCompare(b.organizationName);
  });
}
