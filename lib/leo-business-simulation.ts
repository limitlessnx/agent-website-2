import type { LeoIdentity } from "@/lib/leo-core";
import { buildLeoBusinessCommandCenter } from "@/lib/leo-business-command-center";
import { buildLeoWorkspaceBusinessModelSnapshot } from "@/lib/leo-workspace-business-models";

export type LeoSimulationChange = {
  key: string;
  before?: string | number | boolean | null;
  after: string | number | boolean;
  rationale?: string;
};
export type LeoSimulationImpact = {
  area: string;
  direction: "improve" | "worsen" | "mixed" | "unknown";
  confidence: "low" | "medium" | "high";
  statement: string;
  evidence: string[];
  assumptions: string[];
  risks: string[];
};
export type LeoBusinessSimulation = {
  generatedAt: string;
  scope: { type: "platform" | "workspace"; workspace?: string; organizationId?: string };
  scenario: { title: string; description?: string; changes: LeoSimulationChange[] };
  baseline: {
    status: string;
    kpis: { total: number; healthy: number; attention: number; critical: number; insufficientData: number };
    risks: number;
    overdue: number;
    criticalEvents: number;
    highEvents: number;
  };
  impacts: LeoSimulationImpact[];
  overall: "favorable_with_risks" | "unfavorable" | "mixed" | "insufficient_evidence";
  recommendation: string;
  validationPlan: string[];
  rules: { simulation: string; evidence: string; financial: string; execution: string; isolation: string };
};

function clean(value: unknown, max = 1200) { return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max); }
function numeric(value: unknown) { const n = typeof value === "number" ? value : Number(value); return Number.isFinite(n) ? n : null; }
function impactFor(change: LeoSimulationChange, modelType?: string): LeoSimulationImpact {
  const key = change.key.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const before = numeric(change.before); const after = numeric(change.after);
  if (/follow_?up.*(interval|hours)|contact.*interval/.test(key) && before !== null && after !== null) {
    const shorter = after < before;
    return {
      area: "lead_follow_up",
      direction: shorter ? "mixed" : "unknown",
      confidence: modelType === "real_estate_sales" ? "medium" : "low",
      statement: shorter ? "A shorter follow-up interval may reduce time-to-attention for qualified leads, while increasing contact volume and over-contact risk." : "A longer follow-up interval may reduce contact pressure but there is not enough evidence here to claim it improves conversion or lead quality.",
      evidence: ["Current KPI state and stale-qualified-lead exposure are available from the Command Center.", `Scenario changes follow-up interval from ${before} to ${after}.`],
      assumptions: ["The follow-up workflow actually uses this interval.", "Lead eligibility, cooldown and opt-out controls remain unchanged.", "No additional staffing or provider-capacity constraint is introduced."],
      risks: shorter ? ["Higher outbound volume.", "Potential contact fatigue if cooldown/eligibility logic is weak.", "Campaign or provider limits may become more relevant."] : ["Qualified leads may remain unattended longer.", "Existing stale-lead pressure may persist."],
    };
  }
  if (/campaign.*(batch|size|volume)|recipient.*batch/.test(key) && before !== null && after !== null) {
    const larger = after > before;
    return { area: "campaign_delivery", direction: larger ? "mixed" : "unknown", confidence: "medium", statement: larger ? "A larger campaign batch increases throughput exposure, but can amplify provider, recipient-quality and failure-rate problems if current delivery health is weak." : "A smaller batch can limit blast radius during delivery investigation, but the simulation does not establish a conversion benefit.", evidence: [`Scenario changes campaign batch from ${before} to ${after}.`, "Current campaign failure/delivery KPIs and business-rule blocks are used as baseline evidence."], assumptions: ["Recipient eligibility rules remain unchanged.", "Template, provider route and message content remain unchanged."], risks: larger ? ["Larger failure blast radius.", "Provider throttling or quality limits may become more consequential."] : ["Lower immediate reach.", "Operational completion may take longer." ] };
  }
  if (/workflow.*retry.*(delay|minutes)|retry.*delay/.test(key) && before !== null && after !== null) {
    const shorter = after < before;
    return { area: "workflow_reliability", direction: "mixed", confidence: "medium", statement: shorter ? "A shorter retry delay may reduce recovery latency for transient failures, while increasing duplicate-execution and retry-storm risk if evidence checks are weak." : "A longer retry delay may reduce retry pressure, but can extend recovery time for transient failures.", evidence: [`Scenario changes retry delay from ${before} to ${after}.`, "Current workflow failure evidence is used as baseline context."], assumptions: ["Retry behavior is idempotent or guarded by execution evidence.", "The underlying failure is transient rather than deterministic."], risks: ["Duplicate consequential actions if prior execution evidence is unresolved.", "Repeated deterministic failures may consume capacity without recovery." ] };
  }
  return { area: clean(change.key, 120) || "configuration", direction: "unknown", confidence: "low", statement: "Fluxknight can describe the proposed change and current operating context, but there is insufficient historical evidence to infer a reliable outcome direction for this parameter.", evidence: ["Current Command Center baseline is available."], assumptions: ["No unlisted dependent configuration changes occur."], risks: ["Unknown downstream effects because this parameter is not mapped to an evidence-backed simulation rule." ] };
}

export async function simulateLeoBusinessChange(input: { identity: LeoIdentity; workspace?: string; organizationId?: string; title: string; description?: string; changes: LeoSimulationChange[] }): Promise<LeoBusinessSimulation> {
  if (input.identity.scope !== "super_admin") throw new Error("Business simulation is restricted to Super Leo.");
  const title = clean(input.title, 180); if (!title) throw new Error("Simulation title is required.");
  const changes = (input.changes || []).slice(0, 12).map((item) => ({ key: clean(item.key, 120), before: item.before, after: item.after, rationale: clean(item.rationale, 500) || undefined })).filter(item => item.key && item.after !== undefined && item.after !== null && item.after !== "");
  if (!changes.length) throw new Error("At least one proposed change is required.");
  const [baseline, modelSnapshot] = await Promise.all([
    buildLeoBusinessCommandCenter({ identity: input.identity, workspace: input.workspace, organizationId: input.organizationId }),
    (input.workspace || input.organizationId) ? buildLeoWorkspaceBusinessModelSnapshot({ identity: input.identity, workspace: input.workspace, organizationId: input.organizationId }).catch(() => null) : Promise.resolve(null),
  ]);
  const impacts = changes.map(change => impactFor(change, modelSnapshot?.model?.businessType));
  const known = impacts.filter(item => item.direction !== "unknown");
  const unfavorable = impacts.filter(item => item.direction === "worsen");
  const mixed = impacts.filter(item => item.direction === "mixed");
  const favorable = impacts.filter(item => item.direction === "improve");
  const overall: LeoBusinessSimulation["overall"] = !known.length ? "insufficient_evidence" : unfavorable.length && !favorable.length ? "unfavorable" : mixed.length || (favorable.length && unfavorable.length) ? "mixed" : "favorable_with_risks";
  const validationPlan = ["Capture the pre-change KPI snapshot and exact configuration values.", "Apply only the smallest reversible approved change.", "Observe the same KPI/event window after the change without changing unrelated variables where practical.", "Compare actual post-change evidence with the baseline; do not treat timing alone as causality.", "Roll back if defined health thresholds regress or consequential evidence becomes unresolved."];
  return {
    generatedAt: new Date().toISOString(), scope: baseline.scope, scenario: { title, description: clean(input.description, 1200) || undefined, changes },
    baseline: { status: baseline.status, kpis: baseline.metrics.kpis, risks: baseline.priorityRisks.length, overdue: baseline.metrics.risks.overdue, criticalEvents: baseline.metrics.risks.criticalEvents, highEvents: baseline.metrics.risks.highEvents },
    impacts, overall,
    recommendation: overall === "insufficient_evidence" ? "Do not treat this as a predicted outcome. Run a small reversible controlled test and measure authoritative post-change evidence." : "Use this simulation only to compare trade-offs and design a reversible test. Rebuild current state immediately before any approved change.",
    validationPlan,
    rules: { simulation: "Simulation is scenario analysis, not prediction. Directional impacts are heuristics bounded by explicit assumptions and current evidence.", evidence: "Missing historical evidence produces unknown/low-confidence impact rather than fabricated percentages.", financial: "Never invent revenue, conversion, ROI, closing volume or financial effects without authoritative financial and pipeline data.", execution: "Simulation cannot mutate configuration, approve itself, or execute a consequential action. Any real change must use canonical Leo approval and evidence verification.", isolation: "Workspace simulation resolves and remains pinned to one exact organization ID; cross-workspace private records are never blended." },
  };
}
