import type { LeoTaskStep } from "@/lib/leo-task-plan";

export type LeoTaskEvidenceStatus = "verified" | "executed" | "pending" | "partial" | "failed";
export type LeoTaskStepEvidence = {
  status: LeoTaskEvidenceStatus;
  source: "tool_result" | "provider_status" | "read_observation";
  summary: string;
  checkedAt: string;
  counts?: {
    accepted?: number;
    sent?: number;
    delivered?: number;
    read?: number;
    failed?: number;
    unresolved?: number;
    pending?: number;
  };
};
export type LeoTaskRecoveryPolicy = {
  retrySafe: boolean;
  requiresFreshApproval: boolean;
  reason: string;
};

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickNumber(result: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = finiteNumber(result[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function nestedResult(result: Record<string, unknown>) {
  const nested = result.result;
  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : result;
}

export function classifyLeoTaskStepEvidence(step: LeoTaskStep, rawResult: Record<string, unknown>): LeoTaskStepEvidence {
  const result = nestedResult(rawResult);
  const accepted = pickNumber(result, ["accepted"]);
  const sent = pickNumber(result, ["sent", "sentOnly", "sent_only"]);
  const delivered = pickNumber(result, ["delivered"]);
  const read = pickNumber(result, ["read"]);
  const failed = pickNumber(result, ["failed"]);
  const unresolved = pickNumber(result, ["unresolved"]);
  const pending = pickNumber(result, ["pendingDelivery", "pending_delivery", "pending"]);
  const counts = { accepted, sent, delivered, read, failed, unresolved, pending };
  const hasDeliveryEvidence = [accepted, sent, delivered, read, failed, unresolved, pending].some((value) => value !== undefined);
  const checkedAt = new Date().toISOString();

  if (step.readOnly) {
    return {
      status: "verified",
      source: "read_observation",
      summary: "The read step returned an observable result from the authoritative tool path.",
      checkedAt,
    };
  }

  if (/\.prepare$/.test(step.toolKey)) {
    return {
      status: "verified",
      source: "tool_result",
      summary: "The preparation step completed and returned its prepared result. No consequential action was executed.",
      checkedAt,
    };
  }

  if (hasDeliveryEvidence) {
    const failedCount = failed || 0;
    const unresolvedCount = (unresolved || 0) + (pending || 0);
    const confirmedCount = (delivered || 0) + (read || 0);
    const acceptedOrSent = accepted ?? sent ?? 0;
    if (failedCount > 0 && (confirmedCount > 0 || acceptedOrSent > failedCount)) {
      return {
        status: "partial",
        source: "provider_status",
        summary: `Execution completed with mixed provider evidence: ${confirmedCount} delivery/read confirmations, ${failedCount} failures${unresolvedCount ? `, ${unresolvedCount} unresolved` : ""}.`,
        checkedAt,
        counts,
      };
    }
    if (failedCount > 0 && confirmedCount === 0 && unresolvedCount === 0 && acceptedOrSent <= failedCount) {
      return {
        status: "failed",
        source: "provider_status",
        summary: `Provider evidence reports ${failedCount} failed outcome${failedCount === 1 ? "" : "s"}.`,
        checkedAt,
        counts,
      };
    }
    if (unresolvedCount > 0 || (acceptedOrSent > 0 && confirmedCount === 0)) {
      return {
        status: "pending",
        source: "provider_status",
        summary: `The action was accepted/executed, but ${unresolvedCount || acceptedOrSent} outcome${(unresolvedCount || acceptedOrSent) === 1 ? " is" : "s are"} not yet independently confirmed.`,
        checkedAt,
        counts,
      };
    }
    if (confirmedCount > 0) {
      return {
        status: "verified",
        source: "provider_status",
        summary: `Provider evidence confirms ${confirmedCount} delivered/read outcome${confirmedCount === 1 ? "" : "s"}.`,
        checkedAt,
        counts,
      };
    }
  }

  return {
    status: "executed",
    source: "tool_result",
    summary: "The tool execution returned successfully, but no independent post-condition evidence was present in the result.",
    checkedAt,
  };
}

export function recoveryPolicyForLeoTaskStep(step: LeoTaskStep): LeoTaskRecoveryPolicy {
  if (step.readOnly || /\.prepare$/.test(step.toolKey)) {
    return {
      retrySafe: true,
      requiresFreshApproval: false,
      reason: "This step is read-only or preparation-only, so retrying cannot repeat a consequential external action.",
    };
  }
  return {
    retrySafe: false,
    requiresFreshApproval: step.approval !== "none",
    reason: "This step may have produced an external side effect. Leo must inspect evidence before any retry so it does not duplicate an action whose first outcome is uncertain.",
  };
}
