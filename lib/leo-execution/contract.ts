import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { LeoIdentity } from "@/lib/leo-core";

export const CRM_FOLLOWUP_TOOL = "leo.crm.followup.send";
export const CRM_FOLLOWUP_TASK = "leo-crm-followup-v1";
export function crmTriggerEnabled() { return process.env.LEO_CRM_FOLLOWUP_PROVIDER === "trigger_dev"; }
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  const json = JSON.stringify(value);
  if (json === undefined) throw new Error("Leo action must contain JSON values.");
  return json;
}
export function digest(value: unknown) { return createHash("sha256").update(canonical(value)).digest("hex"); }
export function principal(identity: LeoIdentity) {
  if (identity.scope === "tenant" && identity.userId) return `user:${identity.userId}`;
  if (identity.scope === "super_admin" && identity.role === "super_admin" && identity.globalScope && identity.email) return `admin:${identity.email.trim().toLowerCase()}`;
  throw new Error("An authenticated Leo principal is required.");
}
export function approvalToken() { return randomBytes(32).toString("base64url"); }
export function tokenDigest(token: string) {
  const secret = process.env.LEO_EXECUTION_SIGNING_SECRET?.trim();
  if (!secret) throw new Error("LEO_EXECUTION_SIGNING_SECRET is required for CRM approvals.");
  return createHmac("sha256", secret).update(token).digest("hex");
}
export function equalDigest(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
/** Canonical IDs only; no caller-supplied destination, template, timestamp or task name. */
export function crmAction(args: Record<string, unknown>, organizationId: string) {
  const allowed = new Set(["organization_id", "agent_id", "customer_id", "message", "channel"]);
  if (Object.keys(args).some(k => !allowed.has(k))) throw new Error("Unsupported CRM follow-up arguments.");
  if (args.channel && args.channel !== "whatsapp") throw new Error("Only WhatsApp CRM follow-ups are supported.");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const agentId = String(args.agent_id || "").trim(), customerId = String(args.customer_id || "").trim();
  const message = typeof args.message === "string" ? args.message.trim() : "";
  if (!uuid.test(organizationId) || !uuid.test(agentId) || !uuid.test(customerId) || !message || message.length > 4000) throw new Error("CRM follow-up requires organization_id, agent_id, customer_id and a message of 1–4000 characters.");
  return { organization_id: organizationId, agent_id: agentId, customer_id: customerId, channel: "whatsapp" as const, message };
}
export type CrmAction = ReturnType<typeof crmAction>;
export type ExecutionStatus = "pending_dispatch" | "queued" | "processing" | "sending" | "completed" | "failed" | "unknown";
export type CrmExecution = {
  id: string; organization_id: string; approval_id: string; principal: string;
  session_id: string; channel: LeoIdentity["channel"]; identity: LeoIdentity;
  arguments: CrmAction; action_digest: string; status: ExecutionStatus;
  authorized_until: string; provider_run_id: string | null;
  result: Record<string, unknown> | null; error: string | null;
};
export function executionResult(row: CrmExecution) {
  return { ok: !["failed", "unknown", "pending_dispatch"].includes(row.status), requestId: row.approval_id,
    toolKey: CRM_FOLLOWUP_TOOL, executionId: row.id, status: row.status, result: row.result,
    error: row.error, provider: "trigger_dev", runId: row.provider_run_id };
}
