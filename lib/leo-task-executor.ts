import type { LeoIdentity } from "@/lib/leo-core";
import type { LeoSessionState } from "@/lib/leo-session-store";
import { classifyLeoTaskStepEvidence, recoveryPolicyForLeoTaskStep } from "@/lib/leo-task-evidence";
import { loadLeoOperationalTask, requestLeoTaskStepApproval, resetLeoOperationalTaskStepForRecovery, taskStepApprovalIsValid, updateLeoOperationalTask, type LeoOperationalTask } from "@/lib/leo-task-plan";

export type LeoTaskRunStopReason =
  | "completed"
  | "approval_required"
  | "manual_boundary"
  | "recovery_required"
  | "evidence_pending"
  | "evidence_partial"
  | "evidence_failed"
  | "step_failed"
  | "step_limit"
  | "task_not_found"
  | "task_inactive";

function canAutoExecute(task: LeoOperationalTask) {
  const step = task.steps[task.currentStep];
  if (!step) return false;
  if (step.approval !== "none") return false;
  if (step.readOnly) return true;
  return /\.prepare$/.test(step.toolKey);
}

async function executeStepThroughLeoToolRoute(input: {
  request: Request;
  session: LeoSessionState;
  task: LeoOperationalTask;
  confirmed: boolean;
}) {
  const step = input.task.steps[input.task.currentStep];
  const origin = new URL(input.request.url).origin;
  const cookie = input.request.headers.get("cookie") || "";
  const requestId = `leo-task:${input.task.id}:${step.id}`;
  const response = await fetch(`${origin}/api/leo/tool`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      channel: "api",
      sessionId: input.session.id,
      requestId,
      toolKey: step.toolKey,
      arguments: step.arguments,
      confirmed: input.confirmed,
    }),
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || result.ok === false) {
    const error = String(result.error || result.message || `Leo tool ${step.toolKey} returned HTTP ${response.status}.`);
    throw new Error(error);
  }
  if (result.status === "confirmation_required") {
    throw new Error(`Tool ${step.toolKey} requested confirmation even though the task checkpoint did not authorize execution.`);
  }
  return result;
}

function stopReasonForEvidence(status: string): LeoTaskRunStopReason | null {
  if (status === "pending") return "evidence_pending";
  if (status === "partial") return "evidence_partial";
  if (status === "failed") return "evidence_failed";
  return null;
}

export async function runLeoOperationalTask(input: {
  request: Request;
  identity: LeoIdentity;
  session: LeoSessionState;
  taskId: string;
  maxSteps?: number;
}) {
  if (input.identity.scope !== "super_admin") throw new Error("Operational task execution is currently restricted to Super Leo.");
  let task = await loadLeoOperationalTask(input.identity, input.session, input.taskId);
  if (!task) return { ok: false, stopReason: "task_not_found" as LeoTaskRunStopReason, executedSteps: 0, task: null };
  if (["completed", "canceled"].includes(task.status)) return { ok: true, stopReason: "task_inactive" as LeoTaskRunStopReason, executedSteps: 0, task };

  const maxSteps = Math.max(1, Math.min(Number(input.maxSteps) || 6, 12));
  let executedSteps = 0;

  while (executedSteps < maxSteps) {
    const step = task.steps[task.currentStep];
    if (!step) return { ok: true, stopReason: "completed" as LeoTaskRunStopReason, executedSteps, task };

    if (step.status === "waiting_evidence") {
      const stopReason = stopReasonForEvidence(step.evidence?.status || "pending") || "evidence_pending";
      return {
        ok: step.evidence?.status !== "failed",
        stopReason,
        executedSteps,
        task,
        pendingStep: step,
        evidence: step.evidence,
        message: step.evidence?.summary || "This step is waiting for evidence before Leo can continue downstream execution.",
      };
    }

    if (step.status === "failed") {
      return {
        ok: false,
        stopReason: "recovery_required" as LeoTaskRunStopReason,
        executedSteps,
        task,
        pendingStep: step,
        recovery: step.recovery || recoveryPolicyForLeoTaskStep(step),
        message: "The current task step previously failed. Leo will not silently retry it; use the controlled recovery action so duplicate side effects are not created.",
      };
    }

    let confirmed = false;
    if (step.approval === "admin") {
      return { ok: true, stopReason: "manual_boundary" as LeoTaskRunStopReason, executedSteps, task, pendingStep: step, message: "This task step requires platform-admin review and cannot be autonomously approved." };
    }
    if (step.approval === "confirm") {
      if (!taskStepApprovalIsValid(task)) {
        task = await requestLeoTaskStepApproval({ identity: input.identity, session: input.session, task });
        return {
          ok: true,
          stopReason: "approval_required" as LeoTaskRunStopReason,
          executedSteps,
          task,
          pendingStep: task.steps[task.currentStep],
          approval: {
            taskId: task.id,
            stepId: task.steps[task.currentStep].id,
            token: task.steps[task.currentStep].approvalState?.token,
            requestedAt: task.steps[task.currentStep].approvalState?.requestedAt,
          },
        };
      }
      confirmed = true;
    } else if (!canAutoExecute(task)) {
      return { ok: true, stopReason: "manual_boundary" as LeoTaskRunStopReason, executedSteps, task, pendingStep: step };
    }

    task = await updateLeoOperationalTask({
      identity: input.identity,
      session: input.session,
      task,
      stepIndex: task.currentStep,
      stepStatus: "executing",
    });

    const executingStep = task.steps[task.currentStep];
    try {
      const result = await executeStepThroughLeoToolRoute({ request: input.request, session: input.session, task, confirmed });
      const evidence = classifyLeoTaskStepEvidence(executingStep, result);
      const evidenceStop = stopReasonForEvidence(evidence.status);

      if (evidenceStop) {
        const recovery = evidence.status === "failed" ? recoveryPolicyForLeoTaskStep(executingStep) : undefined;
        task = await updateLeoOperationalTask({
          identity: input.identity,
          session: input.session,
          task,
          stepIndex: task.currentStep,
          stepStatus: evidence.status === "failed" ? "failed" : "waiting_evidence",
          result,
          evidence,
          recovery,
          error: evidence.status === "failed" ? evidence.summary : undefined,
        });
        executedSteps += 1;
        return {
          ok: evidence.status !== "failed",
          stopReason: evidenceStop,
          executedSteps,
          task,
          pendingStep: task.steps[task.currentStep],
          evidence,
          recovery,
          message: evidence.summary,
        };
      }

      task = await updateLeoOperationalTask({
        identity: input.identity,
        session: input.session,
        task,
        stepIndex: task.currentStep,
        stepStatus: "completed",
        result,
        evidence,
      });
      executedSteps += 1;
      if (task.status === "completed") return { ok: true, stopReason: "completed" as LeoTaskRunStopReason, executedSteps, task };
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : "Leo could not execute this task step.";
      const recovery = recoveryPolicyForLeoTaskStep(executingStep);
      task = await updateLeoOperationalTask({
        identity: input.identity,
        session: input.session,
        task,
        stepIndex: task.currentStep,
        stepStatus: "failed",
        recovery,
        error,
      });
      return { ok: false, stopReason: "step_failed" as LeoTaskRunStopReason, executedSteps, task, error, recovery };
    }
  }

  return { ok: true, stopReason: "step_limit" as LeoTaskRunStopReason, executedSteps, task };
}

export async function recoverLeoOperationalTask(input: {
  request: Request;
  identity: LeoIdentity;
  session: LeoSessionState;
  taskId: string;
  maxSteps?: number;
}) {
  if (input.identity.scope !== "super_admin") throw new Error("Operational task recovery is currently restricted to Super Leo.");
  const task = await loadLeoOperationalTask(input.identity, input.session, input.taskId);
  if (!task) return { ok: false, stopReason: "task_not_found" as LeoTaskRunStopReason, executedSteps: 0, task: null };
  const step = task.steps[task.currentStep];
  if (!step || step.status !== "failed") {
    return { ok: false, stopReason: "manual_boundary" as LeoTaskRunStopReason, executedSteps: 0, task, message: "There is no current failed task step to recover." };
  }

  const recovery = recoveryPolicyForLeoTaskStep(step);
  if (!recovery.retrySafe) {
    return {
      ok: false,
      stopReason: "manual_boundary" as LeoTaskRunStopReason,
      executedSteps: 0,
      task,
      pendingStep: step,
      recovery,
      message: recovery.reason,
    };
  }

  await resetLeoOperationalTaskStepForRecovery({
    identity: input.identity,
    session: input.session,
    task,
    stepIndex: task.currentStep,
    recovery,
  });

  return runLeoOperationalTask({
    request: input.request,
    identity: input.identity,
    session: input.session,
    taskId: input.taskId,
    maxSteps: input.maxSteps,
  });
}
