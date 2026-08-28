import { createHash, randomUUID } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { resolveLeoTool, type LeoIdentity } from "@/lib/leo-core";
import type { LeoSessionState } from "@/lib/leo-session-store";

export type LeoTaskStepStatus = "pending" | "ready" | "waiting_confirmation" | "approved" | "executing" | "completed" | "failed" | "canceled";
export type LeoTaskStatus = "planning" | "ready" | "waiting_confirmation" | "executing" | "blocked" | "completed" | "canceled";
export type LeoTaskEvidenceStatus = "verified" | "executed" | "pending" | "partial" | "failed";
export type LeoTaskApproval = {
  token: string;
  fingerprint: string;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
};
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
export type LeoTaskRecoveryState = {
  retrySafe: boolean;
  requiresFreshApproval: boolean;
  reason: string;
  lastRecoveryAt?: string;
};
export type LeoTaskStep = {
  id: string;
  index: number;
  title: string;
  toolKey: string;
  arguments: Record<string, unknown>;
  approval: "none" | "confirm" | "admin";
  readOnly: boolean;
  status: LeoTaskStepStatus;
  approvalState?: LeoTaskApproval;
  result?: Record<string, unknown>;
  evidence?: LeoTaskStepEvidence;
  recovery?: LeoTaskRecoveryState;
  attempts?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};
export type LeoOperationalTask = {
  id: string;
  goal: string;
  workspace?: string;
  status: LeoTaskStatus;
  currentStep: number;
  steps: LeoTaskStep[];
  createdAt: string;
  updatedAt: string;
};

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(row).sort().map((key) => [key, canonical(row[key])]));
}
function stepFingerprint(taskId: string, step: LeoTaskStep) {
  return createHash("sha256").update(JSON.stringify(canonical({ taskId, stepId: step.id, toolKey: step.toolKey, arguments: step.arguments, approval: step.approval }))).digest("hex");
}
function taskKey(taskId: string) { return `leo_task:${taskId}`; }
function taskFromContent(value: unknown): LeoOperationalTask | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!row.id || !row.goal || !Array.isArray(row.steps)) return null;
  return row as unknown as LeoOperationalTask;
}

async function persist(identity: LeoIdentity, session: LeoSessionState, task: LeoOperationalTask) {
  if (identity.scope !== "super_admin" || !session.persisted) return task;
  const body = { id: taskKey(task.id), user_id: identity.email || identity.userId || "fluxknight_admin", role: "leo_operational_task", content: JSON.stringify({ ...task, sessionId: session.id }), created_at: task.createdAt };
  await supabaseServerRequest(`bot_sessions?id=eq.${encodeURIComponent(taskKey(task.id))}`, { method: "DELETE" }).catch(() => null);
  await supabaseServerRequest("bot_sessions", { method: "POST", body: JSON.stringify(body) });
  return task;
}

export async function createLeoOperationalTask(input: { identity: LeoIdentity; session: LeoSessionState; goal: string; workspace?: string; steps: Array<{ title?: string; toolKey: string; arguments?: Record<string, unknown> }> }) {
  if (input.identity.scope !== "super_admin") throw new Error("Operational task plans are currently restricted to Super Leo.");
  const goal = String(input.goal || "").trim();
  if (!goal) throw new Error("A task goal is required.");
  if (!input.steps.length || input.steps.length > 12) throw new Error("A task plan must contain between 1 and 12 steps.");
  const steps: LeoTaskStep[] = input.steps.map((candidate, index) => {
    const tool = resolveLeoTool(candidate.toolKey);
    if (!tool || !tool.scopes.includes("super_admin")) throw new Error(`Tool ${candidate.toolKey} is not available to Super Leo.`);
    return { id: randomUUID(), index, title: String(candidate.title || tool.title), toolKey: tool.key, arguments: candidate.arguments || {}, approval: tool.approval, readOnly: tool.readOnly, status: index === 0 ? "ready" : "pending", attempts: 0 };
  });
  const now = new Date().toISOString();
  return persist(input.identity, input.session, { id: randomUUID(), goal, workspace: input.workspace, status: "ready", currentStep: 0, steps, createdAt: now, updatedAt: now });
}

export async function loadLeoOperationalTask(identity: LeoIdentity, session: LeoSessionState, taskId: string) {
  if (identity.scope !== "super_admin" || !session.persisted) return null;
  const rows = await supabaseServerRequest<Array<{ content?: string }>>(`bot_sessions?select=content&id=eq.${encodeURIComponent(taskKey(taskId))}&role=eq.leo_operational_task&limit=1`).catch(() => []);
  if (!rows[0]?.content) return null;
  try {
    const parsed = JSON.parse(rows[0].content) as Record<string, unknown>;
    if (parsed.sessionId !== session.id) return null;
    return taskFromContent(parsed);
  } catch { return null; }
}

export async function loadActiveLeoOperationalTask(identity: LeoIdentity, session: LeoSessionState) {
  if (identity.scope !== "super_admin" || !session.persisted) return null;
  const rows = await supabaseServerRequest<Array<{ content?: string; created_at?: string }>>("bot_sessions?select=content,created_at&role=eq.leo_operational_task&order=created_at.desc&limit=30").catch(() => []);
  for (const row of rows) {
    if (!row.content) continue;
    try {
      const parsed = JSON.parse(row.content) as Record<string, unknown>;
      if (parsed.sessionId !== session.id) continue;
      const task = taskFromContent(parsed);
      if (task && !["completed", "canceled"].includes(task.status)) return task;
    } catch {}
  }
  return null;
}

export async function reviseLeoOperationalTaskCurrentStep(input: {
  identity: LeoIdentity;
  session: LeoSessionState;
  task: LeoOperationalTask;
  toolKey?: string;
  title?: string;
  arguments?: Record<string, unknown>;
}) {
  if (input.identity.scope !== "super_admin") throw new Error("Only Super Leo can revise an operational task.");
  if (["completed", "canceled"].includes(input.task.status)) throw new Error("Completed or canceled tasks cannot be revised.");
  const current = input.task.steps[input.task.currentStep];
  if (!current) throw new Error("The task has no current step to revise.");
  if (current.status === "executing") throw new Error("The current step is already executing. Verify its outcome before changing or retrying it.");
  const toolKey = String(input.toolKey || current.toolKey).trim();
  const tool = resolveLeoTool(toolKey);
  if (!tool || !tool.scopes.includes("super_admin")) throw new Error(`Tool ${toolKey} is not available to Super Leo.`);
  const now = new Date().toISOString();
  const steps = input.task.steps.map((step, index) => index === input.task.currentStep ? {
    ...step,
    title: String(input.title || step.title || tool.title),
    toolKey: tool.key,
    arguments: input.arguments ?? step.arguments,
    approval: tool.approval,
    readOnly: tool.readOnly,
    status: "ready" as LeoTaskStepStatus,
    approvalState: undefined,
    result: undefined,
    evidence: undefined,
    recovery: undefined,
    error: undefined,
    startedAt: undefined,
    completedAt: undefined,
  } : step);
  return persist(input.identity, input.session, { ...input.task, steps, status: "ready", updatedAt: now });
}

export async function cancelLeoOperationalTask(input: { identity: LeoIdentity; session: LeoSessionState; task: LeoOperationalTask; reason?: string }) {
  if (input.identity.scope !== "super_admin") throw new Error("Only Super Leo can cancel an operational task.");
  if (input.task.status === "completed") throw new Error("A completed task cannot be canceled.");
  if (input.task.status === "canceled") return input.task;
  const now = new Date().toISOString();
  const steps = input.task.steps.map((step, index) => index < input.task.currentStep || step.status === "completed" ? step : {
    ...step,
    status: "canceled" as LeoTaskStepStatus,
    approvalState: undefined,
    error: index === input.task.currentStep && input.reason ? `Canceled: ${input.reason}` : step.error,
  });
  return persist(input.identity, input.session, { ...input.task, steps, status: "canceled", updatedAt: now });
}

export async function requestLeoTaskStepApproval(input: { identity: LeoIdentity; session: LeoSessionState; task: LeoOperationalTask }) {
  const step = input.task.steps[input.task.currentStep];
  if (!step) throw new Error("The task has no current step to approve.");
  if (step.approval === "none") throw new Error("This task step does not require approval.");
  if (step.approval === "admin") throw new Error("This task step requires platform-admin review and cannot be self-approved through task execution.");
  const fingerprint = stepFingerprint(input.task.id, step);
  const existing = step.approvalState;
  const approvalState = existing && existing.fingerprint === fingerprint && !existing.approvedAt ? existing : { token: randomUUID(), fingerprint, requestedAt: new Date().toISOString() };
  const steps = input.task.steps.map((item, index) => index === input.task.currentStep ? { ...item, status: "waiting_confirmation" as LeoTaskStepStatus, approvalState } : item);
  const task = { ...input.task, steps, status: "waiting_confirmation" as LeoTaskStatus, updatedAt: new Date().toISOString() };
  return persist(input.identity, input.session, task);
}

export async function approveLeoTaskStep(input: { identity: LeoIdentity; session: LeoSessionState; task: LeoOperationalTask; token: string }) {
  if (input.identity.scope !== "super_admin") throw new Error("Only Super Leo can approve an operational task step.");
  const step = input.task.steps[input.task.currentStep];
  if (!step) throw new Error("The task has no current step to approve.");
  if (step.status !== "waiting_confirmation" || !step.approvalState) throw new Error("This task step is not currently waiting for confirmation.");
  const expectedFingerprint = stepFingerprint(input.task.id, step);
  if (step.approvalState.fingerprint !== expectedFingerprint) throw new Error("The pending task step changed after approval was requested. A new approval is required.");
  if (!input.token || input.token !== step.approvalState.token) throw new Error("The approval token does not match the exact pending task step.");
  const approvedAt = new Date().toISOString();
  const steps = input.task.steps.map((item, index) => index === input.task.currentStep ? { ...item, status: "approved" as LeoTaskStepStatus, approvalState: { ...item.approvalState!, approvedAt, approvedBy: input.identity.email || input.identity.userId || "super_admin" } } : item);
  const task = { ...input.task, steps, status: "ready" as LeoTaskStatus, updatedAt: approvedAt };
  return persist(input.identity, input.session, task);
}

export function taskStepApprovalIsValid(task: LeoOperationalTask) {
  const step = task.steps[task.currentStep];
  if (!step || step.approval !== "confirm" || step.status !== "approved" || !step.approvalState?.approvedAt) return false;
  return step.approvalState.fingerprint === stepFingerprint(task.id, step);
}

export async function resetLeoOperationalTaskStepForRecovery(input: { identity: LeoIdentity; session: LeoSessionState; task: LeoOperationalTask; stepIndex: number; recovery: LeoTaskRecoveryState }) {
  const step = input.task.steps[input.stepIndex];
  if (!step || step.status !== "failed") throw new Error("Only the current failed task step can be recovered.");
  if (input.stepIndex !== input.task.currentStep) throw new Error("Recovery is restricted to the current failed task step.");
  const now = new Date().toISOString();
  const steps = input.task.steps.map((item, index) => index === input.stepIndex ? {
    ...item,
    status: "ready" as LeoTaskStepStatus,
    error: undefined,
    completedAt: undefined,
    approvalState: input.recovery.requiresFreshApproval ? undefined : item.approvalState,
    recovery: { ...input.recovery, lastRecoveryAt: now },
  } : item);
  const task = { ...input.task, steps, status: "ready" as LeoTaskStatus, updatedAt: now };
  return persist(input.identity, input.session, task);
}

export async function updateLeoOperationalTask(input: { identity: LeoIdentity; session: LeoSessionState; task: LeoOperationalTask; stepIndex: number; stepStatus: LeoTaskStepStatus; result?: Record<string, unknown>; evidence?: LeoTaskStepEvidence; recovery?: LeoTaskRecoveryState; error?: string }) {
  const steps = input.task.steps.map((step, index) => index === input.stepIndex ? {
    ...step,
    status: input.stepStatus,
    result: input.result ?? step.result,
    evidence: input.evidence ?? step.evidence,
    recovery: input.recovery ?? step.recovery,
    error: input.error,
    attempts: input.stepStatus === "executing" ? (step.attempts || 0) + 1 : step.attempts || 0,
    startedAt: input.stepStatus === "executing" ? step.startedAt || new Date().toISOString() : step.startedAt,
    completedAt: input.stepStatus === "completed" || input.stepStatus === "failed" ? new Date().toISOString() : step.completedAt,
  } : step);
  let currentStep = input.task.currentStep;
  let status: LeoTaskStatus = input.task.status;
  if (input.stepStatus === "completed") {
    const next = input.stepIndex + 1;
    if (next >= steps.length) status = "completed";
    else { currentStep = next; steps[next] = { ...steps[next], status: "ready" }; status = "ready"; }
  } else if (input.stepStatus === "waiting_confirmation") status = "waiting_confirmation";
  else if (input.stepStatus === "approved") status = "ready";
  else if (input.stepStatus === "executing") status = "executing";
  else if (input.stepStatus === "failed") status = "blocked";
  else if (input.stepStatus === "canceled") status = "canceled";
  const task = { ...input.task, steps, currentStep, status, updatedAt: new Date().toISOString() };
  return persist(input.identity, input.session, task);
}
