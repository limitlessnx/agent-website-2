import { randomUUID } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoIdentity } from "@/lib/leo-core";
import type { LeoSessionState } from "@/lib/leo-session-store";
import { createLeoMultiAgentOrchestration } from "@/lib/leo-multi-agent-orchestrator";
import { listLeoWorkspacePortfolio, resolveLeoWorkspaceTarget, type LeoWorkspaceTarget } from "@/lib/leo-workspace-portfolio";

export type LeoCrossWorkspaceSegmentStatus = "planned" | "active" | "completed" | "blocked" | "canceled";
export type LeoCrossWorkspaceSegment = {
  id: string;
  workspace: LeoWorkspaceTarget;
  objective: string;
  status: LeoCrossWorkspaceSegmentStatus;
  orchestrationId?: string;
  taskId?: string;
};
export type LeoCrossWorkspaceOperation = {
  id: string;
  sessionId: string;
  objective: string;
  status: "planned" | "active" | "completed" | "blocked" | "canceled";
  segments: LeoCrossWorkspaceSegment[];
  createdAt: string;
  updatedAt: string;
};

type StoredRow = { content?: string | Record<string, unknown>; user_id?: string };
const ROLE = "leo_cross_workspace_operation";
const PREFIX = "leo_cross_workspace:";

function text(value: unknown, max = 1600) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function key(sessionId: string, id: string) { return `${PREFIX}${sessionId}:${id}`; }
function parse(row: StoredRow | undefined): LeoCrossWorkspaceOperation | null {
  if (!row?.content) return null;
  try { const value = typeof row.content === "string" ? JSON.parse(row.content) : row.content; return value && typeof value === "object" && !Array.isArray(value) && (value as LeoCrossWorkspaceOperation).id ? value as LeoCrossWorkspaceOperation : null; } catch { return null; }
}
async function persist(identity: LeoIdentity, operation: LeoCrossWorkspaceOperation) {
  if (identity.scope !== "super_admin") throw new Error("Cross-workspace operations are restricted to Super Leo.");
  const userId = key(operation.sessionId, operation.id);
  const rows = await supabaseServerRequest<Array<{ id: string }>>(`bot_sessions?select=id&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => []);
  const body = JSON.stringify({ role: ROLE, user_id: userId, content: JSON.stringify(operation), created_at: operation.createdAt });
  if (rows[0]?.id) await supabaseServerRequest(`bot_sessions?id=eq.${encodeURIComponent(rows[0].id)}`, { method: "PATCH", body });
  else await supabaseServerRequest("bot_sessions", { method: "POST", body });
  return operation;
}

export async function createLeoCrossWorkspaceOperation(input: { identity: LeoIdentity; session: LeoSessionState; objective: string; workspaceReferences?: string[]; relation?: "owned" | "client" | "all" }) {
  if (input.identity.scope !== "super_admin") throw new Error("Cross-workspace operations are restricted to Super Leo.");
  const objective = text(input.objective);
  if (!objective) throw new Error("A cross-workspace objective is required.");
  const portfolio = await listLeoWorkspacePortfolio(input.identity);
  let targets: LeoWorkspaceTarget[] = [];
  if (input.workspaceReferences?.length) {
    targets = await Promise.all(input.workspaceReferences.slice(0, 20).map((reference) => resolveLeoWorkspaceTarget(input.identity, reference)));
  } else {
    const relation = input.relation || "owned";
    targets = portfolio.filter((workspace) => relation === "all" || workspace.relation === relation);
  }
  targets = [...new Map(targets.map((item) => [item.organizationId, item])).values()].filter((item) => item.status.toLowerCase() !== "deleted");
  if (!targets.length) throw new Error("No matching workspaces were found for this cross-workspace objective.");
  const now = new Date().toISOString();
  return persist(input.identity, {
    id: randomUUID(), sessionId: input.session.id, objective, status: "planned",
    segments: targets.map((workspace) => ({ id: randomUUID(), workspace, objective: `${objective} Operate only inside ${workspace.name} (${workspace.organizationId}). Do not use evidence, leads, campaigns, workflows, agents, or permissions from another workspace.`, status: "planned" })),
    createdAt: now, updatedAt: now,
  });
}

export async function loadLeoCrossWorkspaceOperation(identity: LeoIdentity, sessionId: string, operationId?: string) {
  if (identity.scope !== "super_admin") return null;
  const suffix = operationId ? `&user_id=eq.${encodeURIComponent(key(sessionId, operationId))}` : "";
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=user_id,content&role=eq.${ROLE}${suffix}&order=created_at.desc&limit=20`).catch(() => []);
  if (operationId) return parse(rows[0]);
  return rows.map(parse).find((item): item is LeoCrossWorkspaceOperation => Boolean(item) && ["planned","active","blocked"].includes(item.status)) || null;
}

export async function activateLeoCrossWorkspaceSegment(input: { identity: LeoIdentity; session: LeoSessionState; operation: LeoCrossWorkspaceOperation; segmentId: string; context?: Record<string, unknown> }) {
  if (input.identity.scope !== "super_admin") throw new Error("Cross-workspace operations are restricted to Super Leo.");
  const segment = input.operation.segments.find((item) => item.id === input.segmentId);
  if (!segment) throw new Error("Cross-workspace segment was not found.");
  if (segment.status === "completed" || segment.status === "canceled") throw new Error("This workspace segment is no longer active.");
  const anotherActive = input.operation.segments.find((item) => item.status === "active" && item.id !== segment.id);
  if (anotherActive) throw new Error(`Finish or cancel the active ${anotherActive.workspace.name} segment before activating another workspace. This prevents cross-workspace state bleed.`);
  const orchestration = await createLeoMultiAgentOrchestration({ identity: input.identity, session: input.session, objective: segment.objective, workspace: segment.workspace.slug || segment.workspace.name, organizationId: segment.workspace.organizationId, context: { ...(input.context || {}), organization_id: segment.workspace.organizationId } });
  const segments = input.operation.segments.map((item) => item.id === segment.id ? { ...item, status: "active" as const, orchestrationId: orchestration.id, taskId: orchestration.taskId } : item);
  return persist(input.identity, { ...input.operation, status: "active", segments, updatedAt: new Date().toISOString() });
}

export async function completeLeoCrossWorkspaceSegment(input: { identity: LeoIdentity; operation: LeoCrossWorkspaceOperation; segmentId: string; status: "completed" | "blocked" | "canceled" }) {
  const segments = input.operation.segments.map((item) => item.id === input.segmentId ? { ...item, status: input.status } : item);
  const completed = segments.every((item) => ["completed","canceled"].includes(item.status));
  const blocked = segments.some((item) => item.status === "blocked");
  return persist(input.identity, { ...input.operation, segments, status: completed ? "completed" : blocked ? "blocked" : "active", updatedAt: new Date().toISOString() });
}

export function auditLeoCrossWorkspaceOperation(operation: LeoCrossWorkspaceOperation) {
  const ids = operation.segments.map((item) => item.workspace.organizationId);
  const duplicateOrganizations = ids.length - new Set(ids).size;
  const activeSegments = operation.segments.filter((item) => item.status === "active").length;
  const missingOrganizationScope = operation.segments.filter((item) => !item.workspace.organizationId).length;
  return { version: "7D", ok: duplicateOrganizations === 0 && activeSegments <= 1 && missingOrganizationScope === 0, duplicateOrganizations, activeSegments, missingOrganizationScope, segmentCount: operation.segments.length, rule: "Only one workspace segment may be active at a time; every child orchestration must carry the exact organization ID." };
}
