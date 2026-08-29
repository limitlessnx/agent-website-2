import type { LeoIdentity } from "@/lib/leo-core";
import { getLeads } from "@/lib/limitless-data";
import { getDetailedCampaignReports } from "@/lib/campaign-report-reader";
import { getWorkflowRuns } from "@/lib/workflow-registry";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";
import { listLeoAutonomousGoals, summarizeLeoGoalHealth } from "@/lib/leo-autonomous-goals";
import { listLeoWorkspacePortfolio, resolveLeoWorkspaceTarget, type LeoWorkspaceTarget } from "@/lib/leo-workspace-portfolio";

export type LeoDecisionTrend = "improving" | "degrading" | "stable" | "insufficient_data";
export type LeoDecisionInsight = {
  id: string;
  area: "leads" | "campaigns" | "workflows" | "goals" | "signals" | "portfolio";
  severity: "info" | "watch" | "high";
  title: string;
  finding: string;
  recommendation: string;
  evidence: Record<string, unknown>;
};
export type LeoDecisionSnapshot = {
  generatedAt: string;
  scope: { type: "platform" | "workspace"; organizationId?: string; workspace?: string };
  coverage: Record<string, unknown>;
  metrics: Record<string, unknown>;
  insights: LeoDecisionInsight[];
  rules: {
    causalBoundary: string;
    forecastBoundary: string;
    executionBoundary: string;
  };
};

const DAY = 24 * 60 * 60 * 1000;
function time(value?: string | null) { const n = value ? new Date(value).getTime() : Number.NaN; return Number.isFinite(n) ? n : null; }
function pct(n: number, d: number) { return d > 0 ? Math.round((n / d) * 1000) / 10 : null; }
function delta(current: number | null, previous: number | null) { return current == null || previous == null ? null : Math.round((current - previous) * 10) / 10; }
function trend(current: number | null, previous: number | null, tolerance = 3): LeoDecisionTrend {
  if (current == null || previous == null) return "insufficient_data";
  const d = current - previous;
  if (Math.abs(d) < tolerance) return "stable";
  return d > 0 ? "improving" : "degrading";
}
function inWindow(value: string | undefined | null, start: number, end: number) { const t = time(value); return t != null && t >= start && t < end; }
function isLimitlessTarget(target?: LeoWorkspaceTarget | null) { return Boolean(target && /limitless|realty/i.test(`${target.name} ${target.slug} ${target.aliases.join(" ")}`)); }

export async function buildLeoDecisionIntelligence(input: { identity: LeoIdentity; workspace?: string; organizationId?: string; now?: Date }): Promise<LeoDecisionSnapshot> {
  if (input.identity.scope !== "super_admin") throw new Error("Decision intelligence is restricted to Super Leo.");
  const now = input.now || new Date();
  const nowMs = now.getTime();
  const current7Start = nowMs - 7 * DAY;
  const previous7Start = nowMs - 14 * DAY;
  const current14Start = nowMs - 14 * DAY;
  const previous14Start = nowMs - 28 * DAY;

  let target: LeoWorkspaceTarget | null = null;
  if (input.organizationId || input.workspace) target = await resolveLeoWorkspaceTarget(input.identity, input.organizationId || input.workspace || "").catch(() => null);
  const limitless = isLimitlessTarget(target) || /limitless|realty|maia/i.test(input.workspace || "");

  const [runs, signalsSnapshot, goals, portfolio, leads, campaigns] = await Promise.all([
    getWorkflowRuns(700).catch(() => []),
    scanLeoProactiveSignals({ limit: 100, now }).catch(() => ({ generatedAt: now.toISOString(), total: 0, critical: 0, high: 0, medium: 0, low: 0, audit: {}, signals: [] })),
    listLeoAutonomousGoals(input.identity).catch(() => []),
    listLeoWorkspacePortfolio(input.identity).catch(() => []),
    limitless || !target ? getLeads(600).catch(() => []) : Promise.resolve([]),
    limitless || !target ? getDetailedCampaignReports(100).catch(() => []) : Promise.resolve([]),
  ]);

  const scopedRuns = target ? runs.filter((run) => run.organization_id === target!.organizationId || run.organization_uuid === target!.organizationId) : runs;
  const scopedSignals = target ? signalsSnapshot.signals.filter((signal) => signal.workspace === target!.organizationId || (limitless && signal.workspace === "limitless_realty")) : signalsSnapshot.signals;
  const scopedGoals = target ? goals.filter((goal) => !goal.organizationId || goal.organizationId === target!.organizationId || (limitless && goal.workspace === "limitless_realty")) : goals;

  const currentRuns = scopedRuns.filter((run) => inWindow(run.created_at || run.started_at, current7Start, nowMs));
  const previousRuns = scopedRuns.filter((run) => inWindow(run.created_at || run.started_at, previous7Start, current7Start));
  const completed = (items: typeof scopedRuns) => items.filter((run) => ["succeeded", "failed", "timed_out"].includes(run.status));
  const workflowRate = (items: typeof scopedRuns) => { const done = completed(items); return pct(done.filter((run) => run.status === "succeeded").length, done.length); };
  const workflowCurrent = workflowRate(currentRuns);
  const workflowPrevious = workflowRate(previousRuns);

  const currentLeads = leads.filter((lead) => inWindow(lead.created_at, current7Start, nowMs));
  const previousLeads = leads.filter((lead) => inWindow(lead.created_at, previous7Start, current7Start));
  const qualified = leads.filter((lead) => ["qualified", "hot", "ready", "ready_to_buy"].includes(String(lead.status || "").toLowerCase()) || String(lead.score || "").toLowerCase() === "hot");
  const staleQualified = qualified.filter((lead) => { const reference = time(lead.last_contacted_at || lead.last_follow_up_at || lead.created_at); return reference == null || nowMs - reference > DAY; });

  const currentCampaigns = campaigns.filter((item) => inWindow(item.created_at, current14Start, nowMs));
  const previousCampaigns = campaigns.filter((item) => inWindow(item.created_at, previous14Start, current14Start));
  const campaignMetric = (items: typeof campaigns) => {
    const accepted = items.reduce((sum, item) => sum + item.accepted, 0);
    const delivered = items.reduce((sum, item) => sum + item.delivered, 0);
    const read = items.reduce((sum, item) => sum + item.read, 0);
    const failed = items.reduce((sum, item) => sum + item.failed, 0);
    return { campaigns: items.length, accepted, delivered, read, failed, deliveryRate: pct(delivered, accepted), readRate: pct(read, delivered), failureRate: pct(failed, accepted) };
  };
  const campaignCurrent = campaignMetric(currentCampaigns);
  const campaignPrevious = campaignMetric(previousCampaigns);
  const goalHealth = summarizeLeoGoalHealth(scopedGoals);

  const insights: LeoDecisionInsight[] = [];
  const workflowDelta = delta(workflowCurrent, workflowPrevious);
  if (workflowDelta != null && Math.abs(workflowDelta) >= 10 && completed(currentRuns).length >= 3 && completed(previousRuns).length >= 3) {
    insights.push({ id: "workflow-success-shift", area: "workflows", severity: workflowDelta < 0 ? "high" : "info", title: `Workflow success rate ${workflowDelta < 0 ? "declined" : "improved"}`, finding: `The latest 7-day completed-run success rate is ${workflowCurrent}% versus ${workflowPrevious}% in the preceding 7 days (${workflowDelta > 0 ? "+" : ""}${workflowDelta} percentage points).`, recommendation: workflowDelta < 0 ? "Inspect the failing workflow keys and recent error evidence before retrying or changing production configuration." : "Keep monitoring the same workflow mix before treating the improvement as durable.", evidence: { currentCompletedRuns: completed(currentRuns).length, previousCompletedRuns: completed(previousRuns).length, currentSuccessRate: workflowCurrent, previousSuccessRate: workflowPrevious, percentagePointDelta: workflowDelta } });
  }

  const deliveryDelta = delta(campaignCurrent.deliveryRate, campaignPrevious.deliveryRate);
  if (deliveryDelta != null && Math.abs(deliveryDelta) >= 10 && campaignCurrent.accepted >= 5 && campaignPrevious.accepted >= 5) {
    insights.push({ id: "campaign-delivery-shift", area: "campaigns", severity: deliveryDelta < 0 ? "high" : "info", title: `Campaign delivery rate ${deliveryDelta < 0 ? "declined" : "improved"}`, finding: `The latest 14-day delivery rate is ${campaignCurrent.deliveryRate}% versus ${campaignPrevious.deliveryRate}% in the preceding 14 days (${deliveryDelta > 0 ? "+" : ""}${deliveryDelta} percentage points).`, recommendation: deliveryDelta < 0 ? "Compare provider failure evidence and recipient-level outcomes before considering any resend or routing change." : "Confirm the improvement across more campaigns before changing delivery assumptions.", evidence: { current: campaignCurrent, previous: campaignPrevious, percentagePointDelta: deliveryDelta } });
  }

  if (qualified.length >= 3 && staleQualified.length > 0) {
    const staleRate = pct(staleQualified.length, qualified.length);
    insights.push({ id: "qualified-lead-staleness", area: "leads", severity: staleRate != null && staleRate >= 40 ? "high" : "watch", title: "Qualified lead attention gap", finding: `${staleQualified.length} of ${qualified.length} currently qualified/high-intent leads (${staleRate}%) have no recorded contact activity within 24 hours.`, recommendation: "Review those lead histories and prepare the next appropriate follow-up. Do not infer interest or send blindly from this aggregate alone.", evidence: { qualifiedLeads: qualified.length, staleQualifiedLeads: staleQualified.length, staleRate } });
  }

  if (goalHealth.critical > 0 || goalHealth.attention > 0) {
    insights.push({ id: "autonomous-goal-health", area: "goals", severity: goalHealth.critical > 0 ? "high" : "watch", title: "Ongoing operational goals need attention", finding: `${goalHealth.critical} goal${goalHealth.critical === 1 ? " is" : "s are"} critical and ${goalHealth.attention} require attention.`, recommendation: "Prioritize critical goals first and create controlled interventions through the existing playbook/orchestration path rather than acting from the aggregate status alone.", evidence: goalHealth });
  }

  const criticalSignals = scopedSignals.filter((signal) => signal.severity === "critical").length;
  const highSignals = scopedSignals.filter((signal) => signal.severity === "high").length;
  if (criticalSignals || highSignals >= 2) {
    insights.push({ id: "operational-signal-concentration", area: "signals", severity: criticalSignals ? "high" : "watch", title: "Elevated operational signal load", finding: `Current monitoring contains ${criticalSignals} critical and ${highSignals} high-severity signal${criticalSignals + highSignals === 1 ? "" : "s"}.`, recommendation: "Review the highest-severity evidence first. Signal concentration identifies operational pressure, not a proven shared root cause.", evidence: { critical: criticalSignals, high: highSignals, totalScopedSignals: scopedSignals.length } });
  }

  if (!target && portfolio.length) {
    const inactive = portfolio.filter((item) => !["active", "live"].includes(item.status.toLowerCase())).length;
    insights.push({ id: "portfolio-coverage", area: "portfolio", severity: inactive ? "watch" : "info", title: "Workspace portfolio coverage", finding: `${portfolio.length} workspace${portfolio.length === 1 ? "" : "s"} are visible to Super Leo; ${inactive} are not currently marked active/live.`, recommendation: "Use workspace-specific evidence before making operating comparisons. Portfolio status alone does not establish performance.", evidence: { workspaces: portfolio.length, owned: portfolio.filter((item) => item.relation === "owned").length, client: portfolio.filter((item) => item.relation === "client").length, inactive } });
  }

  return {
    generatedAt: now.toISOString(),
    scope: target ? { type: "workspace", organizationId: target.organizationId, workspace: target.name } : { type: "platform" },
    coverage: { workflowRunsLoaded: scopedRuns.length, leadRecordsLoaded: leads.length, campaignReportsLoaded: campaigns.length, activeGoals: scopedGoals.length, currentSignals: scopedSignals.length, note: "Trend calculations use the records currently available to Fluxknight. Missing historical rows reduce confidence and are reported as insufficient data rather than estimated." },
    metrics: {
      workflow: { current7Days: { completedRuns: completed(currentRuns).length, successRate: workflowCurrent }, previous7Days: { completedRuns: completed(previousRuns).length, successRate: workflowPrevious }, percentagePointDelta: workflowDelta, trend: trend(workflowCurrent, workflowPrevious) },
      leads: { current7DayCreated: currentLeads.length, previous7DayCreated: previousLeads.length, createdDelta: currentLeads.length - previousLeads.length, qualifiedCurrent: qualified.length, qualifiedStaleOver24h: staleQualified.length },
      campaigns: { current14Days: campaignCurrent, previous14Days: campaignPrevious, deliveryRateDelta: deliveryDelta, deliveryTrend: trend(campaignCurrent.deliveryRate, campaignPrevious.deliveryRate) },
      goals: goalHealth,
      signals: { total: scopedSignals.length, critical: criticalSignals, high: highSignals, medium: scopedSignals.filter((signal) => signal.severity === "medium").length, low: scopedSignals.filter((signal) => signal.severity === "low").length },
    },
    insights,
    rules: {
      causalBoundary: "A correlation, timing shift, or anomaly is not proof of cause. Leo must inspect source evidence before stating why a metric changed.",
      forecastBoundary: "Do not project future revenue, conversions, delivery or reliability from sparse history. Forecasts require explicit data coverage and assumptions.",
      executionBoundary: "Decision intelligence recommends and prioritizes. Consequential actions still use the canonical playbook, orchestration, approval and evidence-verification path.",
    },
  };
}

export function compactLeoDecisionIntelligence(snapshot: LeoDecisionSnapshot) {
  return { generatedAt: snapshot.generatedAt, scope: snapshot.scope, coverage: snapshot.coverage, metrics: snapshot.metrics, insights: snapshot.insights.slice(0, 8), rules: snapshot.rules };
}
