import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoIdentity } from "@/lib/leo-core";

export type LeoAutonomyGovernance = {
  version: "7I-1";
  globalEnabled: boolean;
  killSwitch: boolean;
  observeRecommend: boolean;
  allowControlledPreparation: boolean;
  consequentialAutonomousExecution: false;
  requireExactOrganization: boolean;
  requireCanonicalApproval: boolean;
  requireEvidenceBeforeRetry: boolean;
  allowSelfApproval: false;
  maxProposalsPerCycle: number;
  maxControlledInterventionsPerDay: number;
  maxWorkspaceSegmentsPerOperation: number;
  pausedOrganizationIds: string[];
  updatedAt: string;
  updatedBy: string;
};

type StoredRow = { id?: string; content?: string | Record<string, unknown> };
const ROLE = "leo_autonomy_governance";
const KEY = "leo_governance:global";

function actor(identity: LeoIdentity) { return identity.email || identity.userId || "super_admin"; }
function cleanIds(value: unknown) { return [...new Set((Array.isArray(value) ? value : []).map(String).map((item) => item.trim()).filter(Boolean))].slice(0, 100); }
function clamp(value: unknown, fallback: number, min: number, max: number) { const n = Number(value); return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback; }
function defaults(identity: LeoIdentity): LeoAutonomyGovernance {
  return {
    version: "7I-1",
    globalEnabled: true,
    killSwitch: false,
    observeRecommend: true,
    allowControlledPreparation: true,
    consequentialAutonomousExecution: false,
    requireExactOrganization: true,
    requireCanonicalApproval: true,
    requireEvidenceBeforeRetry: true,
    allowSelfApproval: false,
    maxProposalsPerCycle: 8,
    maxControlledInterventionsPerDay: 10,
    maxWorkspaceSegmentsPerOperation: 8,
    pausedOrganizationIds: [],
    updatedAt: new Date().toISOString(),
    updatedBy: actor(identity),
  };
}
function parse(row?: StoredRow): LeoAutonomyGovernance | null {
  if (!row?.content) return null;
  try {
    const value = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Partial<LeoAutonomyGovernance>;
    return {
      version: "7I-1",
      globalEnabled: item.globalEnabled !== false,
      killSwitch: item.killSwitch === true,
      observeRecommend: item.observeRecommend !== false,
      allowControlledPreparation: item.allowControlledPreparation !== false,
      consequentialAutonomousExecution: false,
      requireExactOrganization: item.requireExactOrganization !== false,
      requireCanonicalApproval: item.requireCanonicalApproval !== false,
      requireEvidenceBeforeRetry: item.requireEvidenceBeforeRetry !== false,
      allowSelfApproval: false,
      maxProposalsPerCycle: clamp(item.maxProposalsPerCycle, 8, 1, 25),
      maxControlledInterventionsPerDay: clamp(item.maxControlledInterventionsPerDay, 10, 1, 50),
      maxWorkspaceSegmentsPerOperation: clamp(item.maxWorkspaceSegmentsPerOperation, 8, 1, 25),
      pausedOrganizationIds: cleanIds(item.pausedOrganizationIds),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
      updatedBy: String(item.updatedBy || "super_admin"),
    };
  } catch { return null; }
}

export async function getLeoAutonomyGovernance(identity: LeoIdentity) {
  if (identity.scope !== "super_admin") throw new Error("Leo autonomy governance is restricted to Super Admin.");
  const rows = await supabaseServerRequest<StoredRow[]>(`bot_sessions?select=id,content&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(KEY)}&order=created_at.desc&limit=1`).catch(() => []);
  return parse(rows[0]) || defaults(identity);
}

export async function updateLeoAutonomyGovernance(identity: LeoIdentity, patch: Partial<LeoAutonomyGovernance>) {
  if (identity.scope !== "super_admin") throw new Error("Leo autonomy governance is restricted to Super Admin.");
  const current = await getLeoAutonomyGovernance(identity);
  const next: LeoAutonomyGovernance = {
    ...current,
    globalEnabled: patch.globalEnabled ?? current.globalEnabled,
    killSwitch: patch.killSwitch ?? current.killSwitch,
    observeRecommend: patch.observeRecommend ?? current.observeRecommend,
    allowControlledPreparation: patch.allowControlledPreparation ?? current.allowControlledPreparation,
    consequentialAutonomousExecution: false,
    requireExactOrganization: patch.requireExactOrganization ?? current.requireExactOrganization,
    requireCanonicalApproval: patch.requireCanonicalApproval ?? current.requireCanonicalApproval,
    requireEvidenceBeforeRetry: patch.requireEvidenceBeforeRetry ?? current.requireEvidenceBeforeRetry,
    allowSelfApproval: false,
    maxProposalsPerCycle: clamp(patch.maxProposalsPerCycle, current.maxProposalsPerCycle, 1, 25),
    maxControlledInterventionsPerDay: clamp(patch.maxControlledInterventionsPerDay, current.maxControlledInterventionsPerDay, 1, 50),
    maxWorkspaceSegmentsPerOperation: clamp(patch.maxWorkspaceSegmentsPerOperation, current.maxWorkspaceSegmentsPerOperation, 1, 25),
    pausedOrganizationIds: patch.pausedOrganizationIds ? cleanIds(patch.pausedOrganizationIds) : current.pausedOrganizationIds,
    updatedAt: new Date().toISOString(),
    updatedBy: actor(identity),
    version: "7I-1",
  };
  const existing = await supabaseServerRequest<Array<{ id: string }>>(`bot_sessions?select=id&role=eq.${ROLE}&user_id=eq.${encodeURIComponent(KEY)}&limit=1`).catch(() => []);
  const body = JSON.stringify({ role: ROLE, user_id: KEY, content: JSON.stringify(next), created_at: next.updatedAt });
  if (existing[0]?.id) await supabaseServerRequest(`bot_sessions?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body });
  else await supabaseServerRequest("bot_sessions", { method: "POST", body });
  return next;
}

export function canLeoCreateControlledIntervention(policy: LeoAutonomyGovernance, organizationId?: string) {
  if (!policy.globalEnabled) return { allowed: false, reason: "Autonomy governance is globally disabled." };
  if (policy.killSwitch) return { allowed: false, reason: "The autonomy kill switch is active." };
  if (!policy.allowControlledPreparation) return { allowed: false, reason: "Controlled intervention preparation is disabled." };
  if (organizationId && policy.pausedOrganizationIds.includes(organizationId)) return { allowed: false, reason: "Autonomous preparation is paused for this organization." };
  return { allowed: true, reason: "A controlled intervention may be prepared. Consequential execution still requires canonical approval and evidence verification." };
}

export function auditLeoAutonomyGovernance(policy: LeoAutonomyGovernance) {
  const checks = {
    noConsequentialAutonomousExecution: policy.consequentialAutonomousExecution === false,
    noSelfApproval: policy.allowSelfApproval === false,
    exactOrganizationRequired: policy.requireExactOrganization === true,
    canonicalApprovalRequired: policy.requireCanonicalApproval === true,
    evidenceBeforeRetryRequired: policy.requireEvidenceBeforeRetry === true,
    boundedProposalCycle: policy.maxProposalsPerCycle > 0 && policy.maxProposalsPerCycle <= 25,
    killSwitchAvailable: typeof policy.killSwitch === "boolean",
  };
  return { version: policy.version, checks, passed: Object.values(checks).every(Boolean) };
}
