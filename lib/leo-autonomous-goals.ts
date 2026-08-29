import { randomUUID } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoIdentity } from "@/lib/leo-core";
import type { LeoProactiveSignal, LeoSignalCategory, LeoSignalSeverity } from "@/lib/leo-proactive-monitor";
import { matchLeoOperationalPlaybooks } from "@/lib/leo-operational-playbooks";

export type LeoGoalStatus = "active" | "paused" | "retired";
export type LeoGoalState = "healthy" | "attention" | "critical";
export type LeoAutonomousGoal = {
  id: string;
  key: string;
  title: string;
  objective: string;
  workspace?: string;
  organizationId?: string;
  status: LeoGoalStatus;
  signalCategories: LeoSignalCategory[];
  minimumSeverity: LeoSignalSeverity;
  autonomy: "observe_recommend";
  source: "system" | "admin";
  createdAt: string;
  updatedAt: string;
  lastEvaluation?: LeoGoalEvaluation;
};
export type LeoGoalEvaluation = {
  evaluatedAt: string;
  state: LeoGoalState;
  matchingSignalIds: string[];
  matchingSignals: number;
  highestSeverity?: LeoSignalSeverity;
  playbookKeys: string[];
  recommendedObjective?: string;
};

type StoredRow = { content?: string | Record<string, unknown>; user_id?: string; created_at?: string };
const ROLE = "leo_autonomous_goal";
const PREFIX = "leo_goal:";
const rank: Record<LeoSignalSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };
const now = "2026-08-29T00:00:00.000Z";

const SYSTEM_GOALS: LeoAutonomousGoal[] = [
  { id: "system-qualified-leads", key: "qualified-leads-attended", title: "Keep qualified leads attended", objective: "Keep qualified and high-intent Limitless Realty leads from going stale while preserving approval for outbound sends.", workspace: "limitless_realty", status: "active", signalCategories: ["lead"], minimumSeverity: "medium", autonomy: "observe_recommend", source: "system", createdAt: now, updatedAt: now },
  { id: "system-campaign-health", key: "campaign-delivery-health", title: "Maintain campaign delivery health", objective: "Detect and investigate failed or unresolved campaign delivery without blind resends.", workspace: "limitless_realty", status: "active", signalCategories: ["campaign"], minimumSeverity: "medium", autonomy: "observe_recommend", source: "system", createdAt: now, updatedAt: now },
  { id: "system-workflow-health", key: "workflow-health", title: "Keep workflows operational", objective: "Detect workflow failures and route the smallest safe recovery through existing approval boundaries.", status: "active", signalCategories: ["workflow"], minimumSeverity: "high", autonomy: "observe_recommend", source: "system", createdAt: now, updatedAt: now },
  { id: "system-integration-health", key: "integration-health", title: "Keep integrations healthy", objective: "Detect disconnected, expired or stale integrations before dependent operations degrade.", status: "active", signalCategories: ["integration"], minimumSeverity: "high", autonomy: "observe_recommend", source: "system", createdAt: now, updatedAt: now },
  { id: "system-onboarding-flow", key: "onboarding-flow", title: "Keep onboarding moving", objective: "Detect stalled client onboarding and identify the first unresolved blocker without bypassing admin or tenant boundaries.", status: "active", signalCategories: ["workspace"], minimumSeverity: "low", autonomy: "observe_recommend", source: "system", createdAt: now, updatedAt: now },
];

function text(value: unknown, max = 1200) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function parse(row: StoredRow): LeoAutonomousGoal | null { try { const v = typeof row.content === "string" ? JSON.parse(row.content) : row.content; return v && typeof v === "object" && !Array.isArray(v) && (v as LeoAutonomousGoal).id ? v as LeoAutonomousGoal : null; } catch { return null; } }
function keyFor(id: string) { return `${PREFIX}${id}`; }
async function persist(identity: LeoIdentity, goal: LeoAutonomousGoal) {
  if (identity.scope !== "super_admin") throw new Error("Autonomous goals are restricted to Super Leo.");
  const userId = keyFor(goal.id);
  const existing = await supabaseServerRequest<Array<{ id: string }>>(`bot_sessions?select=id&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => []);
  const body = JSON.stringify({ role: ROLE, user_id: userId, content: JSON.stringify(goal), created_at: goal.createdAt });
  if (existing[0]?.id) await supabaseServerRequest(`bot_sessions?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
  else await supabaseServerRequest("bot_sessions", { method: "POST", body });
  return goal;
}
export async function listLeoAutonomousGoals(identity: LeoIdentity, includeInactive = false) {
  if (identity.scope !== "super_admin") return [];
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=content,user_id,created_at&role=eq.${ROLE}&order=created_at.desc&limit=250`).catch(() => []);
  const custom = rows.map(parse).filter((item): item is LeoAutonomousGoal => Boolean(item));
  const overrides = new Map(custom.map((item) => [item.key, item]));
  const all = [...custom, ...SYSTEM_GOALS.filter((item) => !overrides.has(item.key))];
  return all.filter((item) => includeInactive || item.status === "active").sort((a, b) => a.title.localeCompare(b.title));
}
export async function createLeoAutonomousGoal(identity: LeoIdentity, input: Record<string, unknown>) {
  const title = text(input.title, 180); const objective = text(input.objective, 1200);
  if (!title || !objective) throw new Error("Goal title and objective are required.");
  const categories = (Array.isArray(input.signalCategories || input.signal_categories) ? (input.signalCategories || input.signal_categories) as unknown[] : []).map(String).filter((value): value is LeoSignalCategory => ["workflow","campaign","lead","workspace","integration"].includes(value));
  if (!categories.length) throw new Error("At least one supported signal category is required.");
  const severity = String(input.minimumSeverity || input.minimum_severity || "medium") as LeoSignalSeverity;
  if (!rank[severity]) throw new Error("minimumSeverity must be low, medium, high or critical.");
  const createdAt = new Date().toISOString();
  return persist(identity, { id: randomUUID(), key: text(input.key, 120).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"") || randomUUID(), title, objective, workspace: text(input.workspace,100)||undefined, organizationId: text(input.organizationId || input.organization_id,100)||undefined, status: "active", signalCategories: [...new Set(categories)], minimumSeverity: severity, autonomy: "observe_recommend", source: "admin", createdAt, updatedAt: createdAt });
}
export async function setLeoAutonomousGoalStatus(identity: LeoIdentity, id: string, status: LeoGoalStatus) {
  const goals = await listLeoAutonomousGoals(identity, true); const goal = goals.find((item) => item.id === id || item.key === id);
  if (!goal) throw new Error("Autonomous goal was not found.");
  return persist(identity, { ...goal, status, source: goal.source === "system" ? "admin" : goal.source, updatedAt: new Date().toISOString() });
}
function signalMatches(goal: LeoAutonomousGoal, signal: LeoProactiveSignal) {
  if (!goal.signalCategories.includes(signal.category) || rank[signal.severity] < rank[goal.minimumSeverity]) return false;
  if (goal.workspace && signal.workspace && goal.workspace !== signal.workspace) return false;
  if (goal.organizationId && signal.workspace && goal.organizationId !== signal.workspace) return false;
  return true;
}
export async function evaluateLeoAutonomousGoals(identity: LeoIdentity, signals: LeoProactiveSignal[]) {
  if (identity.scope !== "super_admin") throw new Error("Autonomous goal evaluation is restricted to Super Leo.");
  const goals = await listLeoAutonomousGoals(identity);
  const results: LeoAutonomousGoal[] = [];
  for (const goal of goals) {
    const matching = signals.filter((signal) => signalMatches(goal, signal));
    const highest = matching.sort((a,b) => rank[b.severity]-rank[a.severity])[0]?.severity;
    const playbooks = matching.length ? await matchLeoOperationalPlaybooks(identity, { query: `${goal.objective} ${matching.map((item) => `${item.title} ${item.summary}`).join(" ")}`, workspace: goal.workspace, limit: 4 }).catch(() => []) : [];
    const state: LeoGoalState = highest === "critical" ? "critical" : matching.length ? "attention" : "healthy";
    const evaluation: LeoGoalEvaluation = { evaluatedAt: new Date().toISOString(), state, matchingSignalIds: matching.map((item) => item.id), matchingSignals: matching.length, highestSeverity: highest, playbookKeys: playbooks.map((item) => item.key), recommendedObjective: matching.length ? `${goal.objective} Investigate ${matching.length} current matching operational signal${matching.length === 1 ? "" : "s"} and follow the safest active playbook. Do not execute consequential actions without existing approval.` : undefined };
    const next = { ...goal, lastEvaluation: evaluation, updatedAt: new Date().toISOString() };
    results.push(await persist(identity, next));
  }
  return results;
}
export function summarizeLeoGoalHealth(goals: LeoAutonomousGoal[]) {
  return { total: goals.length, healthy: goals.filter((g) => g.lastEvaluation?.state === "healthy").length, attention: goals.filter((g) => g.lastEvaluation?.state === "attention").length, critical: goals.filter((g) => g.lastEvaluation?.state === "critical").length, pendingEvaluation: goals.filter((g) => !g.lastEvaluation).length };
}
