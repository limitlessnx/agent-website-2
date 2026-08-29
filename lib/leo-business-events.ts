import { createHash, randomUUID } from "node:crypto";
import type { LeoIdentity } from "@/lib/leo-core";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { resolveLeoWorkspaceTarget } from "@/lib/leo-workspace-portfolio";

export const LEO_BUSINESS_EVENT_TYPES = [
  "lead.created",
  "lead.qualified",
  "lead.followup_due",
  "campaign.started",
  "campaign.delivered",
  "campaign.failed",
  "workflow.started",
  "workflow.succeeded",
  "workflow.failed",
  "integration.connected",
  "integration.disconnected",
  "client.onboarding_started",
  "client.onboarding_stalled",
  "appointment.booked",
  "appointment.completed",
  "payment.received",
  "calendar.due",
  "calendar.overdue",
] as const;

export type LeoBusinessEventType = (typeof LEO_BUSINESS_EVENT_TYPES)[number];
export type LeoBusinessEventSeverity = "info" | "low" | "medium" | "high" | "critical";
export type LeoBusinessEvent = {
  id: string;
  type: LeoBusinessEventType;
  organizationId: string;
  workspace?: string;
  severity: LeoBusinessEventSeverity;
  source: string;
  subjectType?: string;
  subjectId?: string;
  idempotencyKey: string;
  occurredAt: string;
  recordedAt: string;
  data: Record<string, unknown>;
  evidence?: Record<string, unknown>;
};

type StoredRow = { id?: string; user_id?: string; content?: string | Record<string, unknown>; created_at?: string };
const ROLE = "leo_business_event";
const PREFIX = "leo_business_event:";
const SECRET_FIELD = /(password|passwd|secret|token|api[_-]?key|authorization|cookie|credential|private[_-]?key)/i;

function clean(value: unknown, max = 300) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function sanitizeObject(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeObject(item, depth + 1));
  if (!value || typeof value !== "object") return typeof value === "string" ? value.slice(0, 2000) : value;
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    if (SECRET_FIELD.test(key)) { result[key] = "[redacted]"; continue; }
    result[key] = sanitizeObject(raw, depth + 1);
  }
  return result;
}
function parse(row: StoredRow): LeoBusinessEvent | null {
  try {
    const value = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
    return value && typeof value === "object" && !Array.isArray(value) && (value as LeoBusinessEvent).id ? value as LeoBusinessEvent : null;
  } catch { return null; }
}
function validType(value: string): value is LeoBusinessEventType { return (LEO_BUSINESS_EVENT_TYPES as readonly string[]).includes(value); }
function stableKey(input: { type: string; organizationId: string; subjectId?: string; occurredAt?: string; key?: string }) {
  if (input.key) return clean(input.key, 180);
  return createHash("sha256").update(`${input.type}|${input.organizationId}|${input.subjectId || ""}|${input.occurredAt || ""}`).digest("hex").slice(0, 40);
}

export async function emitLeoBusinessEvent(identity: LeoIdentity, input: Record<string, unknown>): Promise<{ event: LeoBusinessEvent; duplicate: boolean }> {
  if (identity.scope !== "super_admin") throw new Error("Business event emission is restricted to Super Leo.");
  const type = clean(input.type, 100);
  if (!validType(type)) throw new Error(`Unsupported business event type: ${type || "missing"}.`);
  const targetRaw = clean(input.organizationId || input.organization_id || input.workspace, 180);
  if (!targetRaw) throw new Error("An exact organizationId or resolvable workspace is required.");
  const target = await resolveLeoWorkspaceTarget(identity, targetRaw);
  if (!target?.organizationId) throw new Error("Business event workspace could not be resolved to an exact organization ID.");
  const occurredAt = clean(input.occurredAt || input.occurred_at, 80) || new Date().toISOString();
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error("occurredAt must be a valid timestamp.");
  const subjectId = clean(input.subjectId || input.subject_id, 180) || undefined;
  const key = stableKey({ type, organizationId: target.organizationId, subjectId, occurredAt, key: clean(input.idempotencyKey || input.idempotency_key, 180) || undefined });
  const semanticId = `${PREFIX}${target.organizationId}:${key}`;
  const existing = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=id,content,created_at&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(semanticId)}&limit=1`).catch(() => []);
  const prior = existing[0] ? parse(existing[0]) : null;
  if (prior) return { event: prior, duplicate: true };
  const severityRaw = clean(input.severity, 20) as LeoBusinessEventSeverity;
  const severity: LeoBusinessEventSeverity = ["info","low","medium","high","critical"].includes(severityRaw) ? severityRaw : "info";
  const now = new Date().toISOString();
  const event: LeoBusinessEvent = {
    id: randomUUID(), type, organizationId: target.organizationId, workspace: target.name, severity,
    source: clean(input.source, 180) || "fluxknight", subjectType: clean(input.subjectType || input.subject_type, 100) || undefined,
    subjectId, idempotencyKey: key, occurredAt, recordedAt: now,
    data: (sanitizeObject(input.data || {}) as Record<string, unknown>) || {},
    evidence: input.evidence ? (sanitizeObject(input.evidence) as Record<string, unknown>) : undefined,
  };
  await supabaseServerRequest("bot_sessions", { method: "POST", body: JSON.stringify({ role: ROLE, user_id: semanticId, content: JSON.stringify(event), created_at: now }) });
  return { event, duplicate: false };
}

export async function listLeoBusinessEvents(identity: LeoIdentity, input: { workspace?: string; organizationId?: string; type?: string; since?: string; limit?: number } = {}) {
  if (identity.scope !== "super_admin") return [] as LeoBusinessEvent[];
  let organizationId: string | undefined;
  if (input.organizationId || input.workspace) {
    const target = await resolveLeoWorkspaceTarget(identity, input.organizationId || input.workspace || "").catch(() => null);
    if (!target?.organizationId) throw new Error("Event query workspace could not be resolved to an exact organization ID.");
    organizationId = target.organizationId;
  }
  const limit = Math.max(1, Math.min(Number(input.limit || 100), 500));
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=id,user_id,content,created_at&role=eq.${ROLE}&order=created_at.desc&limit=${limit}`).catch(() => []);
  const sinceMs = input.since ? Date.parse(input.since) : Number.NaN;
  return rows.map(parse).filter((item): item is LeoBusinessEvent => Boolean(item))
    .filter((item) => !organizationId || item.organizationId === organizationId)
    .filter((item) => !input.type || item.type === input.type)
    .filter((item) => !Number.isFinite(sinceMs) || Date.parse(item.occurredAt) >= sinceMs);
}

export async function buildLeoBusinessEventSnapshot(identity: LeoIdentity, input: { workspace?: string; organizationId?: string; hours?: number } = {}) {
  const hours = Math.max(1, Math.min(Number(input.hours || 24), 24 * 30));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const events = await listLeoBusinessEvents(identity, { ...input, since, limit: 500 });
  const counts = events.reduce<Record<string, number>>((acc, item) => { acc[item.type] = (acc[item.type] || 0) + 1; return acc; }, {});
  return {
    generatedAt: new Date().toISOString(), windowHours: hours, total: events.length,
    severity: { critical: events.filter(e => e.severity === "critical").length, high: events.filter(e => e.severity === "high").length, medium: events.filter(e => e.severity === "medium").length, low: events.filter(e => e.severity === "low").length, info: events.filter(e => e.severity === "info").length },
    counts, recent: events.slice(0, 50),
    rules: {
      vocabulary: "Business events use a canonical type vocabulary so agents, monitoring and routines can consume the same event semantics.",
      sourceOfTruth: "An event records that a source reported an occurrence. It does not replace the underlying authoritative entity or prove a consequential action succeeded without supporting evidence.",
      idempotency: "Duplicate event submissions with the same workspace and idempotency key resolve to the original event.",
      isolation: "Every event is pinned to one exact organization ID. Cross-workspace consumers may aggregate sanitized counts but must not blend tenant payloads.",
      execution: "Event emission never grants permission or executes a consequential action. Consumers must still obey canonical Leo approval and verification rules."
    }
  };
}
