import { randomUUID } from "node:crypto";
import type { LeoIdentity } from "@/lib/leo-core";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { listLeoWorkspacePortfolio, resolveLeoWorkspaceTarget } from "@/lib/leo-workspace-portfolio";

export type LeoBusinessModelStatus = "draft" | "active" | "retired";
export type LeoWorkspaceBusinessModel = {
  id: string;
  key: string;
  version: number;
  organizationId?: string;
  workspacePattern?: string;
  title: string;
  businessType: string;
  description: string;
  status: LeoBusinessModelStatus;
  source: "system" | "admin";
  entities: string[];
  pipelineStages: string[];
  primaryEvents: string[];
  primaryKpis: string[];
  operatingObjects: string[];
  boundaries: string[];
  createdAt: string;
  updatedAt: string;
};

type StoredRow = { content?: string | Record<string, unknown> };
const ROLE = "leo_workspace_business_model";
const PREFIX = "leo_business_model:";
const BASE_DATE = "2026-08-29T00:00:00.000Z";

const SYSTEM_MODELS: LeoWorkspaceBusinessModel[] = [
  {
    id: "system-limitless-realty-v1", key: "limitless-realty", version: 1, workspacePattern: "limitless|realty|maia", title: "Limitless Realty", businessType: "real_estate_sales", description: "Property sales and land-banking operations centered on verified properties, buyer education, lead qualification, inspections, follow-up and closing.", status: "active", source: "system",
    entities: ["lead","property","inspection","buyer","campaign","follow_up"],
    pipelineStages: ["new","engaged","qualified","inspection","negotiation","payment","closed"],
    primaryEvents: ["lead.created","lead.qualified","lead.followup_due","appointment.booked","campaign.delivered","campaign.failed","payment.received"],
    primaryKpis: ["stale_qualified_lead_rate","campaign_delivery_rate","campaign_failure_rate","workflow_failure_rate_24h","unhealthy_integrations"],
    operatingObjects: ["properties","leads","inspections","buyers","campaigns"],
    boundaries: ["Never treat an unverified property as verified.","Do not infer payment, ownership, title status, inspection attendance or closing without authoritative evidence.","Consequential outreach and record mutation remain approval-gated through canonical Leo tools."], createdAt: BASE_DATE, updatedAt: BASE_DATE,
  },
  {
    id: "system-gencouv-v1", key: "gencouv", version: 1, workspacePattern: "gencouv", title: "Gencouv", businessType: "trading_service_onboarding", description: "Lead generation, qualification and onboarding operations for broker-connected trading services where client funds remain with the broker.", status: "active", source: "system",
    entities: ["prospect","client","onboarding","broker_connection","campaign","support_case"],
    pipelineStages: ["new","engaged","qualified","onboarding","broker_connection","active_client"],
    primaryEvents: ["lead.created","lead.qualified","client.onboarding_started","client.onboarding_stalled","integration.connected","integration.disconnected"],
    primaryKpis: ["workflow_failure_rate_24h","unhealthy_integrations","critical_operational_signals"],
    operatingObjects: ["prospects","onboarding","broker_connections","clients","campaigns"],
    boundaries: ["Do not claim custody of client funds when the operating model is broker-connected.","Do not infer deposits, trading performance or broker status without authoritative evidence.","Financial performance claims require verified source data and must not be projected from sparse history."], createdAt: BASE_DATE, updatedAt: BASE_DATE,
  },
  {
    id: "system-fluxknight-v1", key: "fluxknight", version: 1, workspacePattern: "fluxknight|fluxagents|boundless flux", title: "Fluxknight", businessType: "ai_automation_platform", description: "AI automation platform operations covering prospects, client workspaces, deployments, agents, subscriptions, integrations, workflows and usage.", status: "active", source: "system",
    entities: ["prospect","client","workspace","agent","workflow","integration","subscription","usage_event","deployment"],
    pipelineStages: ["prospect","qualified","onboarding","configured","deployed","active","renewal"],
    primaryEvents: ["workflow.started","workflow.succeeded","workflow.failed","integration.connected","integration.disconnected","client.onboarding_started","client.onboarding_stalled"],
    primaryKpis: ["workflow_failure_rate_24h","unhealthy_integrations","critical_operational_signals"],
    operatingObjects: ["prospects","clients","deployments","agents","subscriptions","usage","workflows","integrations"],
    boundaries: ["Tenant data remains isolated by exact organization ID.","Runtime health does not prove business outcome or client satisfaction.","No autonomous consequential execution outside canonical approval and evidence controls."], createdAt: BASE_DATE, updatedAt: BASE_DATE,
  },
  {
    id: "system-generic-client-v1", key: "generic-client", version: 1, title: "Generic Client Workspace", businessType: "client_workspace", description: "Safe fallback model for client workspaces whose business-specific operating model has not yet been configured.", status: "active", source: "system",
    entities: ["lead","client","agent","workflow","integration"], pipelineStages: [], primaryEvents: ["workflow.failed","integration.disconnected"], primaryKpis: ["workflow_failure_rate_24h","unhealthy_integrations","critical_operational_signals"], operatingObjects: ["agents","workflows","integrations"], boundaries: ["Do not invent business-specific entities, stages, KPIs or financial meaning.","Use only verified workspace configuration and authoritative current state."], createdAt: BASE_DATE, updatedAt: BASE_DATE,
  },
];

function clean(value: unknown, max = 1000) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function stringList(value: unknown, max = 40) { return Array.isArray(value) ? [...new Set(value.map(v => clean(v, 120)).filter(Boolean))].slice(0, max) : []; }
function parse(row: StoredRow): LeoWorkspaceBusinessModel | null { try { const value = typeof row.content === "string" ? JSON.parse(row.content) : row.content; return value && typeof value === "object" && !Array.isArray(value) && (value as LeoWorkspaceBusinessModel).id ? value as LeoWorkspaceBusinessModel : null; } catch { return null; } }
function storageKey(model: LeoWorkspaceBusinessModel) { return `${PREFIX}${model.key}:v${model.version}`; }
async function persist(identity: LeoIdentity, model: LeoWorkspaceBusinessModel) {
  if (identity.scope !== "super_admin") throw new Error("Workspace business models are restricted to Super Leo.");
  const userId = storageKey(model);
  const existing = await supabaseServerRequest<Array<{id:string}>>(`bot_sessions?select=id&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => []);
  const body = JSON.stringify({ role: ROLE, user_id: userId, content: JSON.stringify(model), created_at: model.createdAt });
  if (existing[0]?.id) await supabaseServerRequest(`bot_sessions?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
  else await supabaseServerRequest("bot_sessions", { method: "POST", body });
  return model;
}

export async function listLeoWorkspaceBusinessModels(identity: LeoIdentity, includeInactive = false) {
  if (identity.scope !== "super_admin") return [];
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=content&role=eq.${ROLE}&order=created_at.desc&limit=250`).catch(() => []);
  const custom = rows.map(parse).filter((item): item is LeoWorkspaceBusinessModel => Boolean(item));
  const customKeys = new Set(custom.filter(item => item.status === "active").map(item => item.key));
  return [...custom, ...SYSTEM_MODELS.filter(item => !customKeys.has(item.key))].filter(item => includeInactive || item.status === "active").sort((a,b) => a.key.localeCompare(b.key) || b.version - a.version);
}

export async function resolveLeoWorkspaceBusinessModel(input: { identity: LeoIdentity; workspace?: string; organizationId?: string }) {
  if (input.identity.scope !== "super_admin") throw new Error("Workspace business models are restricted to Super Leo.");
  const portfolio = await listLeoWorkspacePortfolio(input.identity);
  const target = input.workspace || input.organizationId ? await resolveLeoWorkspaceTarget(input.identity, input.organizationId || input.workspace || "") : null;
  const models = await listLeoWorkspaceBusinessModels(input.identity);
  if (!target) return { target: null, model: null, portfolioCount: portfolio.length };
  const exact = models.find(model => model.organizationId === target.organizationId);
  if (exact) return { target, model: exact, portfolioCount: portfolio.length };
  const haystack = `${target.name} ${target.slug} ${target.aliases.join(" ")}`;
  const matched = models.find(model => model.workspacePattern && new RegExp(model.workspacePattern, "i").test(haystack));
  if (matched) return { target, model: matched, portfolioCount: portfolio.length };
  const fallback = models.find(model => model.key === "generic-client") || null;
  return { target, model: fallback, portfolioCount: portfolio.length };
}

export async function createLeoWorkspaceBusinessModelDraft(identity: LeoIdentity, input: Record<string, unknown>) {
  if (identity.scope !== "super_admin") throw new Error("Workspace business models are restricted to Super Leo.");
  const key = clean(input.key, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const title = clean(input.title, 180); const businessType = clean(input.businessType || input.business_type, 120); const description = clean(input.description, 1200);
  if (!key || !title || !businessType || !description) throw new Error("key, title, businessType and description are required.");
  const all = await listLeoWorkspaceBusinessModels(identity, true); const version = Math.max(0, ...all.filter(m => m.key === key).map(m => m.version)) + 1; const now = new Date().toISOString();
  return persist(identity, { id: randomUUID(), key, version, organizationId: clean(input.organizationId || input.organization_id, 120) || undefined, workspacePattern: clean(input.workspacePattern || input.workspace_pattern, 240) || undefined, title, businessType, description, status: "draft", source: "admin", entities: stringList(input.entities), pipelineStages: stringList(input.pipelineStages || input.pipeline_stages), primaryEvents: stringList(input.primaryEvents || input.primary_events), primaryKpis: stringList(input.primaryKpis || input.primary_kpis), operatingObjects: stringList(input.operatingObjects || input.operating_objects), boundaries: stringList(input.boundaries), createdAt: now, updatedAt: now });
}

export async function setLeoWorkspaceBusinessModelStatus(identity: LeoIdentity, id: string, status: LeoBusinessModelStatus) {
  const models = await listLeoWorkspaceBusinessModels(identity, true); const current = models.find(model => model.id === id); if (!current) throw new Error("Workspace business model was not found.");
  if (status === "active") for (const prior of models.filter(model => model.key === current.key && model.id !== current.id && model.status === "active" && model.source === "admin")) await persist(identity, { ...prior, status: "retired", updatedAt: new Date().toISOString() });
  return persist(identity, { ...current, status, source: current.source === "system" ? "admin" : current.source, updatedAt: new Date().toISOString() });
}

export async function buildLeoWorkspaceBusinessModelSnapshot(input: { identity: LeoIdentity; workspace?: string; organizationId?: string }) {
  const resolved = await resolveLeoWorkspaceBusinessModel(input);
  return { generatedAt: new Date().toISOString(), target: resolved.target, model: resolved.model, portfolioCount: resolved.portfolioCount, rules: { identity: "Every business-specific operation must resolve to one exact workspace organization ID before private inspection or execution.", fallback: "Generic client models must not invent business-specific entities, pipeline stages, KPIs or financial meaning.", authority: "Business models define operating semantics only; they do not grant tools, permissions, approvals or prove execution.", precedence: "Current verified state and explicit user instruction override stale model assumptions, while canonical safety and tenant-isolation controls never weaken." } };
}
