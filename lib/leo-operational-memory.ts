import { randomUUID } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoIdentity } from "@/lib/leo-core";
import type { LeoOperationalTask } from "@/lib/leo-task-plan";

export type LeoMemoryKind = "decision" | "outcome" | "lesson" | "policy" | "workspace_fact";
export type LeoMemoryStatus = "active" | "retired";
export type LeoOperationalMemory = {
  id: string;
  kind: LeoMemoryKind;
  status: LeoMemoryStatus;
  title: string;
  summary: string;
  workspace?: string;
  organizationId?: string;
  tags: string[];
  confidence: number;
  source: {
    type: "manual" | "task" | "orchestration" | "monitor";
    sourceId?: string;
    sessionId?: string;
    evidence?: string[];
  };
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
};

type StoredRow = { id?: string; user_id?: string; content?: string | Record<string, unknown>; created_at?: string };
const ROLE = "leo_operational_memory";
const PREFIX = "leo_memory:";
const MAX_SUMMARY = 1400;
const BLOCKED_KEY = /(password|secret|token|api[_ -]?key|authorization|cookie|service[_ -]?role|private[_ -]?key)/i;

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function cleanText(value: unknown, max: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}
function cleanTags(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map((item) => cleanText(item, 60).toLowerCase()).filter(Boolean))].slice(0, 12);
}
function safeEvidence(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return source.map((item) => cleanText(item, 240)).filter((item) => item && !BLOCKED_KEY.test(item)).slice(0, 8);
}
function parseMemory(row: StoredRow): LeoOperationalMemory | null {
  try {
    const value = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
    const item = record(value);
    if (!item.id || !item.title || !item.summary || !item.kind) return null;
    return item as unknown as LeoOperationalMemory;
  } catch { return null; }
}
function actor(identity: LeoIdentity) { return identity.email || identity.userId || "super_admin"; }
function memoryKey(id: string) { return `${PREFIX}${id}`; }
function normalize(input: Partial<LeoOperationalMemory> & { title: string; summary: string; kind: LeoMemoryKind }): LeoOperationalMemory {
  const now = new Date().toISOString();
  const title = cleanText(input.title, 180);
  const summary = cleanText(input.summary, MAX_SUMMARY);
  if (!title || !summary) throw new Error("Operational memory requires a title and summary.");
  if (BLOCKED_KEY.test(title) || BLOCKED_KEY.test(summary)) throw new Error("Operational memory cannot store credentials or secret material.");
  const source = record(input.source);
  return {
    id: cleanText(input.id, 80) || randomUUID(),
    kind: input.kind,
    status: input.status === "retired" ? "retired" : "active",
    title,
    summary,
    workspace: cleanText(input.workspace, 100) || undefined,
    organizationId: cleanText(input.organizationId, 100) || undefined,
    tags: cleanTags(input.tags),
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.8) || 0.8)),
    source: {
      type: (["manual", "task", "orchestration", "monitor"] as string[]).includes(String(source.type)) ? source.type as LeoOperationalMemory["source"]["type"] : "manual",
      sourceId: cleanText(source.sourceId, 120) || undefined,
      sessionId: cleanText(source.sessionId, 120) || undefined,
      evidence: safeEvidence(source.evidence),
    },
    createdAt: cleanText(input.createdAt, 60) || now,
    updatedAt: now,
    lastUsedAt: cleanText(input.lastUsedAt, 60) || undefined,
  };
}
async function persist(identity: LeoIdentity, memory: LeoOperationalMemory) {
  if (identity.scope !== "super_admin") throw new Error("Operational memory is restricted to Super Leo.");
  const userId = memoryKey(memory.id);
  const existing = await supabaseServerRequest<Array<{ id: string }>>(`bot_sessions?select=id&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => []);
  const body = JSON.stringify({ role: ROLE, user_id: userId, content: JSON.stringify(memory), created_at: memory.createdAt });
  if (existing[0]?.id) await supabaseServerRequest(`bot_sessions?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
  else await supabaseServerRequest("bot_sessions", { method: "POST", body });
  return memory;
}

export async function createLeoOperationalMemory(identity: LeoIdentity, input: Partial<LeoOperationalMemory> & { title: string; summary: string; kind: LeoMemoryKind }) {
  return persist(identity, normalize(input));
}

export async function listLeoOperationalMemories(identity: LeoIdentity, input: { limit?: number; workspace?: string; organizationId?: string; includeRetired?: boolean } = {}) {
  if (identity.scope !== "super_admin") return [];
  const limit = Math.max(1, Math.min(Number(input.limit || 80), 250));
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=id,user_id,content,created_at&role=eq.${ROLE}&order=created_at.desc&limit=${limit}`).catch(() => []);
  return rows.map(parseMemory).filter((item): item is LeoOperationalMemory => Boolean(item))
    .filter((item) => input.includeRetired || item.status === "active")
    .filter((item) => !input.workspace || item.workspace === input.workspace)
    .filter((item) => !input.organizationId || item.organizationId === input.organizationId);
}

function terms(value: string) { return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length > 2)); }
function scoreMemory(memory: LeoOperationalMemory, query: string, workspace?: string, organizationId?: string) {
  const q = terms(query);
  const hay = terms(`${memory.title} ${memory.summary} ${memory.tags.join(" ")}`);
  let score = 0;
  for (const term of q) if (hay.has(term)) score += 2;
  if (workspace && memory.workspace === workspace) score += 4;
  if (organizationId && memory.organizationId === organizationId) score += 5;
  if (memory.kind === "policy" || memory.kind === "decision") score += 1;
  score += memory.confidence;
  return score;
}

export async function searchLeoOperationalMemory(identity: LeoIdentity, input: { query: string; workspace?: string; organizationId?: string; limit?: number }) {
  const all = await listLeoOperationalMemories(identity, { limit: 250, includeRetired: false });
  const query = cleanText(input.query, 1000);
  return all.map((memory) => ({ memory, score: scoreMemory(memory, query, input.workspace, input.organizationId) }))
    .filter((item) => item.score > 0.5)
    .sort((a, b) => b.score - a.score || Date.parse(b.memory.updatedAt) - Date.parse(a.memory.updatedAt))
    .slice(0, Math.max(1, Math.min(Number(input.limit || 8), 20)))
    .map((item) => item.memory);
}

export async function retireLeoOperationalMemory(identity: LeoIdentity, id: string) {
  const all = await listLeoOperationalMemories(identity, { limit: 250, includeRetired: true });
  const current = all.find((item) => item.id === id);
  if (!current) throw new Error("Operational memory was not found.");
  return persist(identity, { ...current, status: "retired", updatedAt: new Date().toISOString() });
}

export async function rememberLeoTaskOutcome(input: { identity: LeoIdentity; sessionId: string; task: LeoOperationalTask }) {
  if (input.identity.scope !== "super_admin" || input.task.status !== "completed") return null;
  const evidence = input.task.steps.map((step) => step.evidence?.summary || step.error || "").filter(Boolean).slice(0, 8);
  const completed = input.task.steps.filter((step) => step.status === "completed").length;
  const verified = input.task.steps.filter((step) => step.evidence?.status === "verified").length;
  const summary = `Goal completed: ${cleanText(input.task.goal, 500)}. ${completed}/${input.task.steps.length} steps completed; ${verified} carried verified evidence. ${evidence.length ? `Evidence: ${evidence.join(" | ")}` : "No additional evidence summary was persisted."}`;
  const existing = await searchLeoOperationalMemory(input.identity, { query: input.task.goal, workspace: input.task.workspace, limit: 20 });
  const duplicate = existing.find((item) => item.source.type === "task" && item.source.sourceId === input.task.id);
  if (duplicate) return duplicate;
  return createLeoOperationalMemory(input.identity, {
    kind: "outcome",
    title: `Completed operation: ${cleanText(input.task.goal, 130)}`,
    summary,
    workspace: input.task.workspace,
    tags: input.task.steps.map((step) => step.toolKey.split(".").slice(1, 3).join("_")).filter(Boolean),
    confidence: verified === input.task.steps.length ? 1 : verified > 0 ? 0.9 : 0.75,
    source: { type: "task", sourceId: input.task.id, sessionId: input.sessionId, evidence },
  });
}
