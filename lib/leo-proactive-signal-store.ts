import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoProactiveSignal } from "@/lib/leo-proactive-monitor";

export type LeoSignalLifecycle = "new" | "active" | "acknowledged" | "resolved";
export type LeoPersistedSignal = LeoProactiveSignal & {
  lifecycle: LeoSignalLifecycle;
  firstDetectedAt: string;
  lastDetectedAt: string;
  occurrences: number;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  reopenedAt?: string;
  lastAlertedAt?: string;
  alertCount?: number;
  lastActor?: string;
};

type StoredSignalRow = { id: string; user_id?: string; content?: string | Record<string, unknown>; created_at?: string };

const ROLE = "leo_proactive_signal";
const KEY_PREFIX = "leo_signal:";
function rowKey(signalId: string) { return `${KEY_PREFIX}${signalId}`; }
function parseContent(value: string | Record<string, unknown> | undefined) { try { return typeof value === "string" ? JSON.parse(value) as Record<string, unknown> : value || {}; } catch { return {}; } }
function parseStored(row: StoredSignalRow): LeoPersistedSignal | null { const content = parseContent(row.content); if (!content.id || !content.title || !content.lifecycle) return null; return content as unknown as LeoPersistedSignal; }

async function writeSignal(signal: LeoPersistedSignal, actor = "fluxknight_admin") {
  const key = rowKey(signal.id);
  const stored: LeoPersistedSignal = { ...signal, lastActor: actor };
  const payload = { user_id: key, role: ROLE, content: JSON.stringify(stored), created_at: signal.firstDetectedAt };
  const updated = await supabaseServerRequest<StoredSignalRow[]>(`bot_sessions?user_id=eq.${encodeURIComponent(key)}&role=eq.${ROLE}`, { method: "PATCH", body: JSON.stringify(payload) }).catch(() => []);
  if (updated.length) return stored;
  await supabaseServerRequest("bot_sessions", { method: "POST", body: JSON.stringify(payload) });
  return stored;
}

export async function listPersistedLeoSignals(limit = 200) {
  const rows = await supabaseServerRequest<StoredSignalRow[]>(`bot_sessions?select=id,user_id,content,created_at&role=eq.${ROLE}&order=created_at.desc&limit=${Math.max(1, Math.min(limit, 500))}`).catch(() => []);
  return rows.map(parseStored).filter((item): item is LeoPersistedSignal => Boolean(item));
}
export async function getPersistedLeoSignal(signalId: string) {
  const id = String(signalId || "").trim(); if (!id) return null;
  const rows = await supabaseServerRequest<StoredSignalRow[]>(`bot_sessions?select=id,user_id,content,created_at&user_id=eq.${encodeURIComponent(rowKey(id))}&role=eq.${ROLE}&limit=1`).catch(() => []);
  return rows[0] ? parseStored(rows[0]) : null;
}

export async function reconcileLeoProactiveSignals(snapshot: { generatedAt: string; signals: LeoProactiveSignal[] }, actor = "fluxknight_admin") {
  const existing = await listPersistedLeoSignals(500);
  const byId = new Map(existing.map((item) => [item.id, item]));
  const currentIds = new Set(snapshot.signals.map((item) => item.id));
  const next: LeoPersistedSignal[] = [];
  for (const detected of snapshot.signals) {
    const prior = byId.get(detected.id);
    const lifecycle: LeoSignalLifecycle = !prior ? "new" : prior.lifecycle === "resolved" ? "active" : prior.lifecycle === "new" ? "active" : prior.lifecycle;
    const merged: LeoPersistedSignal = { ...detected, lifecycle, firstDetectedAt: prior?.firstDetectedAt || detected.detectedAt, lastDetectedAt: snapshot.generatedAt, occurrences: Math.max(1, (prior?.occurrences || 0) + 1), acknowledgedAt: lifecycle === "acknowledged" ? prior?.acknowledgedAt : undefined, acknowledgedBy: lifecycle === "acknowledged" ? prior?.acknowledgedBy : undefined, resolvedAt: undefined, reopenedAt: prior?.lifecycle === "resolved" ? snapshot.generatedAt : prior?.reopenedAt, lastAlertedAt: prior?.lastAlertedAt, alertCount: prior?.alertCount || 0 };
    const stored = await writeSignal(merged, actor); next.push(stored);
  }
  for (const prior of existing) {
    if (currentIds.has(prior.id) || prior.lifecycle === "resolved") continue;
    await writeSignal({ ...prior, lifecycle: "resolved", resolvedAt: snapshot.generatedAt, lastDetectedAt: prior.lastDetectedAt || prior.detectedAt }, actor);
  }
  return next;
}

export async function acknowledgeLeoProactiveSignal(signalId: string, actor: string) {
  const current = await getPersistedLeoSignal(signalId); if (!current) throw new Error("Proactive signal was not found.");
  if (current.lifecycle === "resolved") throw new Error("A resolved signal does not need acknowledgment.");
  return writeSignal({ ...current, lifecycle: "acknowledged", acknowledgedAt: new Date().toISOString(), acknowledgedBy: actor }, actor);
}
export async function recordLeoProactiveAlertDelivery(signalId: string, actor: string) {
  const current = await getPersistedLeoSignal(signalId); if (!current) throw new Error("Proactive signal was not found.");
  if (current.lifecycle === "resolved") return current;
  return writeSignal({ ...current, lastAlertedAt: new Date().toISOString(), alertCount: Math.max(0, current.alertCount || 0) + 1 }, actor);
}
