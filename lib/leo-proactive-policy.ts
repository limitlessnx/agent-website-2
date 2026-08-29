import type { LeoPersistedSignal } from "@/lib/leo-proactive-signal-store";
import type { LeoProactiveSignal, LeoSignalCategory, LeoSignalSeverity } from "@/lib/leo-proactive-monitor";

export type LeoAlertMode = "interrupt" | "surface" | "quiet";
export type LeoSignalRecommendation = {
  likelyCause: string;
  verifyNext: string[];
  safeNextStep: string;
  consequenceBoundary: string;
};
export type LeoSignalActionBlueprint = {
  goal: string;
  workspace?: string;
  steps: Array<{ title: string; toolKey: string; arguments: Record<string, unknown> }>;
  note?: string;
};

const severityWeight: Record<LeoSignalSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const cooldownMinutes: Record<LeoSignalSeverity, number> = { critical: 60, high: 180, medium: 720, low: 1440 };

export function recommendationForLeoSignal(signal: LeoProactiveSignal): LeoSignalRecommendation {
  if (signal.category === "workflow") return {
    likelyCause: "The workflow registry or a recent execution reports an error, timeout, or repeated failure. The exact cause must come from the recorded run evidence rather than assumption.",
    verifyNext: ["Inspect the latest failed execution and its error message.", "Check whether the failure is transient or configuration-related.", "Confirm that replaying the failed execution would not duplicate an external action."],
    safeNextStep: "Inspect the workflow and failed run first. Retry or resync only after the failure is understood and repeat safety is established.",
    consequenceBoundary: "Activation, deactivation, resync, retry, or any action that can repeat external side effects remains approval-gated.",
  };
  if (signal.category === "campaign") return {
    likelyCause: "Provider delivery evidence contains failures or remains unresolved beyond the expected observation window.",
    verifyNext: ["Reconcile accepted recipients against durable delivery status.", "Group failed recipients by provider error code.", "Separate unresolved recipients from confirmed failures before any resend decision."],
    safeNextStep: "Review delivery evidence and isolate the exact failed recipient subset. Do not replay the whole campaign.",
    consequenceBoundary: "Any resend requires an exact recipient boundary and fresh approval. Accepted or sent does not equal delivered.",
  };
  if (signal.category === "lead") return {
    likelyCause: "A qualified or hot lead has no recent recorded contact activity, which may indicate a missed follow-up or stale CRM state.",
    verifyNext: ["Open the lead record and review the latest conversation/follow-up history.", "Confirm whether the lead has replied or been contacted through another channel.", "Check whether an existing follow-up task is already scheduled."],
    safeNextStep: "Inspect the lead history and prepare the appropriate follow-up only if it is still due.",
    consequenceBoundary: "Sending a message remains approval-gated. Leo should not contact the lead merely because the monitor detected staleness.",
  };
  if (signal.category === "integration") return {
    likelyCause: "An organization integration reports a disconnected, error, expired, or otherwise unhealthy state.",
    verifyNext: ["Inspect the integration status and last check time.", "Confirm whether the provider connection is actually unavailable.", "Identify whether dependent workflows are currently failing."],
    safeNextStep: "Inspect the integration and affected workflows before changing credentials or reconnecting anything.",
    consequenceBoundary: "Credential changes, reconnection, or workflow changes remain explicit admin actions and are never performed by monitoring alone.",
  };
  return {
    likelyCause: "The client workspace has remained in an incomplete operational state without a recent onboarding update.",
    verifyNext: ["Review the current onboarding step.", "Identify who owns the next required action.", "Confirm whether configuration, testing, or approval is blocked."],
    safeNextStep: "Inspect the workspace and identify the blocker before changing its state.",
    consequenceBoundary: "Tenant state changes remain approval-gated and tenant isolation must be preserved.",
  };
}

export function alertPolicyForLeoSignal(signal: LeoPersistedSignal, now = new Date()) {
  const cooldown = cooldownMinutes[signal.severity];
  const lastAlerted = signal.lastAlertedAt ? new Date(signal.lastAlertedAt).getTime() : 0;
  const cooldownElapsed = !lastAlerted || now.getTime() - lastAlerted >= cooldown * 60_000;
  const unresolved = signal.lifecycle !== "resolved";
  const acknowledged = signal.lifecycle === "acknowledged";
  const newlyDetected = signal.lifecycle === "new" || Boolean(signal.reopenedAt && (!signal.lastAlertedAt || signal.reopenedAt > signal.lastAlertedAt));

  let mode: LeoAlertMode = "quiet";
  let reason = "Signal remains available in monitoring history without interrupting the operator.";
  if (!unresolved) reason = "Resolved signals are not delivered as active alerts.";
  else if (acknowledged) reason = "Acknowledged signals remain visible but are suppressed from repeated proactive delivery.";
  else if (signal.severity === "critical" && (newlyDetected || cooldownElapsed)) {
    mode = "interrupt";
    reason = "Critical unresolved operational evidence warrants immediate Super Leo attention.";
  } else if (signal.severity === "high" && (newlyDetected || cooldownElapsed)) {
    mode = "surface";
    reason = "High-priority unresolved evidence should be surfaced without forcing an interruption.";
  } else if (signal.severity === "medium" && newlyDetected) {
    mode = "surface";
    reason = "New medium-priority evidence is surfaced once, then cooled down to prevent alert fatigue.";
  }
  return { mode, reason, cooldownMinutes: cooldown, deliver: unresolved && !acknowledged && mode !== "quiet", severityWeight: severityWeight[signal.severity] };
}

export function actionBlueprintForLeoSignal(signal: LeoProactiveSignal): LeoSignalActionBlueprint | null {
  const evidence = signal.evidence || {};
  if (signal.category === "workflow") {
    const organizationId = String(signal.workspace || evidence.organization_id || "").trim();
    const workflowKey = String(evidence.workflow_key || "").trim();
    if (!organizationId) return null;
    const steps: LeoSignalActionBlueprint["steps"] = [
      { title: "Inspect the failed workflow evidence", toolKey: "leo.workflow.inspect_failures", arguments: { organization_id: organizationId, workflow_key: workflowKey || undefined } },
    ];
    if (workflowKey) steps.push({ title: "Prepare controlled workflow resync", toolKey: "leo.platform.workflow.resync", arguments: { organization_id: organizationId, workflow_key: workflowKey } });
    return { goal: `Investigate and safely recover: ${signal.title}`, workspace: organizationId, steps };
  }
  if (signal.category === "integration") {
    const organizationId = String(signal.workspace || evidence.organization_id || "").trim();
    if (!organizationId) return null;
    return { goal: `Investigate integration health: ${signal.title}`, workspace: organizationId, steps: [{ title: "Inspect integration health", toolKey: "leo.integration.inspect", arguments: { organization_id: organizationId } }] };
  }
  if (signal.category === "lead") {
    return { goal: `Review lead attention signal: ${signal.title}`, workspace: "limitless_realty", steps: [{ title: "Inspect the exact Limitless Realty lead", toolKey: "leo.limitless.leads.read", arguments: { lead_id: signal.sourceId || evidence.lead_id } }], note: "No message is sent by this plan. Follow-up preparation and sending remain separate controlled steps." };
  }
  if (signal.category === "workspace") {
    const organizationId = String(signal.workspace || evidence.organization_id || "").trim();
    if (!organizationId) return null;
    return { goal: `Investigate stalled workspace: ${signal.title}`, workspace: organizationId, steps: [{ title: "Inspect tenant workspace health", toolKey: "leo.tenant.inspect", arguments: { organization_id: organizationId } }] };
  }
  return null;
}

export function sortDeliverableSignals<T extends LeoPersistedSignal>(signals: T[]) {
  return [...signals].sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity] || b.lastDetectedAt.localeCompare(a.lastDetectedAt));
}

export function categoryLabel(category: LeoSignalCategory) {
  return category.replaceAll("_", " ");
}
