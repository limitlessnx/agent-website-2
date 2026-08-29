import { randomUUID } from "node:crypto";
import type { LeoIdentity } from "@/lib/leo-core";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { resolveLeoWorkspaceTarget } from "@/lib/leo-workspace-portfolio";

export type LeoCalendarEntryType = "routine" | "deadline" | "appointment" | "campaign_window" | "follow_up_window" | "review";
export type LeoCalendarEntryStatus = "active" | "completed" | "cancelled";
export type LeoCalendarRecurrence = "none" | "daily" | "weekly" | "monthly";
export type LeoCalendarPriority = "low" | "medium" | "high" | "critical";
export type LeoOperationalCalendarEntry = {
  id: string;
  title: string;
  description?: string;
  type: LeoCalendarEntryType;
  status: LeoCalendarEntryStatus;
  priority: LeoCalendarPriority;
  workspace?: string;
  organizationId?: string;
  source: "system" | "admin";
  dueAt: string;
  startsAt?: string;
  timeZone: string;
  recurrence: LeoCalendarRecurrence;
  lastCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type StoredRow = { id?: string; content?: string | Record<string, unknown> };
const ROLE = "leo_operational_calendar";
const PREFIX = "leo_calendar:";
const VALID_TYPES = new Set<LeoCalendarEntryType>(["routine","deadline","appointment","campaign_window","follow_up_window","review"]);
const VALID_PRIORITIES = new Set<LeoCalendarPriority>(["low","medium","high","critical"]);
const VALID_RECURRENCES = new Set<LeoCalendarRecurrence>(["none","daily","weekly","monthly"]);

function clean(value: unknown, max = 1000) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function validIso(value: unknown) { const raw = clean(value, 80); const ms = Date.parse(raw); return Number.isFinite(ms) ? new Date(ms).toISOString() : ""; }
function parse(row: StoredRow): LeoOperationalCalendarEntry | null { try { const raw = typeof row.content === "string" ? JSON.parse(row.content) : row.content; return raw && typeof raw === "object" && !Array.isArray(raw) && (raw as LeoOperationalCalendarEntry).id ? raw as LeoOperationalCalendarEntry : null; } catch { return null; } }
function nextOccurrence(iso: string, recurrence: LeoCalendarRecurrence) { const d = new Date(iso); if (recurrence === "daily") d.setUTCDate(d.getUTCDate() + 1); else if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7); else if (recurrence === "monthly") d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString(); }
async function persist(identity: LeoIdentity, entry: LeoOperationalCalendarEntry) {
  if (identity.scope !== "super_admin") throw new Error("Operational calendar is restricted to Super Leo.");
  const userId = `${PREFIX}${entry.id}`;
  const existing = await supabaseServerRequest<Array<{ id: string }>>(`bot_sessions?select=id&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => []);
  const body = JSON.stringify({ role: ROLE, user_id: userId, content: JSON.stringify(entry), created_at: entry.createdAt });
  if (existing[0]?.id) await supabaseServerRequest(`bot_sessions?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
  else await supabaseServerRequest("bot_sessions", { method: "POST", body });
  return entry;
}

export async function listLeoOperationalCalendarEntries(identity: LeoIdentity, input: { workspace?: string; organizationId?: string; includeInactive?: boolean } = {}) {
  if (identity.scope !== "super_admin") return [];
  let resolvedOrganizationId = input.organizationId;
  if (!resolvedOrganizationId && input.workspace) resolvedOrganizationId = (await resolveLeoWorkspaceTarget(identity, input.workspace).catch(() => null))?.organizationId;
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=id,content&role=eq.${ROLE}&order=created_at.asc&limit=500`).catch(() => []);
  return rows.map(parse).filter((entry): entry is LeoOperationalCalendarEntry => Boolean(entry)).filter((entry) => {
    if (!input.includeInactive && entry.status !== "active") return false;
    if (resolvedOrganizationId && entry.organizationId && entry.organizationId !== resolvedOrganizationId) return false;
    if (input.workspace && entry.workspace && !new RegExp(entry.workspace.replace(/_/g, "[ _-]?"), "i").test(input.workspace)) return false;
    return true;
  }).sort((a,b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export async function createLeoOperationalCalendarEntry(identity: LeoIdentity, input: Record<string, unknown>) {
  if (identity.scope !== "super_admin") throw new Error("Operational calendar is restricted to Super Leo.");
  const title = clean(input.title, 180); const description = clean(input.description, 900) || undefined;
  const type = clean(input.type, 40) as LeoCalendarEntryType; const priority = (clean(input.priority, 20) || "medium") as LeoCalendarPriority;
  const recurrence = (clean(input.recurrence, 20) || "none") as LeoCalendarRecurrence; const dueAt = validIso(input.dueAt || input.due_at); const startsAt = validIso(input.startsAt || input.starts_at) || undefined;
  const timeZone = clean(input.timeZone || input.time_zone, 80) || "UTC";
  if (!title || !VALID_TYPES.has(type) || !VALID_PRIORITIES.has(priority) || !VALID_RECURRENCES.has(recurrence) || !dueAt) throw new Error("title, valid type, priority, recurrence and dueAt are required.");
  const workspace = clean(input.workspace, 120) || undefined; let organizationId = clean(input.organizationId || input.organization_id, 120) || undefined;
  if (!organizationId && workspace) organizationId = (await resolveLeoWorkspaceTarget(identity, workspace).catch(() => null))?.organizationId;
  const now = new Date().toISOString();
  return persist(identity, { id: randomUUID(), title, description, type, status: "active", priority, workspace, organizationId, source: "admin", dueAt, startsAt, timeZone, recurrence, createdAt: now, updatedAt: now });
}

export async function updateLeoOperationalCalendarEntry(identity: LeoIdentity, id: string, patch: Record<string, unknown>) {
  const entries = await listLeoOperationalCalendarEntries(identity, { includeInactive: true }); const current = entries.find(item => item.id === id); if (!current) throw new Error("Calendar entry was not found.");
  const next: LeoOperationalCalendarEntry = { ...current, updatedAt: new Date().toISOString() };
  if (patch.title !== undefined) next.title = clean(patch.title, 180) || current.title;
  if (patch.description !== undefined) next.description = clean(patch.description, 900) || undefined;
  if (patch.priority !== undefined) { const value = clean(patch.priority, 20) as LeoCalendarPriority; if (!VALID_PRIORITIES.has(value)) throw new Error("Invalid priority."); next.priority = value; }
  if (patch.recurrence !== undefined) { const value = clean(patch.recurrence, 20) as LeoCalendarRecurrence; if (!VALID_RECURRENCES.has(value)) throw new Error("Invalid recurrence."); next.recurrence = value; }
  if (patch.dueAt !== undefined || patch.due_at !== undefined) { const due = validIso(patch.dueAt || patch.due_at); if (!due) throw new Error("Invalid dueAt."); next.dueAt = due; }
  if (patch.startsAt !== undefined || patch.starts_at !== undefined) next.startsAt = validIso(patch.startsAt || patch.starts_at) || undefined;
  return persist(identity, next);
}

export async function completeLeoOperationalCalendarEntry(identity: LeoIdentity, id: string) {
  const entries = await listLeoOperationalCalendarEntries(identity, { includeInactive: true }); const current = entries.find(item => item.id === id); if (!current) throw new Error("Calendar entry was not found.");
  const now = new Date().toISOString();
  if (current.recurrence !== "none") return persist(identity, { ...current, dueAt: nextOccurrence(current.dueAt, current.recurrence), lastCompletedAt: now, updatedAt: now, status: "active" });
  return persist(identity, { ...current, lastCompletedAt: now, updatedAt: now, status: "completed" });
}

export async function setLeoOperationalCalendarEntryStatus(identity: LeoIdentity, id: string, status: "active" | "cancelled") {
  const entries = await listLeoOperationalCalendarEntries(identity, { includeInactive: true }); const current = entries.find(item => item.id === id); if (!current) throw new Error("Calendar entry was not found.");
  return persist(identity, { ...current, status, updatedAt: new Date().toISOString() });
}

export async function buildLeoOperationalCalendarSnapshot(input: { identity: LeoIdentity; workspace?: string; organizationId?: string; now?: Date }) {
  if (input.identity.scope !== "super_admin") throw new Error("Operational calendar is restricted to Super Leo.");
  const now = input.now || new Date(); const nowMs = now.getTime(); const day = 24 * 60 * 60 * 1000;
  const entries = await listLeoOperationalCalendarEntries(input.identity, { workspace: input.workspace, organizationId: input.organizationId });
  const classify = (entry: LeoOperationalCalendarEntry) => { const due = Date.parse(entry.dueAt); if (due < nowMs) return "overdue" as const; if (due <= nowMs + day) return "due_soon" as const; if (due <= nowMs + 7 * day) return "next_7_days" as const; return "later" as const; };
  const items = entries.map(entry => ({ ...entry, timing: classify(entry) }));
  return { generatedAt: now.toISOString(), scope: { workspace: input.workspace || null, organizationId: input.organizationId || null }, summary: { total: items.length, overdue: items.filter(i => i.timing === "overdue").length, dueSoon: items.filter(i => i.timing === "due_soon").length, next7Days: items.filter(i => i.timing === "next_7_days").length, later: items.filter(i => i.timing === "later").length }, entries: items.slice(0, 100), rules: { authority: "Calendar timing informs prioritization only and does not itself execute business actions.", recurrence: "Completing a recurring item advances its next occurrence; one-time items become completed.", scope: "Workspace-scoped entries must remain pinned to their organization ID.", evidence: "A due date is scheduling metadata, not proof that the underlying business action happened." } };
}
