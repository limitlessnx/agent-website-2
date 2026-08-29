import { randomUUID } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { resolveLeoTool, type LeoIdentity } from "@/lib/leo-core";

export type LeoPlaybookStatus = "draft" | "active" | "retired";
export type LeoPlaybookStep = {
  id: string;
  title: string;
  purpose: string;
  toolKey?: string;
  requiredContext?: string[];
  rules?: string[];
};
export type LeoOperationalPlaybook = {
  id: string;
  key: string;
  version: number;
  status: LeoPlaybookStatus;
  title: string;
  description: string;
  workspace?: string;
  triggerTerms: string[];
  rules: string[];
  steps: LeoPlaybookStep[];
  source: "system" | "admin";
  createdAt: string;
  updatedAt: string;
};

type StoredRow = { content?: string | Record<string, unknown>; user_id?: string; created_at?: string };
const ROLE = "leo_operational_playbook";
const PREFIX = "leo_playbook:";

function text(value: unknown, max = 1200) { return String(value || "").replace(/\s+/g, " ").trim().slice(0, max); }
function rec(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function terms(value: unknown) { const source = Array.isArray(value) ? value : []; return [...new Set(source.map((item) => text(item, 80).toLowerCase()).filter(Boolean))].slice(0, 30); }
function rules(value: unknown) { const source = Array.isArray(value) ? value : []; return source.map((item) => text(item, 500)).filter(Boolean).slice(0, 30); }
function keyFor(key: string, version: number) { return `${PREFIX}${key}:v${version}`; }
function parse(row: StoredRow): LeoOperationalPlaybook | null {
  try {
    const value = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as LeoOperationalPlaybook;
    return item.id && item.key && item.version && item.title && Array.isArray(item.steps) ? item : null;
  } catch { return null; }
}

const now = "2026-08-29T00:00:00.000Z";
const SYSTEM_PLAYBOOKS: LeoOperationalPlaybook[] = [
  {
    id: "system-limitless-qualified-lead-attention", key: "limitless-qualified-lead-attention", version: 1, status: "active", source: "system",
    title: "Limitless qualified lead attention", description: "Investigate qualified or stale Limitless Realty leads, prepare the safest follow-up, and never send without the existing approval boundary.", workspace: "limitless_realty",
    triggerTerms: ["qualified lead", "stale lead", "lead follow up", "follow-up", "limitless lead", "lead attention"],
    rules: ["Inspect current CRM evidence before recommending contact.", "Do not invent lead interest, budget, property preference, or contact details.", "Prepare before send.", "A prepared follow-up is not a delivered message.", "Use the existing confirmation-gated send tool for actual outbound contact."],
    steps: [
      { id: "inspect", title: "Inspect leads needing attention", purpose: "Identify the exact current leads and evidence.", toolKey: "leo.limitless.leads.read" },
      { id: "prepare", title: "Prepare the selected follow-up", purpose: "Prepare one exact follow-up after the target is unambiguous.", toolKey: "leo.limitless.followup.prepare", requiredContext: ["lead identity", "message/update or property"] },
      { id: "send", title: "Send only after exact approval", purpose: "Execute the approved follow-up through the canonical Limitless path.", toolKey: "leo.limitless.followup.send", requiredContext: ["exact prepared target", "explicit confirmation"] },
      { id: "verify", title: "Verify returned delivery evidence", purpose: "Report accepted/sent/delivered/read/failed separately and avoid stronger claims than evidence supports." },
    ], createdAt: now, updatedAt: now,
  },
  {
    id: "system-limitless-campaign-delivery-incident", key: "limitless-campaign-delivery-incident", version: 1, status: "active", source: "system",
    title: "Limitless campaign delivery incident", description: "Diagnose campaign delivery problems using recipient/provider evidence before any corrective send.", workspace: "limitless_realty",
    triggerTerms: ["campaign failed", "campaign delivery", "whatsapp delivery", "failed recipients", "message delivery", "campaign incident"],
    rules: ["Accepted by Meta is not delivered.", "Inspect campaign/recipient evidence before retrying.", "Never blindly resend a whole campaign because some recipients failed.", "Separate provider failures from unresolved/pending outcomes.", "Any corrective send remains confirmation-gated."],
    steps: [
      { id: "diagnose", title: "Diagnose campaign evidence", purpose: "Read the latest or identified campaign delivery evidence.", toolKey: "leo.limitless.leads.read", rules: ["Set campaign_diagnosis=true."] },
      { id: "classify", title: "Classify failure and unresolved recipients", purpose: "Separate failed, pending/unresolved, delivered and read outcomes." },
      { id: "recommend", title: "Recommend the narrowest corrective action", purpose: "Avoid duplicate delivery and whole-campaign retries." },
      { id: "approve", title: "Request approval if a corrective send is required", purpose: "Route any send through the canonical approval-gated tool." },
    ], createdAt: now, updatedAt: now,
  },
  {
    id: "system-workflow-incident", key: "workflow-incident-response", version: 1, status: "active", source: "system",
    title: "Workflow incident response", description: "Investigate a failed automation, establish scope and cause, then propose the smallest safe recovery.",
    triggerTerms: ["workflow failed", "automation failed", "runtime error", "workflow incident", "execution failure", "timed out"],
    rules: ["Inspect before changing workflow state.", "Do not retry a consequential execution blindly.", "Preserve tenant/workspace boundaries.", "Production-changing actions retain their canonical confirmation requirement.", "Report what was observed separately from what was inferred."],
    steps: [
      { id: "inspect", title: "Inspect recent workflow failures", purpose: "Collect current error evidence.", toolKey: "leo.workflow.inspect_failures" },
      { id: "scope", title: "Identify affected workflow and workspace", purpose: "Establish blast radius and whether the failure is recurring." },
      { id: "recommend", title: "Propose the smallest safe recovery", purpose: "Prefer inspection/resync over destructive changes." },
      { id: "verify", title: "Verify the post-recovery state", purpose: "Do not mark the incident resolved until evidence supports it." },
    ], createdAt: now, updatedAt: now,
  },
  {
    id: "system-integration-incident", key: "integration-incident-response", version: 1, status: "active", source: "system",
    title: "Integration incident response", description: "Diagnose disconnected or unhealthy integrations without exposing credentials or guessing at provider state.",
    triggerTerms: ["integration disconnected", "integration failed", "connection issue", "provider disconnected", "expired integration"],
    rules: ["Never expose credentials, tokens or authorization headers.", "Inspect connection health first.", "Distinguish configuration state from provider-confirmed health.", "Escalate repair when the available tools cannot safely restore the connection."],
    steps: [
      { id: "inspect", title: "Inspect integration health", purpose: "Read sanitized connection status.", toolKey: "leo.integration.inspect" },
      { id: "diagnose", title: "Determine likely failure class", purpose: "Separate expired credentials, configuration, provider and workflow symptoms." },
      { id: "recommend", title: "Recommend repair or escalation", purpose: "Do not fabricate a repair capability that is not exposed by Fluxknight." },
    ], createdAt: now, updatedAt: now,
  },
  {
    id: "system-onboarding-stall", key: "client-onboarding-stall", version: 1, status: "active", source: "system",
    title: "Client onboarding stall", description: "Investigate a stalled workspace setup, identify the exact missing readiness item, and route the next action without bypassing client or admin boundaries.",
    triggerTerms: ["onboarding stalled", "client setup", "workspace not ready", "onboarding blocker", "provisioning stalled"],
    rules: ["Inspect current workspace/readiness evidence before assigning blame.", "Do not mark setup complete from partial readiness.", "Keep administrative repair actions explicitly separated from tenant actions."],
    steps: [
      { id: "inspect", title: "Inspect workspace readiness", purpose: "Read the workspace and agent readiness state.", toolKey: "leo.tenant.inspect" },
      { id: "blocker", title: "Identify the first unresolved blocker", purpose: "Prefer the earliest dependency rather than treating all missing items equally." },
      { id: "route", title: "Route the next safe action", purpose: "Assign tenant, admin or integration work to the appropriate boundary." },
    ], createdAt: now, updatedAt: now,
  },
];

function normalizeStep(value: unknown, index: number): LeoPlaybookStep {
  const row = rec(value);
  const toolKey = text(row.toolKey || row.tool_key, 160) || undefined;
  if (toolKey && !resolveLeoTool(toolKey)) throw new Error(`Unknown Leo tool in playbook step: ${toolKey}`);
  return {
    id: text(row.id, 100) || randomUUID(),
    title: text(row.title, 180) || `Step ${index + 1}`,
    purpose: text(row.purpose, 600),
    toolKey,
    requiredContext: terms(row.requiredContext || row.required_context),
    rules: rules(row.rules),
  };
}
function normalize(input: Record<string, unknown>, version: number): LeoOperationalPlaybook {
  const key = text(input.key, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const title = text(input.title, 180); const description = text(input.description, 800);
  if (!key || !title || !description) throw new Error("Playbook key, title and description are required.");
  const rawSteps = Array.isArray(input.steps) ? input.steps : [];
  if (!rawSteps.length || rawSteps.length > 20) throw new Error("A playbook must contain between 1 and 20 steps.");
  const createdAt = new Date().toISOString();
  return {
    id: randomUUID(), key, version, status: "draft", title, description,
    workspace: text(input.workspace, 100) || undefined,
    triggerTerms: terms(input.triggerTerms || input.trigger_terms), rules: rules(input.rules),
    steps: rawSteps.map(normalizeStep), source: "admin", createdAt, updatedAt: createdAt,
  };
}
async function persist(identity: LeoIdentity, playbook: LeoOperationalPlaybook) {
  if (identity.scope !== "super_admin") throw new Error("Operational playbooks are restricted to Super Leo.");
  const userId = keyFor(playbook.key, playbook.version);
  const existing = await supabaseServerRequest<Array<{ id: string }>>(`bot_sessions?select=id&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(userId)}&limit=1`).catch(() => []);
  const body = JSON.stringify({ role: ROLE, user_id: userId, content: JSON.stringify(playbook), created_at: playbook.createdAt });
  if (existing[0]?.id) await supabaseServerRequest(`bot_sessions?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
  else await supabaseServerRequest("bot_sessions", { method: "POST", body });
  return playbook;
}
export async function listLeoOperationalPlaybooks(identity: LeoIdentity, input: { includeDrafts?: boolean; includeRetired?: boolean } = {}) {
  if (identity.scope !== "super_admin") return [];
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=user_id,content,created_at&role=eq.${ROLE}&order=created_at.desc&limit=250`).catch(() => []);
  const custom = rows.map(parse).filter((item): item is LeoOperationalPlaybook => Boolean(item));
  const combined = [...custom, ...SYSTEM_PLAYBOOKS];
  const newestByKey = new Map<string, LeoOperationalPlaybook>();
  for (const item of combined.sort((a, b) => b.version - a.version)) if (!newestByKey.has(item.key)) newestByKey.set(item.key, item);
  return [...newestByKey.values()].filter((item) => input.includeDrafts || item.status !== "draft").filter((item) => input.includeRetired || item.status !== "retired").sort((a, b) => a.title.localeCompare(b.title));
}
export async function createLeoPlaybookVersion(identity: LeoIdentity, input: Record<string, unknown>) {
  const allRows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=content&role=eq.${ROLE}&order=created_at.desc&limit=250`).catch(() => []);
  const custom = allRows.map(parse).filter((item): item is LeoOperationalPlaybook => Boolean(item));
  const key = text(input.key, 120).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const systemVersions = SYSTEM_PLAYBOOKS.filter((item) => item.key === key).map((item) => item.version);
  const versions = custom.filter((item) => item.key === key).map((item) => item.version).concat(systemVersions);
  return persist(identity, normalize(input, Math.max(0, ...versions) + 1));
}
export async function publishLeoPlaybook(identity: LeoIdentity, key: string, version: number) {
  if (identity.scope !== "super_admin") throw new Error("Operational playbooks are restricted to Super Leo.");
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=content,user_id&role=eq.${ROLE}&order=created_at.desc&limit=250`).catch(() => []);
  const custom = rows.map(parse).filter((item): item is LeoOperationalPlaybook => Boolean(item));
  const target = custom.find((item) => item.key === key && item.version === version);
  if (!target) throw new Error("Only an admin-created playbook version can be published.");
  for (const item of custom.filter((candidate) => candidate.key === key && candidate.status === "active" && candidate.id !== target.id)) await persist(identity, { ...item, status: "retired", updatedAt: new Date().toISOString() });
  return persist(identity, { ...target, status: "active", updatedAt: new Date().toISOString() });
}
export async function retireLeoPlaybook(identity: LeoIdentity, key: string, version: number) {
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=content&role=eq.${ROLE}&order=created_at.desc&limit=250`).catch(() => []);
  const custom = rows.map(parse).filter((item): item is LeoOperationalPlaybook => Boolean(item));
  const target = custom.find((item) => item.key === key && item.version === version);
  if (!target) throw new Error("Only an admin-created playbook version can be retired.");
  return persist(identity, { ...target, status: "retired", updatedAt: new Date().toISOString() });
}
function wordSet(value: string) { return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((item) => item.length > 2)); }
export async function matchLeoOperationalPlaybooks(identity: LeoIdentity, input: { query: string; workspace?: string; limit?: number }) {
  const query = text(input.query, 2000); if (!query) return [];
  const q = wordSet(query); const active = (await listLeoOperationalPlaybooks(identity)).filter((item) => item.status === "active");
  return active.map((playbook) => {
    const hay = wordSet(`${playbook.title} ${playbook.description} ${playbook.triggerTerms.join(" ")} ${playbook.rules.join(" ")}`);
    let score = 0; for (const term of q) if (hay.has(term)) score += 1;
    for (const trigger of playbook.triggerTerms) if (query.toLowerCase().includes(trigger.toLowerCase())) score += 4;
    if (input.workspace && playbook.workspace === input.workspace) score += 5;
    return { playbook, score };
  }).filter((item) => item.score > 1).sort((a, b) => b.score - a.score || b.playbook.version - a.playbook.version).slice(0, Math.max(1, Math.min(Number(input.limit || 4), 8))).map((item) => item.playbook);
}
export function compactLeoPlaybooksForContext(playbooks: LeoOperationalPlaybook[]) {
  return playbooks.slice(0, 8).map((item) => ({ key: item.key, version: item.version, title: item.title, description: item.description, workspace: item.workspace, rules: item.rules.slice(0, 10), steps: item.steps.map((step) => ({ title: step.title, purpose: step.purpose, toolKey: step.toolKey, requiredContext: step.requiredContext, rules: step.rules })) }));
}
