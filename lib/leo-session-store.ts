import { randomUUID } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { enforceLeoOrganizationScope, sanitizeLeoPageContext, type LeoConversationVisibility, type LeoIdentity } from "@/lib/leo-core";
import type { LeoProposedToolCall } from "@/lib/ai/leo-model";
import type { PublicLeoLeadProfile } from "@/lib/leo-lead-capture";

type LeoSessionRow = { id: string; scope: string; organization_id?: string | null; user_id?: string | null; membership_id?: string | null; role: string; channel: string; visibility: string; status: string; metadata?: Record<string, unknown> | null };
export type LeoVoiceWorkingContext = { workspace?: string; action?: string; leadId?: string; leadName?: string; property?: string; audience?: Record<string, unknown>; message?: string; pendingToolKey?: string; pendingArguments?: Record<string, unknown>; pendingSince?: string; lastResult?: Record<string, unknown> };
export type LeoSessionState = { id: string; persisted: boolean; visibility: LeoConversationVisibility; leadProfile?: PublicLeoLeadProfile; leadCaptured: boolean; leadId?: string | null; voiceWorkingContext?: LeoVoiceWorkingContext };

function visibilityFor(identity: LeoIdentity, requested?: unknown): LeoConversationVisibility {
  if (identity.scope === "public" || identity.scope === "super_admin") return "private";
  if (requested === "team" || requested === "organization") return requested;
  return "private";
}
function sessionState(row?: LeoSessionRow) {
  const metadata = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const profile = metadata.public_leo_lead_profile;
  const voice = metadata.leo_voice_working_context;
  return { leadProfile: profile && typeof profile === "object" && !Array.isArray(profile) ? profile as PublicLeoLeadProfile : undefined, leadCaptured: metadata.public_leo_lead_captured === true, leadId: typeof metadata.public_leo_lead_id === "string" ? metadata.public_leo_lead_id : null, voiceWorkingContext: voice && typeof voice === "object" && !Array.isArray(voice) ? voice as LeoVoiceWorkingContext : undefined };
}
function queryForExisting(identity: LeoIdentity, sessionId: string) {
  const parts = [`id=eq.${encodeURIComponent(sessionId)}`, `scope=eq.${encodeURIComponent(identity.scope)}`, "status=eq.active", "limit=1"];
  if (identity.scope === "tenant") parts.push(`organization_id=eq.${encodeURIComponent(String(enforceLeoOrganizationScope(identity) || ""))}`);
  if (identity.userId && identity.scope !== "public") parts.push(`user_id=eq.${encodeURIComponent(identity.userId)}`);
  return `leo_sessions?select=id,scope,organization_id,user_id,membership_id,role,channel,visibility,status,metadata&${parts.join("&")}`;
}

export async function getOrCreateLeoSession(input: { identity: LeoIdentity; sessionId?: string; pageContext?: unknown; visibility?: unknown }): Promise<LeoSessionState> {
  const visibility = visibilityFor(input.identity, input.visibility);
  const requestedId = String(input.sessionId || "").trim();
  if (requestedId) {
    const existing = await supabaseServerRequest<LeoSessionRow[]>(queryForExisting(input.identity, requestedId)).catch(() => []);
    if (existing[0]) {
      void supabaseServerRequest(`leo_sessions?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", body: JSON.stringify({ last_active_at: new Date().toISOString(), updated_at: new Date().toISOString(), page_context: sanitizeLeoPageContext(input.pageContext) || {} }) }).catch(() => null);
      return { id: existing[0].id, persisted: true, visibility: existing[0].visibility as LeoConversationVisibility, ...sessionState(existing[0]) };
    }
  }
  const id = randomUUID();
  const organizationId = input.identity.scope === "tenant" ? enforceLeoOrganizationScope(input.identity) : null;
  const created = await supabaseServerRequest<LeoSessionRow[]>("leo_sessions", { method: "POST", body: JSON.stringify({ id, scope: input.identity.scope, organization_id: organizationId || null, user_id: input.identity.userId || null, membership_id: input.identity.membershipId || null, role: input.identity.role, channel: input.identity.channel, visibility, status: "active", page_context: sanitizeLeoPageContext(input.pageContext) || {}, metadata: { global_scope: input.identity.globalScope } }) }).catch(() => []);
  return { id: created[0]?.id || id, persisted: Boolean(created[0]?.id), visibility, leadCaptured: false, leadProfile: undefined, leadId: null, voiceWorkingContext: undefined };
}

async function mergeSessionMetadata(identity: LeoIdentity, session: LeoSessionState, patch: Record<string, unknown>) {
  if (!session.persisted) return;
  const scope = encodeURIComponent(identity.scope);
  const rows = await supabaseServerRequest<LeoSessionRow[]>(`leo_sessions?select=metadata&id=eq.${encodeURIComponent(session.id)}&scope=eq.${scope}&status=eq.active&limit=1`).catch(() => []);
  const existing = rows[0]?.metadata && typeof rows[0].metadata === "object" ? rows[0].metadata : {};
  await supabaseServerRequest(`leo_sessions?id=eq.${encodeURIComponent(session.id)}&scope=eq.${scope}&status=eq.active`, { method: "PATCH", body: JSON.stringify({ metadata: { ...existing, ...patch }, updated_at: new Date().toISOString(), last_active_at: new Date().toISOString() }) });
}

export async function updateLeoVoiceWorkingContext(input: { identity: LeoIdentity; session: LeoSessionState; context?: LeoVoiceWorkingContext | null }) {
  if (!input.session.persisted || input.identity.scope !== "super_admin") return { ...input.session, voiceWorkingContext: input.context || undefined };
  await mergeSessionMetadata(input.identity, input.session, { leo_voice_working_context: input.context || null });
  return { ...input.session, voiceWorkingContext: input.context || undefined };
}

export async function updateLeoPublicLeadState(input: { identity: LeoIdentity; session: LeoSessionState; leadProfile: PublicLeoLeadProfile; captured?: boolean; leadId?: string | null }) {
  if (!input.session.persisted || input.identity.scope !== "public") return input.session;
  const metadata = { public_leo_lead_profile: input.leadProfile, public_leo_lead_captured: input.captured === true || input.session.leadCaptured, public_leo_lead_id: input.leadId || input.session.leadId || null };
  await mergeSessionMetadata(input.identity, input.session, metadata).catch(() => null);
  return { ...input.session, leadProfile: input.leadProfile, leadCaptured: metadata.public_leo_lead_captured === true, leadId: typeof metadata.public_leo_lead_id === "string" ? metadata.public_leo_lead_id : null };
}

export async function loadLeoHistory(identity: LeoIdentity, session: LeoSessionState) {
  if (!session.persisted) return [];
  const organizationId = identity.scope === "tenant" ? enforceLeoOrganizationScope(identity) : undefined;
  const orgFilter = organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "";
  const rows = await supabaseServerRequest<Array<{ role: string; content: string }>>(`leo_messages?select=role,content&session_id=eq.${encodeURIComponent(session.id)}${orgFilter}&order=created_at.asc&limit=40`).catch(() => []);
  return rows.filter((item) => item.role === "user" || item.role === "assistant").map((item) => ({ role: item.role as "user" | "assistant", content: item.content }));
}
export async function storeLeoMessage(input: { identity: LeoIdentity; session: LeoSessionState; role: "user" | "assistant" | "system" | "tool"; content: string; metadata?: Record<string, unknown> }) {
  if (!input.session.persisted) return null;
  const organizationId = input.identity.scope === "tenant" ? enforceLeoOrganizationScope(input.identity) : null;
  return supabaseServerRequest("leo_messages", { method: "POST", body: JSON.stringify({ session_id: input.session.id, organization_id: organizationId || null, user_id: input.role === "user" ? input.identity.userId || null : null, role: input.role, content: input.content.slice(0, 12000), metadata: input.metadata || {} }) }).catch(() => null);
}
export async function storeLeoToolProposals(input: { identity: LeoIdentity; session: LeoSessionState; toolCalls: LeoProposedToolCall[] }) {
  if (!input.session.persisted || !input.toolCalls.length) return [];
  const organizationId = input.identity.scope === "tenant" ? enforceLeoOrganizationScope(input.identity) : null;
  const created: unknown[] = [];
  for (const call of input.toolCalls.slice(0, 4)) {
    const status = call.approval === "none" ? "approved" : call.approval === "admin" ? "waiting_admin" : "waiting_confirmation";
    const rows = await supabaseServerRequest<unknown[]>("leo_tool_calls", { method: "POST", body: JSON.stringify({ session_id: input.session.id, organization_id: organizationId || null, tool_key: call.toolKey, arguments: call.arguments, approval_mode: call.approval, status, requested_by_user_id: input.identity.userId || null, requested_by_role: input.identity.role }) }).catch(() => []);
    if (rows[0]) created.push(rows[0]);
  }
  return created;
}
export async function auditLeoEvent(input: { identity: LeoIdentity; session?: LeoSessionState; eventType: string; toolKey?: string; details?: Record<string, unknown> }) {
  const organizationId = input.identity.scope === "tenant" ? enforceLeoOrganizationScope(input.identity) : null;
  return supabaseServerRequest("leo_audit_logs", { method: "POST", body: JSON.stringify({ session_id: input.session?.persisted ? input.session.id : null, organization_id: organizationId || null, actor_user_id: input.identity.userId || null, actor_role: input.identity.role, scope: input.identity.scope, event_type: input.eventType, tool_key: input.toolKey || null, details: input.details || {} }) }).catch(() => null);
}
