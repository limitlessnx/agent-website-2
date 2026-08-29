import type { LeoIdentity } from "@/lib/leo-core";
import { buildLeoUnifiedBusinessState } from "@/lib/leo-business-state";
import { resolveLeoWorkspaceTarget } from "@/lib/leo-workspace-portfolio";

export type LeoKpiStatus = "healthy" | "attention" | "critical" | "insufficient_data";
export type LeoBusinessKpi = {
  key: string;
  title: string;
  objective: string;
  unit: "count" | "percent" | "hours";
  direction: "min" | "max";
  target: number;
  warning: number;
  value: number | null;
  status: LeoKpiStatus;
  evidence: string;
  organizationId?: string;
  workspace?: string;
};

function statusFor(value: number | null, direction: "min" | "max", target: number, warning: number): LeoKpiStatus {
  if (value === null || !Number.isFinite(value)) return "insufficient_data";
  if (direction === "min") return value >= target ? "healthy" : value >= warning ? "attention" : "critical";
  return value <= target ? "healthy" : value <= warning ? "attention" : "critical";
}

export async function buildLeoWorkspaceKpis(input: { identity: LeoIdentity; workspace?: string; organizationId?: string }) {
  if (input.identity.scope !== "super_admin") throw new Error("Business KPIs are restricted to Super Leo.");
  const target = input.workspace || input.organizationId ? await resolveLeoWorkspaceTarget(input.identity, input.organizationId || input.workspace || "").catch(() => null) : null;
  const state = await buildLeoUnifiedBusinessState({ identity: input.identity, workspace: input.workspace, organizationId: input.organizationId });
  const org = target?.organizationId;
  const workspace = target?.name || input.workspace;
  const kpis: LeoBusinessKpi[] = [];
  const workflows = state.summary.workflows;
  const completedRuns = workflows.total ? Math.max(0, workflows.total) : 0;
  const workflowFailureRate = completedRuns ? Math.round((workflows.recentFailedRuns / completedRuns) * 1000) / 10 : null;
  kpis.push({ key: "workflow_failure_rate_24h", title: "Workflow failure rate", objective: "Keep production workflow failures low.", unit: "percent", direction: "max", target: 5, warning: 15, value: workflowFailureRate, status: statusFor(workflowFailureRate, "max", 5, 15), evidence: `${workflows.recentFailedRuns} failed/timed-out recent runs across ${workflows.total} registered workflows.`, organizationId: org, workspace });
  kpis.push({ key: "unhealthy_integrations", title: "Unhealthy integrations", objective: "Keep required workspace integrations connected and valid.", unit: "count", direction: "max", target: 0, warning: 1, value: state.summary.integrations.unhealthy, status: statusFor(state.summary.integrations.unhealthy, "max", 0, 1), evidence: `${state.summary.integrations.unhealthy} unhealthy of ${state.summary.integrations.total} integrations.`, organizationId: org, workspace });
  kpis.push({ key: "critical_operational_signals", title: "Critical operational signals", objective: "Resolve critical operational conditions before they compound.", unit: "count", direction: "max", target: 0, warning: 1, value: state.summary.signals.critical, status: statusFor(state.summary.signals.critical, "max", 0, 1), evidence: `${state.summary.signals.critical} critical and ${state.summary.signals.high} high active signals.`, organizationId: org, workspace });
  if (state.summary.leads) {
    const qualified = state.summary.leads.qualified;
    const stale = state.summary.leads.staleQualified;
    const staleRate = qualified ? Math.round((stale / qualified) * 1000) / 10 : qualified === 0 ? 0 : null;
    kpis.push({ key: "stale_qualified_lead_rate", title: "Stale qualified lead rate", objective: "Keep qualified property leads attended within the operating follow-up window.", unit: "percent", direction: "max", target: 10, warning: 25, value: staleRate, status: statusFor(staleRate, "max", 10, 25), evidence: `${stale} stale qualified leads out of ${qualified} qualified leads.`, organizationId: org, workspace });
  }
  if (state.summary.campaigns) {
    const c = state.summary.campaigns;
    const deliveryRate = c.accepted ? Math.round((c.delivered / c.accepted) * 1000) / 10 : null;
    const failureRate = c.accepted ? Math.round((c.failed / c.accepted) * 1000) / 10 : null;
    kpis.push({ key: "campaign_delivery_rate", title: "Campaign delivery rate", objective: "Maintain reliable WhatsApp campaign delivery after provider acceptance.", unit: "percent", direction: "min", target: 90, warning: 75, value: deliveryRate, status: statusFor(deliveryRate, "min", 90, 75), evidence: `${c.delivered} delivered/read from ${c.accepted} accepted recipients.`, organizationId: org, workspace });
    kpis.push({ key: "campaign_failure_rate", title: "Campaign failure rate", objective: "Keep post-acceptance campaign failures below the operating threshold.", unit: "percent", direction: "max", target: 5, warning: 15, value: failureRate, status: statusFor(failureRate, "max", 5, 15), evidence: `${c.failed} failed from ${c.accepted} accepted recipients; ${c.unresolved} unresolved.`, organizationId: org, workspace });
  }
  const summary = { total: kpis.length, healthy: kpis.filter(k => k.status === "healthy").length, attention: kpis.filter(k => k.status === "attention").length, critical: kpis.filter(k => k.status === "critical").length, insufficientData: kpis.filter(k => k.status === "insufficient_data").length };
  return { generatedAt: new Date().toISOString(), scope: state.scope, summary, kpis, rules: { evidence: "KPIs are computed only from current authoritative business-state evidence.", targets: "Targets are explicit operating thresholds, not predictions or financial promises.", missingData: "Missing evidence produces insufficient_data rather than an estimated value.", action: "A KPI breach may recommend an intervention, but consequential execution still requires canonical Leo approval and verification." } };
}

export function compactLeoWorkspaceKpis(snapshot: Awaited<ReturnType<typeof buildLeoWorkspaceKpis>>) {
  return { generatedAt: snapshot.generatedAt, scope: snapshot.scope, summary: snapshot.summary, kpis: snapshot.kpis, rules: snapshot.rules };
}
