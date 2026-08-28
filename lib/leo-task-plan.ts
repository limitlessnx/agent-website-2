import { randomUUID } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { resolveLeoTool, type LeoIdentity } from "@/lib/leo-core";
import type { LeoSessionState } from "@/lib/leo-session-store";

export type LeoTaskStepStatus = "pending" | "ready" | "waiting_confirmation" | "executing" | "completed" | "failed" | "canceled";
export type LeoTaskStatus = "planning" | "ready" | "waiting_confirmation" | "executing" | "blocked" | "completed" | "canceled";
export type LeoTaskStep = {
  id: string;
  index: number;
  title: string;
  toolKey: string;
  arguments: Record<string, unknown>;
  approval: "none" | "confirm" | "admin";
  readOnly: boolean;
  status: LeoTaskStepStatus;
  result?: Record<string, unknown>;
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
    return { id: randomUUID(), index, title: String(candidate.title || tool.title), toolKey: tool.key, arguments: candidate.arguments || {}, approval: tool.approval, readOnly: tool.readOnly, status: index === 0 ? "ready" : "pending" };
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

export async function updateLeoOperationalTask(input: { identity: LeoIdentity; session: LeoSessionState; task: LeoOperationalTask; stepIndex: number; stepStatus: LeoTaskStepStatus; result?: Record<string, unknown>; error?: string }) {
  const steps = input.task.steps.map((step, index) => index === input.stepIndex ? { ...step, status: input.stepStatus, result: input.result ?? step.result, error: input.error, startedAt: input.stepStatus === "executing" ? step.startedAt || new Date().toISOString() : step.startedAt, completedAt: input.stepStatus === "completed" || input.stepStatus === "failed" ? new Date().toISOString() : step.completedAt } : step);
  let currentStep = input.task.currentStep;
  let status: LeoTaskStatus = input.task.status;
  if (input.stepStatus === "completed") {
    const next = input.stepIndex + 1;
    if (next >= steps.length) status = "completed";
    else { currentStep = next; steps[next] = { ...steps[next], status: "ready" }; status = "ready"; }
  } else if (input.stepStatus === "waiting_confirmation") status = "waiting_confirmation";
  else if (input.stepStatus === "executing") status = "executing";
  else if (input.stepStatus === "failed") status = "blocked";
  else if (input.stepStatus === "canceled") status = "canceled";
  const task = { ...input.task, steps, currentStep, status, updatedAt: new Date().toISOString() };
  return persist(input.identity, input.session, task);
}
