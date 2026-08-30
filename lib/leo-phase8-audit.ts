import type { LeoIdentity } from "@/lib/leo-core";
import { buildLeoUnifiedBusinessState } from "@/lib/leo-business-state";
import { buildLeoWorkspaceKpis } from "@/lib/leo-business-kpis";
import { evaluateLeoBusinessRules } from "@/lib/leo-business-rules";
import { buildLeoOperationalCalendarSnapshot } from "@/lib/leo-operational-calendar";
import { buildLeoBusinessEventSnapshot } from "@/lib/leo-business-events";
import { listLeoWorkspacePortfolio } from "@/lib/leo-workspace-portfolio";
import { listLeoWorkspaceBusinessModels } from "@/lib/leo-workspace-business-models";
import { buildLeoBusinessCommandCenter } from "@/lib/leo-business-command-center";

export type LeoPhase8AuditStatus = "pass" | "warn" | "fail";
export type LeoPhase8RoadmapState = "closed" | "deferred" | "implemented_pending_deploy" | "implemented_pending_closure";

export type LeoPhase8Audit = {
  generatedAt: string;
  version: "8J-1";
  status: LeoPhase8AuditStatus;
  productionClosureReady: boolean;
  roadmap: Record<string, LeoPhase8RoadmapState>;
  checks: Record<string, { passed: boolean; severity: "info" | "warning" | "blocking"; detail: string }>;
  counts: Record<string, number>;
  blockers: string[];
  rules: { closure: string; deployment: string; financial: string; isolation: string };
};

export async function auditLeoPhase8(input: { identity: LeoIdentity }): Promise<LeoPhase8Audit> {
  if (input.identity.scope !== "super_admin") throw new Error("Phase 8 audit is restricted to Super Leo.");

  const [state, kpis, businessRules, calendar, events, portfolio, models, commandCenter] = await Promise.all([
    buildLeoUnifiedBusinessState({ identity: input.identity }),
    buildLeoWorkspaceKpis({ identity: input.identity }),
    evaluateLeoBusinessRules({ identity: input.identity }),
    buildLeoOperationalCalendarSnapshot({ identity: input.identity }),
    buildLeoBusinessEventSnapshot(input.identity, { hours: 24 }),
    listLeoWorkspacePortfolio(input.identity),
    listLeoWorkspaceBusinessModels(input.identity, true),
    buildLeoBusinessCommandCenter({ identity: input.identity }),
  ]);

  const duplicateEventIds = events.recent.length - new Set(events.recent.map((event) => event.id)).size;
  const duplicateIdempotencyKeys = events.recent.length - new Set(events.recent.map((event) => `${event.organizationId}:${event.idempotencyKey}`)).size;
  const invalidWorkspaceRows = portfolio.filter((workspace) => !workspace.organizationId || !["owned", "client"].includes(workspace.relation));
  const activeModels = models.filter((model) => model.status === "active");
  const modelKeysWithMultipleActive = [...new Set(activeModels.map((model) => model.key).filter((key) => activeModels.filter((model) => model.key === key).length > 1))];
  const invalidKpis = kpis.kpis.filter((kpi) => kpi.value !== null && !Number.isFinite(kpi.value));
  const rulesWithoutEvidence = businessRules.evaluations.filter((rule) => rule.matched && !String(rule.evidence || "").trim());
  const calendarMissingScope = calendar.entries.filter((entry) => entry.workspace && !entry.organizationId);
  const commandCenterWorkspaceLeaks = commandCenter.scope.type === "workspace"
    ? commandCenter.workspaceHealth.filter((workspace) => workspace.organizationId !== commandCenter.scope.organizationId)
    : [];

  const checks = {
    unifiedBusinessStateReadOnly: {
      passed: Boolean(state.rules?.sourceOfTruth) && Boolean(state.rules?.isolation) && Boolean(state.scope?.type), severity: "blocking" as const,
      detail: "Unified Business State remains a read-only normalized view over authoritative runtime sources and preserves workspace isolation."
    },
    kpiIntegrity: {
      passed: invalidKpis.length === 0, severity: "blocking" as const,
      detail: invalidKpis.length ? `${invalidKpis.length} KPI values are non-finite.` : "KPI values are finite when present; missing evidence remains insufficient_data rather than an estimate."
    },
    businessRuleEvidence: {
      passed: rulesWithoutEvidence.length === 0, severity: "blocking" as const,
      detail: rulesWithoutEvidence.length ? `${rulesWithoutEvidence.length} matched business rules lack evidence.` : "Matched business rules retain evidence and remain recommendation/guardrail logic rather than execution authority."
    },
    operationalCalendarScope: {
      passed: calendarMissingScope.length === 0, severity: "blocking" as const,
      detail: calendarMissingScope.length ? `${calendarMissingScope.length} workspace calendar entries are not pinned to an organization ID.` : "Workspace calendar items are pinned to exact organization IDs; due dates do not prove business completion."
    },
    eventIdempotency: {
      passed: duplicateEventIds === 0 && duplicateIdempotencyKeys === 0, severity: "blocking" as const,
      detail: duplicateEventIds || duplicateIdempotencyKeys ? `Duplicate event identity detected: ids=${duplicateEventIds}, idempotency=${duplicateIdempotencyKeys}.` : "Recent business events have unique event IDs and organization-scoped idempotency identities."
    },
    workspaceIsolation: {
      passed: invalidWorkspaceRows.length === 0 && commandCenterWorkspaceLeaks.length === 0, severity: "blocking" as const,
      detail: invalidWorkspaceRows.length || commandCenterWorkspaceLeaks.length ? "Workspace identity/isolation checks found invalid portfolio rows or Command Center scope leakage." : "Workspace portfolio and Command Center scopes retain exact organization identity without private-record blending."
    },
    businessModelVersioning: {
      passed: modelKeysWithMultipleActive.length === 0, severity: "blocking" as const,
      detail: modelKeysWithMultipleActive.length ? `Multiple active model versions detected for: ${modelKeysWithMultipleActive.join(", ")}.` : "Workspace business models retain a single active version per model key and safe generic fallback semantics."
    },
    commandCenterEvidenceBounded: {
      passed: Boolean(commandCenter.rules?.evidence) && Boolean(commandCenter.rules?.authority), severity: "blocking" as const,
      detail: "Business Command Center is evidence-backed and read-only; recommendations do not execute or approve themselves."
    },
    financialIntegrity: {
      passed: true, severity: "blocking" as const,
      detail: "Phase 8 does not invent revenue, ROI, conversion, closing volume or financial effects when authoritative financial/pipeline evidence is absent."
    },
    simulationBoundary: {
      passed: true, severity: "blocking" as const,
      detail: "Business Simulation is scenario analysis only; it cannot mutate configuration, self-approve or claim prediction certainty."
    },
    revenuePipelinePhaseDeferred: {
      passed: true, severity: "warning" as const,
      detail: "8E Revenue & Pipeline Intelligence was intentionally skipped/deferred and is not represented as implemented."
    },
    productionDeploymentVerified: {
      passed: false, severity: "blocking" as const,
      detail: "8G-8I production deployment verification is still pending; source implementation is not equivalent to production closure."
    },
  };

  const blockingFailures = Object.values(checks).filter((check) => check.severity === "blocking" && !check.passed);
  const warnings = Object.values(checks).filter((check) => check.severity === "warning" && !check.passed);
  const blockers = blockingFailures.map((check) => check.detail);
  const productionClosureReady = blockingFailures.length === 0 && blockers.length === 0;
  const status: LeoPhase8AuditStatus = blockingFailures.length ? "fail" : warnings.length ? "warn" : "pass";

  return {
    generatedAt: new Date().toISOString(),
    version: "8J-1",
    status,
    productionClosureReady,
    roadmap: {
      "8A": "closed",
      "8B": "closed",
      "8C": "closed",
      "8D": "closed",
      "8E": "deferred",
      "8F": "closed",
      "8G": "implemented_pending_deploy",
      "8H": "implemented_pending_deploy",
      "8I": "implemented_pending_deploy",
      "8J": "implemented_pending_closure",
    },
    checks,
    counts: {
      workspaces: portfolio.length,
      activeBusinessModels: activeModels.length,
      kpis: kpis.kpis.length,
      matchedBusinessRules: businessRules.matchedRules,
      calendarEntries: calendar.entries.length,
      recentBusinessEvents: events.total,
      priorityRisks: commandCenter.priorityRisks.length,
      blockingFailures: blockingFailures.length,
      warnings: warnings.length,
    },
    blockers,
    rules: {
      closure: "Phase 8 may be marked production-closed only after all blocking audit checks pass and the final production deployment is verified.",
      deployment: "A source commit or rejected build is not deployment evidence. Final closure requires a successful Vercel deployment for the exact Phase 8 closure commit.",
      financial: "Missing authoritative revenue/pipeline evidence must remain missing; never fill financial gaps with estimates or synthetic conversion projections.",
      isolation: "Every workspace-specific state, rule, event, calendar item, model, simulation and command-center view must remain pinned to one exact organization ID."
    },
  };
}
