import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { getOrCreateLeoSession, auditLeoEvent } from "@/lib/leo-session-store";
import { approveLeoTaskStep, cancelLeoOperationalTask, createLeoOperationalTask, loadActiveLeoOperationalTask, loadLeoOperationalTask, reviseLeoOperationalTaskCurrentStep } from "@/lib/leo-task-plan";
import { recoverLeoOperationalTask, runLeoOperationalTask } from "@/lib/leo-task-executor";
import { createLeoMultiAgentOrchestration, refreshLeoMultiAgentOrchestration } from "@/lib/leo-multi-agent-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TaskStepInput = { title?: string; toolKey: string; arguments: Record<string, unknown> };
type TaskActionResult = {
  ok: boolean;
  stopReason: string;
  executedSteps: number;
  task: { currentStep?: number } | null;
  pendingStep?: { id?: string; toolKey?: string };
  evidence?: { status?: string; source?: string; summary?: string };
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function auditTaskResult(input: { identity: NonNullable<Awaited<ReturnType<typeof resolveLeoIdentity>>>; session: Awaited<ReturnType<typeof getOrCreateLeoSession>>; taskId: string; action: "run" | "recover"; result: TaskActionResult }) {
  const { identity, session, taskId, action, result } = input;
  await auditLeoEvent({ identity, session, eventType: action === "recover" ? "operational_task_recovery" : "operational_task_run", details: { task_id: taskId, stop_reason: result.stopReason, executed_steps: result.executedSteps, ok: result.ok } });
  if (result.stopReason === "approval_required") {
    await auditLeoEvent({ identity, session, eventType: "operational_task_approval_requested", toolKey: result.pendingStep?.toolKey, details: { task_id: taskId, step_id: result.pendingStep?.id, step_index: result.task?.currentStep } });
  }
  if (["evidence_pending", "evidence_partial", "evidence_failed"].includes(result.stopReason)) {
    await auditLeoEvent({ identity, session, eventType: "operational_task_evidence_checked", details: { task_id: taskId, stop_reason: result.stopReason, evidence_status: result.evidence?.status, evidence_source: result.evidence?.source, evidence_summary: result.evidence?.summary } });
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
    if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Leo task operations require super-admin access." }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "run").trim().toLowerCase();
    const sessionId = String(body.sessionId || body.session_id || "").trim();
    if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    const session = await getOrCreateLeoSession({ identity, sessionId });

    if (action === "orchestrate") {
      const context = object(body.arguments);
      const orchestration = await createLeoMultiAgentOrchestration({
        identity,
        session,
        objective: String(body.reason || body.goal || context.objective || "").trim(),
        workspace: String(context.workspace || body.workspace || "").trim() || undefined,
        organizationId: String(context.organization_id || context.organizationId || "").trim() || undefined,
        context,
      });
      const refreshed = await refreshLeoMultiAgentOrchestration({ identity, session, orchestration });
      await auditLeoEvent({ identity, session, eventType: "multi_agent_orchestration_created", details: { orchestration_id: orchestration.id, task_id: orchestration.taskId, objective: orchestration.objective, specialists: orchestration.delegations.map((item) => item.specialist.key) } });
      return NextResponse.json({ ok: true, orchestration: refreshed.orchestration, task: refreshed.task }, { status: 201 });
    }

    if (action === "create") {
      const rawSteps: unknown[] = Array.isArray(body.steps) ? body.steps : [];
      const steps: TaskStepInput[] = rawSteps.map((value: unknown) => {
        const row = object(value);
        return { title: String(row.title || "").trim() || undefined, toolKey: String(row.toolKey || row.tool_key || "").trim(), arguments: object(row.arguments) };
      });
      if (steps.some((step: TaskStepInput) => !step.toolKey)) return NextResponse.json({ error: "Every task step requires a toolKey." }, { status: 400 });
      const task = await createLeoOperationalTask({ identity, session, goal: String(body.goal || ""), workspace: String(body.workspace || "").trim() || undefined, steps });
      await auditLeoEvent({ identity, session, eventType: "operational_task_created", details: { task_id: task.id, goal: task.goal, step_count: task.steps.length } });
      return NextResponse.json({ ok: true, task }, { status: 201 });
    }

    const requestedTaskId = String(body.taskId || body.task_id || "").trim();
    const resolveTask = async () => requestedTaskId ? loadLeoOperationalTask(identity, session, requestedTaskId) : loadActiveLeoOperationalTask(identity, session);

    if (action === "get" || action === "active") {
      const task = await resolveTask();
      if (!task) return NextResponse.json({ error: "No active task was found for this Leo session." }, { status: 404 });
      return NextResponse.json({ ok: true, task });
    }

    if (action === "revise") {
      const task = await resolveTask();
      if (!task) return NextResponse.json({ error: "No active task was found for this Leo session." }, { status: 404 });
      const revised = await reviseLeoOperationalTaskCurrentStep({ identity, session, task, toolKey: String(body.toolKey || body.tool_key || "").trim() || undefined, title: String(body.title || "").trim() || undefined, arguments: body.arguments && typeof body.arguments === "object" && !Array.isArray(body.arguments) ? body.arguments as Record<string, unknown> : undefined });
      await auditLeoEvent({ identity, session, eventType: "operational_task_revised", toolKey: revised.steps[revised.currentStep]?.toolKey, details: { task_id: revised.id, step_id: revised.steps[revised.currentStep]?.id, step_index: revised.currentStep, approval_invalidated: true } });
      return NextResponse.json({ ok: true, status: "revised", task: revised, currentStep: revised.steps[revised.currentStep] });
    }

    if (action === "cancel") {
      const task = await resolveTask();
      if (!task) return NextResponse.json({ error: "No active task was found for this Leo session." }, { status: 404 });
      const canceled = await cancelLeoOperationalTask({ identity, session, task, reason: String(body.reason || "").trim() || undefined });
      await auditLeoEvent({ identity, session, eventType: "operational_task_canceled", details: { task_id: canceled.id, step_index: canceled.currentStep, reason: String(body.reason || "").trim() || undefined } });
      return NextResponse.json({ ok: true, status: "canceled", task: canceled });
    }

    if (action === "approve") {
      const token = String(body.token || body.approval_token || "").trim();
      if (!token) return NextResponse.json({ error: "approval token is required." }, { status: 400 });
      const task = await resolveTask();
      if (!task) return NextResponse.json({ error: "No active task was found for this Leo session." }, { status: 404 });
      const stepBefore = task.steps[task.currentStep];
      const approved = await approveLeoTaskStep({ identity, session, task, token });
      const stepAfter = approved.steps[approved.currentStep];
      await auditLeoEvent({ identity, session, eventType: "operational_task_step_approved", toolKey: stepAfter?.toolKey, details: { task_id: task.id, step_id: stepAfter?.id || stepBefore?.id, step_index: approved.currentStep, approval_mode: stepAfter?.approval } });
      return NextResponse.json({ ok: true, status: "approved", task: approved, approvedStep: stepAfter });
    }

    if (action === "run" || action === "recover" || action === "resume") {
      const task = await resolveTask();
      if (!task) return NextResponse.json({ error: "No active task was found for this Leo session." }, { status: 404 });
      const taskId = task.id;
      const maxSteps = Number(body.maxSteps || body.max_steps) || undefined;
      const recovery = action === "recover";
      const result = recovery ? await recoverLeoOperationalTask({ request, identity, session, taskId, maxSteps }) : await runLeoOperationalTask({ request, identity, session, taskId, maxSteps });
      await auditTaskResult({ identity, session, taskId, action: recovery ? "recover" : "run", result: result as TaskActionResult });
      return NextResponse.json(result, { status: result.ok ? 200 : result.stopReason === "task_not_found" ? 404 : 409 });
    }

    return NextResponse.json({ error: "Unsupported task action. Use orchestrate, create, get, active, revise, cancel, approve, run, resume or recover." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Super Leo task operation failed.";
    const status = /approval token|changed after approval|waiting for confirmation|already executing|cannot be revised/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
