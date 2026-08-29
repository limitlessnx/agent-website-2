import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { createLeoOperationalTask, loadLeoOperationalTask, type LeoOperationalTask } from "@/lib/leo-task-plan";
import type { LeoIdentity } from "@/lib/leo-core";
import type { LeoSessionState } from "@/lib/leo-session-store";

export type LeoSpecialistKey = "maia" | "crm" | "campaign" | "workflow" | "analytics" | "support" | "platform";
export type LeoDelegationStatus = "planned" | "ready" | "waiting_approval" | "executing" | "verifying" | "completed" | "blocked" | "canceled";
export type LeoSpecialist = {
  key: LeoSpecialistKey;
  label: string;
  organizationId?: string;
  agentId?: string;
  agentName?: string;
  agentStatus?: string;
  authority: "specialized_agent" | "authoritative_tool";
};
export type LeoDelegation = {
  id: string;
  specialist: LeoSpecialist;
  title: string;
  toolKey: string;
  arguments: Record<string, unknown>;
  status: LeoDelegationStatus;
  taskStepIndex: number;
};
export type LeoMultiAgentOrchestration = {
  id: string;
  sessionId: string;
  objective: string;
  workspace?: string;
  organizationId?: string;
  status: "planned" | "active" | "waiting_approval" | "blocked" | "completed" | "canceled";
  taskId: string;
  delegations: LeoDelegation[];
  createdAt: string;
  updatedAt: string;
};

type AgentRow = { id: string; organization_id: string; name: string; agent_type?: string | null; status?: string | null; configuration?: Record<string, unknown> | null };
type StoredRow = { content?: string | Record<string, unknown>; user_id?: string };
const ROLE = "leo_multi_agent_orchestration";
const PREFIX = "leo_orchestration:";

function asRecord(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return String(value || "").trim(); }
function orchestrationKey(sessionId: string) { return `${PREFIX}${sessionId}`; }
function parseStored(value: StoredRow | undefined): LeoMultiAgentOrchestration | null {
  if (!value?.content) return null;
  try {
    const parsed = typeof value.content === "string" ? JSON.parse(value.content) : value.content;
    if (!parsed?.id || !parsed?.sessionId || !parsed?.taskId || !Array.isArray(parsed?.delegations)) return null;
    return parsed as LeoMultiAgentOrchestration;
  } catch { return null; }
}
async function persist(orchestration: LeoMultiAgentOrchestration, actor: string) {
  const userId = orchestrationKey(orchestration.sessionId);
  const existing = await supabaseServerRequest<Array<{ id: string }>>(`bot_sessions?select=id&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => []);
  const body = JSON.stringify({ role: ROLE, user_id: userId, content: JSON.stringify(orchestration), created_at: orchestration.createdAt });
  if (existing[0]?.id) {
    await supabaseServerRequest(`bot_sessions?id=eq.${existing[0].id}`, { method: "PATCH", body });
  } else {
    await supabaseServerRequest("bot_sessions", { method: "POST", body });
  }
  return orchestration;
}

export async function loadActiveLeoOrchestration(sessionId: string) {
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=user_id,content&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(orchestrationKey(sessionId))}&order=created_at.desc&limit=1`).catch(() => []);
  return parseStored(rows[0]);
}

async function availableAgents(organizationId?: string) {
  if (!organizationId) return [] as AgentRow[];
  const admin = createAdminClient();
  const result = await admin.from("agents").select("id,organization_id,name,agent_type,status,configuration").eq("organization_id", organizationId).limit(100);
  if (result.error) throw result.error;
  return (result.data || []) as AgentRow[];
}

function agentKey(agent: AgentRow) {
  const config = asRecord(agent.configuration);
  return `${text(agent.agent_type)} ${text(config.agent_key)} ${text(agent.name)}`.toLowerCase();
}
function chooseAgent(agents: AgentRow[], specialist: LeoSpecialistKey) {
  const patterns: Record<LeoSpecialistKey, RegExp> = {
    maia: /maia|real_estate/,
    crm: /crm|sales/,
    campaign: /campaign|whatsapp|email_automation/,
    workflow: /workflow|automation|orchestrator/,
    analytics: /analytics|report|intelligence/,
    support: /support/,
    platform: /platform|admin/,
  };
  return agents.find((agent) => patterns[specialist].test(agentKey(agent))) || null;
}
function specialist(key: LeoSpecialistKey, agents: AgentRow[], organizationId?: string): LeoSpecialist {
  const labels: Record<LeoSpecialistKey, string> = { maia: "Maia", crm: "CRM", campaign: "Campaign", workflow: "Workflow", analytics: "Analytics", support: "Support", platform: "Platform" };
  const agent = chooseAgent(agents, key);
  return { key, label: labels[key], organizationId, agentId: agent?.id, agentName: agent?.name, agentStatus: agent?.status || undefined, authority: agent ? "specialized_agent" : "authoritative_tool" };
}

function add(plan: Array<Omit<LeoDelegation, "id" | "status" | "taskStepIndex">>, specialists: Record<LeoSpecialistKey, LeoSpecialist>, key: LeoSpecialistKey, title: string, toolKey: string, args: Record<string, unknown>) {
  plan.push({ specialist: specialists[key], title, toolKey, arguments: args });
}

function buildPlan(input: { objective: string; workspace?: string; organizationId?: string; context?: Record<string, unknown>; specialists: Record<LeoSpecialistKey, LeoSpecialist> }) {
  const objective = input.objective.toLowerCase();
  const context = input.context || {};
  const args = { ...context, ...(input.organizationId ? { organization_id: input.organizationId } : {}) };
  const plan: Array<Omit<LeoDelegation, "id" | "status" | "taskStepIndex">> = [];
  const limitless = /limitless|realty|property|maia/.test(`${objective} ${input.workspace || ""}`.toLowerCase());

  if (/campaign|whatsapp|delivery|broadcast/.test(objective)) {
    if (limitless) add(plan, input.specialists, "campaign", "Inspect Limitless campaign delivery evidence", "leo.limitless.leads.read", { ...context, campaign_diagnosis: true });
    else add(plan, input.specialists, "campaign", "Inspect campaign workspace before action", "leo.tenant.inspect", args);
  }
  if (/lead|follow.?up|prospect|crm/.test(objective)) {
    if (limitless) add(plan, input.specialists, "crm", "Inspect Limitless leads requiring attention", "leo.limitless.leads.read", context);
    else add(plan, input.specialists, "crm", "Inspect CRM leads", "leo.crm.leads.read", args);
  }
  if (/workflow|automation|failure|failed|error|runtime/.test(objective)) {
    add(plan, input.specialists, "workflow", "Inspect workflow failures", "leo.workflow.inspect_failures", args);
  }
  if (/integration|disconnect|connection/.test(objective)) {
    add(plan, input.specialists, "support", "Inspect integration health", "leo.integration.inspect", args);
  }
  if (/agent|maia/.test(objective) && input.specialists.maia.agentId) {
    add(plan, input.specialists, "maia", "Inspect Maia specialist state", "leo.agent.inspect", { ...args, agent_id: input.specialists.maia.agentId });
  }
  if (/organization|tenant|workspace|platform/.test(objective) && input.organizationId) {
    add(plan, input.specialists, "platform", "Inspect workspace state", "leo.tenant.inspect", args);
  }

  const explicitlySend = /\b(send|broadcast|message|follow up)\b/.test(objective);
  if (explicitlySend && limitless && (context.message || context.update || context.content || context.property_id)) {
    if (context.lead_id || context.phone || context.email || context.name) {
      add(plan, input.specialists, "campaign", "Prepare targeted Limitless follow-up", "leo.limitless.followup.prepare", context);
      add(plan, input.specialists, "campaign", "Send approved targeted Limitless follow-up", "leo.limitless.followup.send", context);
    } else if (/campaign|all leads|broadcast/.test(objective)) {
      add(plan, input.specialists, "campaign", "Prepare Limitless campaign", "leo.limitless.campaign.prepare", context);
      add(plan, input.specialists, "campaign", "Send approved Limitless campaign", "leo.limitless.campaign.send", context);
    }
  }

  if (!plan.length) {
    if (input.organizationId) add(plan, input.specialists, "platform", "Inspect workspace before deciding next action", "leo.tenant.inspect", args);
    else add(plan, input.specialists, "platform", "Inspect Fluxknight organizations", "leo.platform.organizations.read", { limit: 50 });
  }
  return plan.slice(0, 12);
}

export async function createLeoMultiAgentOrchestration(input: { identity: LeoIdentity; session: LeoSessionState; objective: string; workspace?: string; organizationId?: string; context?: Record<string, unknown> }) {
  if (input.identity.scope !== "super_admin") throw new Error("Multi-agent orchestration is restricted to Super Leo.");
  const objective = text(input.objective);
  if (!objective) throw new Error("An orchestration objective is required.");
  const agents = await availableAgents(input.organizationId);
  const keys: LeoSpecialistKey[] = ["maia", "crm", "campaign", "workflow", "analytics", "support", "platform"];
  const specialists = Object.fromEntries(keys.map((key) => [key, specialist(key, agents, input.organizationId)])) as Record<LeoSpecialistKey, LeoSpecialist>;
  const plan = buildPlan({ objective, workspace: input.workspace, organizationId: input.organizationId, context: input.context, specialists });
  const task = await createLeoOperationalTask({ identity: input.identity, session: input.session, goal: objective, workspace: input.workspace, steps: plan.map((item) => ({ title: `${item.specialist.label}: ${item.title}`, toolKey: item.toolKey, arguments: item.arguments })) });
  const now = new Date().toISOString();
  const orchestration: LeoMultiAgentOrchestration = {
    id: randomUUID(), sessionId: input.session.id, objective, workspace: input.workspace, organizationId: input.organizationId,
    status: "active", taskId: task.id,
    delegations: plan.map((item, index) => ({ id: randomUUID(), ...item, status: index === 0 ? "ready" : "planned", taskStepIndex: index })),
    createdAt: now, updatedAt: now,
  };
  return persist(orchestration, input.identity.email || input.identity.userId || "super_admin");
}

function delegationStatus(step: LeoOperationalTask["steps"][number] | undefined): LeoDelegationStatus {
  if (!step) return "planned";
  if (step.status === "completed") return "completed";
  if (step.status === "canceled") return "canceled";
  if (step.status === "waiting_confirmation" || step.status === "approved") return "waiting_approval";
  if (step.status === "executing") return "executing";
  if (step.status === "waiting_evidence") return "verifying";
  if (step.status === "failed") return "blocked";
  return "ready";
}

export async function refreshLeoMultiAgentOrchestration(input: { identity: LeoIdentity; session: LeoSessionState; orchestration: LeoMultiAgentOrchestration }) {
  const task = await loadLeoOperationalTask(input.identity, input.session, input.orchestration.taskId);
  if (!task) return { orchestration: input.orchestration, task: null };
  const delegations = input.orchestration.delegations.map((item) => ({ ...item, status: delegationStatus(task.steps[item.taskStepIndex]) }));
  const status: LeoMultiAgentOrchestration["status"] = task.status === "completed" ? "completed" : task.status === "canceled" ? "canceled" : task.status === "waiting_confirmation" ? "waiting_approval" : task.status === "blocked" ? "blocked" : "active";
  const orchestration = { ...input.orchestration, delegations, status, updatedAt: new Date().toISOString() };
  await persist(orchestration, input.identity.email || input.identity.userId || "super_admin");
  return { orchestration, task };
}

export async function cancelLeoMultiAgentOrchestration(input: { identity: LeoIdentity; orchestration: LeoMultiAgentOrchestration }) {
  if (input.identity.scope !== "super_admin") throw new Error("Multi-agent orchestration is restricted to Super Leo.");
  const next: LeoMultiAgentOrchestration = { ...input.orchestration, status: "canceled", delegations: input.orchestration.delegations.map((item) => item.status === "completed" ? item : { ...item, status: "canceled" }), updatedAt: new Date().toISOString() };
  return persist(next, input.identity.email || input.identity.userId || "super_admin");
}

export function auditLeoMultiAgentOrchestration(orchestration: LeoMultiAgentOrchestration, task: LeoOperationalTask | null) {
  const delegated = orchestration.delegations.length;
  const specialistKeys = new Set(orchestration.delegations.map((item) => item.specialist.key));
  const directConsequentialBypass = orchestration.delegations.some((item) => /\.send$|\.pause$|\.resume$|\.activate$|\.deactivate$/.test(item.toolKey) && task?.steps[item.taskStepIndex]?.approval === "none");
  const stepAlignment = Boolean(task) && task!.steps.length === delegated && orchestration.delegations.every((item) => task!.steps[item.taskStepIndex]?.toolKey === item.toolKey);
  return {
    ok: Boolean(task) && delegated > 0 && stepAlignment && !directConsequentialBypass,
    checks: { persistedTask: Boolean(task), delegationCount: delegated, stepAlignment, approvalBoundary: !directConsequentialBypass, specialistCoverage: specialistKeys.size },
    architecture: "Understand objective → choose specialist/tool → delegate → task approval → execute → verify → recover → report",
  };
}
