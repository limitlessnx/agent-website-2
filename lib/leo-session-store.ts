import { randomUUID } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import {
  enforceLeoOrganizationScope,
  sanitizeLeoPageContext,
  type LeoConversationVisibility,
  type LeoIdentity,
  type LeoProposedToolCall as NeverLeoProposedToolCall,
} from "@/lib/leo-core";
import type { LeoProposedToolCall } from "@/lib/ai/leo-model";

// Keep this import-free alias check from silently drifting if leo-core later adds a similarly named type.
void (0 as unknown as NeverLeoProposedToolCall);

type LeoSessionRow = {
  id: string;
  scope: string;
  organization_id?: string | null;
  user_id?: string | null;
  membership_id?: string | null;
  role: string;
  channel: string;
  visibility: string;
  status: string;
};

export type LeoSessionState = {
  id: string;
  persisted: boolean;
  visibility: LeoConversationVisibility;
};

function visibilityFor(identity: LeoIdentity, requested?: unknown): LeoConversationVisibility {
  if (identity.scope === "public" || identity.scope === "super_admin") return "private";
  if (requested === "team" || requested === "organization") return requested;
  return "private";
}

function queryForExisting(identity: LeoIdentity, sessionId: string) {
  const parts = [
    `id=eq.${encodeURIComponent(sessionId)}`,
    `scope=eq.${encodeURIComponent(identity.scope)}`,
    "status=eq.active",
    "limit=1",
  ];
  if (identity.scope === "tenant") {
    const organizationId = enforceLeoOrganizationScope(identity);
    parts.push(`organization_id=eq.${encodeURIComponent(String(organizationId || ""))}`);
  }
  if (identity.userId && identity.scope !== "public") {
    parts.push(`user_id=eq.${encodeURIComponent(identity.userId)}`);
  }
  return `leo_sessions?select=id,scope,organization_id,user_id,membership_id,role,channel,visibility,status&${parts.join("&")}`;
}

export async function getOrCreateLeoSession(input: {
  identity: LeoIdentity;
  sessionId?: string;
  pageContext?: unknown;
  visibility?: unknown;
}): Promise<LeoSessionState> {
  const visibility = visibilityFor(input.identity, input.visibility);
  const requestedId = String(input.sessionId || "").trim();

  if (requestedId) {
    const existing = await supabaseServerRequest<LeoSessionRow[]>(queryForExisting(input.identity, requestedId)).catch(() => []);
    if (existing[0]) {
      void supabaseServerRequest(`leo_sessions?id=eq.${encodeURIComponent(existing[0].id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          last_active_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          page_context: sanitizeLeoPageContext(input.pageContext) || {},
        }),
      }).catch(() => null);
      return { id: existing[0].id, persisted: true, visibility: existing[0].visibility as LeoConversationVisibility };
    }
  }

  const id = randomUUID();
  const organizationId = input.identity.scope === "tenant" ? enforceLeoOrganizationScope(input.identity) : null;
  const created = await supabaseServerRequest<LeoSessionRow[]>("leo_sessions", {
    method: "POST",
    body: JSON.stringify({
      id,
      scope: input.identity.scope,
      organization_id: organizationId || null,
      user_id: input.identity.userId || null,
      membership_id: input.identity.membershipId || null,
      role: input.identity.role,
      channel: input.identity.channel,
      visibility,
      status: "active",
      page_context: sanitizeLeoPageContext(input.pageContext) || {},
      metadata: { global_scope: input.identity.globalScope },
    }),
  }).catch(() => []);

  return { id: created[0]?.id || id, persisted: Boolean(created[0]?.id), visibility };
}

export async function loadLeoHistory(identity: LeoIdentity, session: LeoSessionState) {
  if (!session.persisted) return [];
  const organizationId = identity.scope === "tenant" ? enforceLeoOrganizationScope(identity) : undefined;
  const orgFilter = organizationId ? `&organization_id=eq.${encodeURIComponent(organizationId)}` : "";
  const rows = await supabaseServerRequest<Array<{ role: string; content: string }>>(
    `leo_messages?select=role,content&session_id=eq.${encodeURIComponent(session.id)}${orgFilter}&order=created_at.asc&limit=40`,
  ).catch(() => []);
  return rows
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({ role: item.role as "user" | "assistant", content: item.content }));
}

export async function storeLeoMessage(input: {
  identity: LeoIdentity;
  session: LeoSessionState;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: Record<string, unknown>;
}) {
  if (!input.session.persisted) return null;
  const organizationId = input.identity.scope === "tenant" ? enforceLeoOrganizationScope(input.identity) : null;
  return supabaseServerRequest("leo_messages", {
    method: "POST",
    body: JSON.stringify({
      session_id: input.session.id,
      organization_id: organizationId || null,
      user_id: input.role === "user" ? input.identity.userId || null : null,
      role: input.role,
      content: input.content.slice(0, 12000),
      metadata: input.metadata || {},
    }),
  }).catch(() => null);
}

export async function storeLeoToolProposals(input: {
  identity: LeoIdentity;
  session: LeoSessionState;
  toolCalls: LeoProposedToolCall[];
}) {
  if (!input.session.persisted || !input.toolCalls.length) return [];
  const organizationId = input.identity.scope === "tenant" ? enforceLeoOrganizationScope(input.identity) : null;
  const created: unknown[] = [];
  for (const call of input.toolCalls.slice(0, 4)) {
    const status = call.approval === "none"
      ? "approved"
      : call.approval === "admin"
        ? "waiting_admin"
        : "waiting_confirmation";
    const rows = await supabaseServerRequest<unknown[]>("leo_tool_calls", {
      method: "POST",
      body: JSON.stringify({
        session_id: input.session.id,
        organization_id: organizationId || null,
        tool_key: call.toolKey,
        arguments: call.arguments,
        approval_mode: call.approval,
        status,
        requested_by_user_id: input.identity.userId || null,
        requested_by_role: input.identity.role,
      }),
    }).catch(() => []);
    if (rows[0]) created.push(rows[0]);
  }
  return created;
}

export async function auditLeoEvent(input: {
  identity: LeoIdentity;
  session?: LeoSessionState;
  eventType: string;
  toolKey?: string;
  details?: Record<string, unknown>;
}) {
  const organizationId = input.identity.scope === "tenant" ? enforceLeoOrganizationScope(input.identity) : null;
  return supabaseServerRequest("leo_audit_logs", {
    method: "POST",
    body: JSON.stringify({
      session_id: input.session?.persisted ? input.session.id : null,
      organization_id: organizationId || null,
      actor_user_id: input.identity.userId || null,
      actor_role: input.identity.role,
      scope: input.identity.scope,
      event_type: input.eventType,
      tool_key: input.toolKey || null,
      details: input.details || {},
    }),
  }).catch(() => null);
}
