import { randomUUID } from "node:crypto";
import type { LeoIdentity } from "@/lib/leo-core";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { buildLeoWorkspaceKpis, type LeoBusinessKpi } from "@/lib/leo-business-kpis";

export type LeoBusinessRuleStatus = "draft" | "active" | "retired";
export type LeoRuleOperator = "gt" | "gte" | "lt" | "lte" | "eq";
export type LeoBusinessRule = {
  id: string;
  key: string;
  version: number;
  title: string;
  description: string;
  workspace?: string;
  organizationId?: string;
  status: LeoBusinessRuleStatus;
  source: "system" | "admin";
  condition: { kpiKey: string; operator: LeoRuleOperator; threshold: number };
  outcome: { severity: "low" | "medium" | "high" | "critical"; recommendation: string; blocksRecommendation?: boolean };
  createdAt: string;
  updatedAt: string;
};
export type LeoBusinessRuleEvaluation = {
  ruleId: string;
  ruleKey: string;
  version: number;
  matched: boolean;
  kpiKey: string;
  actual: number | null;
  threshold: number;
  operator: LeoRuleOperator;
  severity?: LeoBusinessRule["outcome"]["severity"];
  recommendation?: string;
  blocksRecommendation?: boolean;
  evidence: string;
};

type StoredRow = { content?: string | Record<string, unknown> };
const ROLE = "leo_business_rule";
const PREFIX = "leo_business_rule:";
const BASE_DATE = "2026-08-29T00:00:00.000Z";

const SYSTEM_RULES: LeoBusinessRule[] = [
  { id: "system-qualified-lead-attention-v1", key: "qualified-lead-attention", version: 1, title: "Qualified leads must not go stale", description: "Flag when too many qualified Limitless Realty leads are outside the follow-up window.", workspace: "limitless_realty", status: "active", source: "system", condition: { kpiKey: "stale_qualified_lead_rate", operator: "gt", threshold: 25 }, outcome: { severity: "high", recommendation: "Review stale qualified leads and prepare the smallest appropriate follow-up batch. Do not send without canonical approval." }, createdAt: BASE_DATE, updatedAt: BASE_DATE },
  { id: "system-campaign-failure-v1", key: "campaign-failure-guard", version: 1, title: "Campaign failure guard", description: "Prevent another campaign recommendation when failure evidence is materially unhealthy.", workspace: "limitless_realty", status: "active", source: "system", condition: { kpiKey: "campaign_failure_rate", operator: "gt", threshold: 15 }, outcome: { severity: "critical", recommendation: "Investigate provider failure evidence before recommending another campaign or resend.", blocksRecommendation: true }, createdAt: BASE_DATE, updatedAt: BASE_DATE },
  { id: "system-workflow-failure-v1", key: "workflow-failure-guard", version: 1, title: "Workflow failure guard", description: "Escalate workflow reliability investigation when the recent failure rate is materially elevated.", status: "active", source: "system", condition: { kpiKey: "workflow_failure_rate_24h", operator: "gt", threshold: 15 }, outcome: { severity: "high", recommendation: "Inspect failed runs and verify whether failures are transient before any retry or configuration change." }, createdAt: BASE_DATE, updatedAt: BASE_DATE },
  { id: "system-integration-health-v1", key: "integration-health-guard", version: 1, title: "Integration health guard", description: "Surface disconnected or invalid integrations before dependent work proceeds.", status: "active", source: "system", condition: { kpiKey: "unhealthy_integrations", operator: "gt", threshold: 0 }, outcome: { severity: "high", recommendation: "Inspect the affected integration and dependent workflows before changing credentials or continuing dependent automation." }, createdAt: BASE_DATE, updatedAt: BASE_DATE },
];

function clean(value: unknown, max = 1200) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function parse(row: StoredRow): LeoBusinessRule | null { try { const value = typeof row.content === "string" ? JSON.parse(row.content) : row.content; return value && typeof value === "object" && !Array.isArray(value) && (value as LeoBusinessRule).id ? value as LeoBusinessRule : null; } catch { return null; } }
function keyFor(rule: LeoBusinessRule) { return `${PREFIX}${rule.key}:v${rule.version}`; }
function compare(actual: number, operator: LeoRuleOperator, threshold: number) { if (operator === "gt") return actual > threshold; if (operator === "gte") return actual >= threshold; if (operator === "lt") return actual < threshold; if (operator === "lte") return actual <= threshold; return actual === threshold; }
async function persist(identity: LeoIdentity, rule: LeoBusinessRule) {
  if (identity.scope !== "super_admin") throw new Error("Business rules are restricted to Super Leo.");
  const userId = keyFor(rule);
  const existing = await supabaseServerRequest<Array<{ id: string }>>(`bot_sessions?select=id&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => []);
  const body = JSON.stringify({ role: ROLE, user_id: userId, content: JSON.stringify(rule), created_at: rule.createdAt });
  if (existing[0]?.id) await supabaseServerRequest(`bot_sessions?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
  else await supabaseServerRequest("bot_sessions", { method: "POST", body });
  return rule;
}
export async function listLeoBusinessRules(identity: LeoIdentity, includeInactive = false) {
  if (identity.scope !== "super_admin") return [];
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=content&role=eq.${ROLE}&order=created_at.desc&limit=250`).catch(() => []);
  const custom = rows.map(parse).filter((item): item is LeoBusinessRule => Boolean(item));
  const customKeys = new Set(custom.filter(item => item.status === "active").map(item => item.key));
  const all = [...custom, ...SYSTEM_RULES.filter(item => !customKeys.has(item.key))];
  return all.filter(item => includeInactive || item.status === "active").sort((a,b) => a.key.localeCompare(b.key) || b.version - a.version);
}
export async function createLeoBusinessRuleDraft(identity: LeoIdentity, input: Record<string, unknown>) {
  const key = clean(input.key, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const title = clean(input.title, 180); const description = clean(input.description, 900);
  const kpiKey = clean(input.kpiKey || input.kpi_key, 120); const operator = clean(input.operator, 8) as LeoRuleOperator; const threshold = Number(input.threshold);
  const recommendation = clean(input.recommendation, 1200); const severity = clean(input.severity, 20) as LeoBusinessRule["outcome"]["severity"];
  if (!key || !title || !description || !kpiKey || !["gt","gte","lt","lte","eq"].includes(operator) || !Number.isFinite(threshold) || !recommendation || !["low","medium","high","critical"].includes(severity)) throw new Error("Rule key, title, description, valid KPI condition, severity and recommendation are required.");
  const existing = await listLeoBusinessRules(identity, true); const version = Math.max(0, ...existing.filter(item => item.key === key).map(item => item.version)) + 1; const now = new Date().toISOString();
  return persist(identity, { id: randomUUID(), key, version, title, description, workspace: clean(input.workspace,100)||undefined, organizationId: clean(input.organizationId || input.organization_id,100)||undefined, status: "draft", source: "admin", condition: { kpiKey, operator, threshold }, outcome: { severity, recommendation, blocksRecommendation: input.blocksRecommendation === true || input.blocks_recommendation === true }, createdAt: now, updatedAt: now });
}
export async function setLeoBusinessRuleStatus(identity: LeoIdentity, id: string, status: LeoBusinessRuleStatus) {
  const rules = await listLeoBusinessRules(identity, true); const current = rules.find(item => item.id === id); if (!current) throw new Error("Business rule was not found.");
  if (status === "active") { for (const prior of rules.filter(item => item.key === current.key && item.id !== current.id && item.status === "active" && item.source === "admin")) await persist(identity, { ...prior, status: "retired", updatedAt: new Date().toISOString() }); }
  return persist(identity, { ...current, status, source: current.source === "system" ? "admin" : current.source, updatedAt: new Date().toISOString() });
}
export async function evaluateLeoBusinessRules(input: { identity: LeoIdentity; workspace?: string; organizationId?: string }) {
  if (input.identity.scope !== "super_admin") throw new Error("Business rule evaluation is restricted to Super Leo.");
  const [rules, kpiSnapshot] = await Promise.all([listLeoBusinessRules(input.identity), buildLeoWorkspaceKpis(input)]);
  const kpis = new Map<string, LeoBusinessKpi>(kpiSnapshot.kpis.map(item => [item.key, item]));
  const evaluations: LeoBusinessRuleEvaluation[] = [];
  for (const rule of rules) {
    if (rule.workspace && input.workspace && !new RegExp(rule.workspace.replace(/_/g,"[ _-]?"), "i").test(input.workspace)) continue;
    if (rule.organizationId && input.organizationId && rule.organizationId !== input.organizationId) continue;
    const kpi = kpis.get(rule.condition.kpiKey); const actual = kpi?.value ?? null; const matched = actual !== null && compare(actual, rule.condition.operator, rule.condition.threshold);
    evaluations.push({ ruleId: rule.id, ruleKey: rule.key, version: rule.version, matched, kpiKey: rule.condition.kpiKey, actual, threshold: rule.condition.threshold, operator: rule.condition.operator, severity: matched ? rule.outcome.severity : undefined, recommendation: matched ? rule.outcome.recommendation : undefined, blocksRecommendation: matched ? rule.outcome.blocksRecommendation : undefined, evidence: kpi ? kpi.evidence : "The referenced KPI is unavailable for this workspace; the rule was not triggered." });
  }
  return { generatedAt: new Date().toISOString(), scope: kpiSnapshot.scope, totalRules: evaluations.length, matchedRules: evaluations.filter(item => item.matched).length, blockedRecommendations: evaluations.filter(item => item.matched && item.blocksRecommendation).length, evaluations, rules: { authority: "Business rules guide prioritization and recommendations only. They cannot grant tools, weaken permissions, self-approve, or prove execution.", versioning: "Only active rule versions participate in evaluation; publishing a custom version retires the prior active custom version for that key.", evidence: "Rules trigger only from current KPI evidence. Missing KPI data does not trigger a rule." } };
}
