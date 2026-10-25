import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { LeoChannel, LeoIdentity } from "@/lib/leo-core";

/** Existing Limitless route selector; the underlying approval store is tenant-reusable. */
export const LIMITLESS_REALTY_ORGANIZATION_ID = "b15f21b4-5697-4d21-9421-8a34eae3476d";
export const LIMITLESS_REALTY_SLUG = "limitless-realty";

/**
 * Explicitly registered consequential tools that can target Limitless Realty.
 * Keep this list in lockstep with existing Leo tools; never replace it with a
 * prefix or wildcard; every unregistered action is absent.
 */
export const REAL_ESTATE_APPROVAL_TOOLS = [
  "leo.limitless.followup.send",
  "leo.limitless.campaign.send",
  "leo.crm.leads.update",
  "leo.crm.followup.send",
  "leo.campaign.send",
  "leo.appointment.manage",
  "leo.agent.pause",
  "leo.agent.resume",
] as const;

type RealEstateApprovalTool = (typeof REAL_ESTATE_APPROVAL_TOOLS)[number];
type ApprovalRequest = typeof supabaseServerRequest;

type ApprovalPrincipal = {
  kind: "user" | "super_admin_email";
  id: string;
};

export type LeoActionApprovalCreateInput = {
  identity: LeoIdentity;
  organizationId: string;
  sessionId: string;
  channel: LeoChannel;
  toolKey: string;
  arguments: Record<string, unknown>;
  realEstateOptIn: true;
  expiresInMs?: number;
  request?: ApprovalRequest;
};

export type LeoActionApproval = {
  approvalId: string;
  token: string;
  toolKey: RealEstateApprovalTool;
  argumentsDigest: string;
  expiresAt: string;
  status: "issued";
};

export type LeoActionApprovalConsumeInput = {
  identity: LeoIdentity;
  organizationId: string;
  sessionId: string;
  channel: LeoChannel;
  toolKey: string;
  arguments: Record<string, unknown>;
  approvalId: string;
  token: string;
  realEstateOptIn: true;
  request?: ApprovalRequest;
};

export type LeoActionApprovalConsumeResult =
  | { accepted: true; status: "accepted"; approvalId: string; consumedAt?: string | null }
  | { accepted: false; status: "consumed" | "expired" | "rejected"; approvalId: string };

const DEFAULT_EXPIRY_MS = 5 * 60 * 1000;
const MAX_EXPIRY_MS = 15 * 60 * 1000;

function nonEmpty(value: unknown, name: string) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > 512) throw new Error(`${name} is required.`);
  return normalized;
}

function approvalSecret() {
  return (
    process.env.LEO_EXECUTION_SIGNING_SECRET ||
    process.env.LEO_N8N_SHARED_SECRET ||
    process.env.RUNTIME_GATEWAY_SECRET ||
    ""
  ).trim();
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function tokenDigest(approvalId: string, token: string) {
  const input = `${approvalId}.${token}`;
  const secret = approvalSecret();
  return secret
    ? createHmac("sha256", secret).update(input, "utf8").digest("hex")
    : digest(input);
}

function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Approval arguments must contain finite numbers.");
    return JSON.stringify(value);
  }
  if (typeof value === "undefined") throw new Error("Approval arguments cannot contain undefined values.");
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol") {
    throw new Error("Approval arguments must be JSON-compatible.");
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  throw new Error("Approval arguments must be JSON-compatible.");
}

export function canonicalLeoApprovalArguments(toolKey: string, args: Record<string, unknown>) {
  return canonicalJson({ toolKey, arguments: args });
}

export function leoApprovalArgumentsDigest(toolKey: string, args: Record<string, unknown>) {
  return digest(canonicalLeoApprovalArguments(toolKey, args));
}

export function isRealEstateApprovalTool(toolKey: string): toolKey is RealEstateApprovalTool {
  return (REAL_ESTATE_APPROVAL_TOOLS as readonly string[]).includes(toolKey);
}

export function isLimitlessOrganizationId(value: unknown) {
  return typeof value === "string" && value.trim() === LIMITLESS_REALTY_ORGANIZATION_ID;
}

function realEstateTool(toolKey: string): RealEstateApprovalTool {
  if (isRealEstateApprovalTool(toolKey)) return toolKey;
  throw new Error("This approval surface is limited to opted-in Limitless Realty actions.");
}

function principalFor(identity: LeoIdentity): ApprovalPrincipal {
  const userId = typeof identity.userId === "string" ? identity.userId.trim() : "";
  if (userId) return { kind: "user", id: userId };

  // The email is accepted only from the server-resolved super-admin identity;
  // callers cannot supply an actor email separately.
  const email = typeof identity.email === "string" ? identity.email.trim().toLowerCase() : "";
  if (identity.scope === "super_admin" && identity.role === "super_admin" && identity.globalScope && email) {
    return { kind: "super_admin_email", id: email };
  }
  throw new Error("Approval requires an authenticated user or authenticated super-admin email.");
}

function scopedOrganization(identity: LeoIdentity, organizationId: string) {
  const explicit = nonEmpty(organizationId, "organizationId");
  if (identity.scope === "tenant" && identity.organizationId !== explicit) {
    throw new Error("Approval organization does not match the authenticated tenant.");
  }
  if (identity.scope !== "tenant" && identity.scope !== "super_admin") {
    throw new Error("Approval requires a tenant or super-admin identity.");
  }
  return explicit;
}

function scopedSession(identity: LeoIdentity, sessionId: string, channel: LeoChannel) {
  const session = nonEmpty(sessionId, "sessionId");
  if (identity.channel !== channel) throw new Error("Approval channel does not match the authenticated identity.");
  if (channel !== "chat" && channel !== "voice" && channel !== "api") throw new Error("Unsupported approval channel.");
  return session;
}

function assertOptIn(value: boolean) {
  if (value !== true) throw new Error("Real-estate approval requires explicit opt-in.");
}

function requestFor(input: { request?: ApprovalRequest }) {
  return input.request || supabaseServerRequest;
}

function rpcRow(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) return value[0] && typeof value[0] === "object" ? value[0] as Record<string, unknown> : undefined;
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

export async function createLeoActionApproval(input: LeoActionApprovalCreateInput): Promise<LeoActionApproval> {
  assertOptIn(input.realEstateOptIn);
  const toolKey = realEstateTool(nonEmpty(input.toolKey, "toolKey"));
  const organizationId = scopedOrganization(input.identity, input.organizationId);
  const sessionId = scopedSession(input.identity, input.sessionId, input.channel);
  const principal = principalFor(input.identity);
  const expiresInMs = input.expiresInMs ?? DEFAULT_EXPIRY_MS;
  if (!Number.isInteger(expiresInMs) || expiresInMs <= 0 || expiresInMs > MAX_EXPIRY_MS) {
    throw new Error("Approval expiry must be a positive interval no longer than 15 minutes.");
  }

  const approvalId = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const argumentsDigest = leoApprovalArgumentsDigest(toolKey, input.arguments);
  const expiresAt = new Date(Date.now() + expiresInMs);
  const response = await requestFor(input)("rpc/create_real_estate_action_approval", {
    method: "POST",
    body: JSON.stringify({
      p_approval_id: approvalId,
      p_organization_id: organizationId,
      p_principal_kind: principal.kind,
      p_principal_id: principal.id,
      p_tool_key: toolKey,
      p_arguments_digest: argumentsDigest,
      p_session_id: sessionId,
      p_channel: input.channel,
      p_token_digest: tokenDigest(approvalId, token),
      p_expires_at: expiresAt.toISOString(),
      p_real_estate_opt_in: true,
    }),
  });
  const row = rpcRow(response);
  if (!row || row.status !== "issued") throw new Error("Approval issuance was not accepted.");
  return { approvalId, token, toolKey, argumentsDigest, expiresAt: expiresAt.toISOString(), status: "issued" };
}

export async function consumeLeoActionApproval(input: LeoActionApprovalConsumeInput): Promise<LeoActionApprovalConsumeResult> {
  assertOptIn(input.realEstateOptIn);
  const approvalId = nonEmpty(input.approvalId, "approvalId");
  const token = nonEmpty(input.token, "token");
  const toolKey = realEstateTool(nonEmpty(input.toolKey, "toolKey"));
  const organizationId = scopedOrganization(input.identity, input.organizationId);
  const sessionId = scopedSession(input.identity, input.sessionId, input.channel);
  const principal = principalFor(input.identity);
  const argumentsDigest = leoApprovalArgumentsDigest(toolKey, input.arguments);
  const response = await requestFor(input)("rpc/consume_real_estate_action_approval", {
    method: "POST",
    body: JSON.stringify({
      p_approval_id: approvalId,
      p_organization_id: organizationId,
      p_principal_kind: principal.kind,
      p_principal_id: principal.id,
      p_tool_key: toolKey,
      p_arguments_digest: argumentsDigest,
      p_session_id: sessionId,
      p_channel: input.channel,
      p_token_digest: tokenDigest(approvalId, token),
      p_real_estate_opt_in: true,
    }),
  });
  const row = rpcRow(response);
  const status = row?.status;
  if (status === "accepted") {
    const consumedAt = typeof row?.consumed_at === "string" ? row.consumed_at : null;
    return { accepted: true, status: "accepted", approvalId, consumedAt };
  }
  if (status === "consumed" || status === "expired") return { accepted: false, status, approvalId };
  return { accepted: false, status: "rejected", approvalId };
}
