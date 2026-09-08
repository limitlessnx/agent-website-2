import { createHash } from "node:crypto";
import { getUnifiedLifecycleSnapshots, type UnifiedLifecycleSnapshot } from "@/lib/lifecycle-intelligence";
import type { LeoProactiveSignal, LeoSignalSeverity } from "@/lib/leo-proactive-monitor";

function stableId(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

function signal(input: Omit<LeoProactiveSignal, "id" | "detectedAt"> & { detectedAt?: string; subtype: string }): LeoProactiveSignal {
  const detectedAt = input.detectedAt || new Date().toISOString();
  const { subtype, ...rest } = input;
  return {
    ...rest,
    detectedAt,
    id: stableId(["lifecycle", rest.workspace || "", subtype]),
    evidence: { ...(rest.evidence || {}), lifecycle_subtype: subtype },
  };
}

function usageDecline(item: UnifiedLifecycleSnapshot) {
  const previous = Math.max(0, item.previous30DayUsage || 0);
  const current = Math.max(0, item.current30DayUsage || 0);
  if (previous < 10 || current > previous * 0.5) return null;
  const drop = previous > 0 ? Math.round((1 - current / previous) * 100) : 0;
  const severity: LeoSignalSeverity = current === 0 || drop >= 75 ? "high" : "medium";
  return signal({
    category: "lifecycle",
    subtype: "usage_decline",
    severity,
    title: `${item.organizationName} usage has dropped materially`,
    summary: `Measured 30-day usage fell from ${previous} to ${current}, a ${drop}% decline.`,
    recommendation: "Review the usage trend and recent customer activity before deciding whether intervention is needed.",
    href: `/dashboard/value?organizationId=${encodeURIComponent(item.organizationId)}`,
    sourceId: `${item.organizationId}:usage_decline`,
    workspace: item.organizationId,
    evidence: { organization_id: item.organizationId, organization_name: item.organizationName, current_30_day_usage: current, previous_30_day_usage: previous, decline_percent: drop, stage: item.stage, attention: item.attention },
  });
}

export async function scanLifecycleProactiveSignals(now = new Date()) {
  const snapshots = await getUnifiedLifecycleSnapshots(30).catch(() => []);
  const signals: LeoProactiveSignal[] = [];

  for (const item of snapshots) {
    if (item.retentionStage === "cancellation_requested") {
      signals.push(signal({
        category: "lifecycle", subtype: "cancellation_intent", severity: "critical",
        title: `${item.organizationName} has cancellation intent`,
        summary: item.reasons[0] || "The account lifecycle indicates a cancellation request.",
        recommendation: "Review the cancellation reason and customer context before any retention or account action.",
        href: `/dashboard/retention?organizationId=${encodeURIComponent(item.organizationId)}`,
        sourceId: `${item.organizationId}:cancellation_intent`, workspace: item.organizationId,
        evidence: { organization_id: item.organizationId, organization_name: item.organizationName, retention_stage: item.retentionStage, retention_risk_score: item.retentionRiskScore, health_score: item.healthScore, reasons: item.reasons.slice(0, 5) },
      }));
    }

    if (item.attention === "critical" || item.attention === "high") {
      signals.push(signal({
        category: "lifecycle", subtype: "lifecycle_risk", severity: item.attention === "critical" ? "critical" : "high",
        title: `${item.organizationName} lifecycle risk requires attention`,
        summary: item.reasons[0] || item.recommendedNextAction,
        recommendation: item.recommendedNextAction,
        href: `/dashboard/lifecycle?organizationId=${encodeURIComponent(item.organizationId)}`,
        sourceId: `${item.organizationId}:lifecycle_risk`, workspace: item.organizationId,
        evidence: { organization_id: item.organizationId, organization_name: item.organizationName, stage: item.stage, attention: item.attention, health_score: item.healthScore, retention_risk_score: item.retentionRiskScore, unresolved_support_cases: item.unresolvedSupportCases, connected_integrations: item.connectedIntegrations, reasons: item.reasons.slice(0, 5) },
      }));
    }

    const decline = usageDecline(item);
    if (decline) signals.push(decline);

    if (item.unresolvedSupportCases >= 3) {
      const severity: LeoSignalSeverity = item.unresolvedSupportCases >= 5 || item.attention === "critical" ? "high" : "medium";
      signals.push(signal({
        category: "lifecycle", subtype: "support_pressure", severity,
        title: `${item.organizationName} has rising support pressure`,
        summary: `${item.unresolvedSupportCases} support cases are currently unresolved.`,
        recommendation: "Review unresolved cases for a recurring blocker or escalation pattern before changing the account.",
        href: `/dashboard/support?organizationId=${encodeURIComponent(item.organizationId)}`,
        sourceId: `${item.organizationId}:support_pressure`, workspace: item.organizationId,
        evidence: { organization_id: item.organizationId, organization_name: item.organizationName, unresolved_support_cases: item.unresolvedSupportCases, stage: item.stage, attention: item.attention },
      }));
    }

    if (item.connectedIntegrations === 0 && item.reasons.some((reason) => /integration|connected/i.test(reason))) {
      signals.push(signal({
        category: "lifecycle", subtype: "integration_loss", severity: item.attention === "critical" ? "critical" : "high",
        title: `${item.organizationName} has no healthy connected integration`,
        summary: item.reasons.find((reason) => /integration|connected/i.test(reason)) || "No configured integration is currently healthy or connected.",
        recommendation: "Inspect integration health and dependent workflows before reconnecting credentials or changing providers.",
        href: `/dashboard/integrations?organizationId=${encodeURIComponent(item.organizationId)}`,
        sourceId: `${item.organizationId}:integration_loss`, workspace: item.organizationId,
        evidence: { organization_id: item.organizationId, organization_name: item.organizationName, connected_integrations: item.connectedIntegrations, health_score: item.healthScore, stage: item.stage, attention: item.attention },
      }));
    }

    if (item.stage === "expansion" && item.attention !== "high" && item.attention !== "critical" && item.opportunityScore >= 30) {
      signals.push(signal({
        category: "lifecycle", subtype: "expansion_ready", severity: item.opportunityScore >= 60 ? "medium" : "low",
        title: `${item.organizationName} is expansion-ready`,
        summary: item.recommendedNextAction,
        recommendation: "Review the measured opportunity with a human before any commercial outreach or plan change.",
        href: `/dashboard/expansion?organizationId=${encodeURIComponent(item.organizationId)}`,
        sourceId: `${item.organizationId}:expansion_ready`, workspace: item.organizationId,
        evidence: { organization_id: item.organizationId, organization_name: item.organizationName, opportunity_score: item.opportunityScore, opportunity_count: item.opportunityCount, stage: item.stage, attention: item.attention },
      }));
    }
  }

  return { generatedAt: now.toISOString(), organizations: snapshots.length, signals };
}
