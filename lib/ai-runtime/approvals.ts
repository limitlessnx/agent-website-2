import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { assertLeoToolAllowed, type LeoIdentity } from "@/lib/leo-core";
import type { RuntimeApprovalStatus } from "@/lib/ai-runtime/types";

type ApprovalRow = { id: string; organization_id: string; execution_id: string; action_key: string; status: string; requested_by: string; reviewed_by?: string | null; reviewer_notes?: string | null; expires_at?: string | null; created_at?: string; reviewed_at?: string | null };

function organizationForApproval(identity: LeoIdentity, requested?: string) {
  if (identity.scope === "tenant") {
    if (!identity.organizationId) throw new Error("Tenant approval requires an organization ID.");
    if (requested && requested !== identity.organizationId) throw new Error("Cross-organization approval access is forbidden.");
    return identity.organizationId;
  }
  if (identity.scope === "super_admin" || identity.scope === "internal_service") {
    if (!requested) throw new Error("Approval requests require an explicit organization ID.");
    return requested;
  }
  throw new Error("Public identities cannot access the approval ledger.");
}

function status(value: string, expiresAt?: string | null): RuntimeApprovalStatus {
  if (expiresAt && Date.parse(expiresAt) <= Date.now() && value === "pending") return "expired";
  if (["pending", "approved", "rejected", "expired", "cancelled"].includes(value)) return value as RuntimeApprovalStatus;
  return "pending";
}

export async function createRuntimeApproval(input: { identity: LeoIdentity; organizationId?: string; executionId: string; actionKey: string; payload: Record<string, unknown>; expiresInMinutes?: number }) {
  const organizationId = organizationForApproval(input.identity, input.organizationId);
  if (!input.executionId || !input.actionKey) throw new Error("Approval request requires executionId and actionKey.");
  const expiresAt = new Date(Date.now() + Math.max(5, Math.min(Number(input.expiresInMinutes || 30), 1440)) * 60_000).toISOString();
  const rows = await supabaseServerRequest<ApprovalRow[]>("action_approval_requests", { method: "POST", body: JSON.stringify({ organization_id: organizationId, execution_id: input.executionId, action_key: input.actionKey, request_payload: input.payload, status: "pending", requested_by: input.identity.userId || input.identity.email || input.identity.scope, expires_at: expiresAt }) });
  if (!rows[0]?.id) throw new Error("Approval request could not be created.");
  return { ...rows[0], runtimeStatus: status(rows[0].status, rows[0].expires_at) };
}

export async function getRuntimeApproval(input: { identity: LeoIdentity; organizationId?: string; approvalRequestId: string; executionId: string; actionKey: string }) {
  const organizationId = organizationForApproval(input.identity, input.organizationId);
  const rows = await supabaseServerRequest<ApprovalRow[]>(`action_approval_requests?select=*&id=eq.${encodeURIComponent(input.approvalRequestId)}&organization_id=eq.${encodeURIComponent(organizationId)}&execution_id=eq.${encodeURIComponent(input.executionId)}&action_key=eq.${encodeURIComponent(input.actionKey)}&limit=1`);
  const row = rows[0];
  if (!row) throw new Error("Approval evidence was not found inside the current execution boundary.");
  return { ...row, runtimeStatus: status(row.status, row.expires_at) };
}

export async function requireRuntimeApproval(input: { identity: LeoIdentity; organizationId?: string; approvalRequestId?: string; executionId: string; actionKey: string }) {
  if (!input.approvalRequestId) return { approved: false as const, reason: "approval_required" as const };
  const row = await getRuntimeApproval({ ...input, approvalRequestId: input.approvalRequestId });
  if (row.runtimeStatus !== "approved") return { approved: false as const, reason: row.runtimeStatus, approval: row };
  return { approved: true as const, approval: row };
}

export async function reviewRuntimeApproval(input: { identity: LeoIdentity; organizationId?: string; approvalRequestId: string; decision: "approved" | "rejected" | "cancelled"; notes?: string }) {
  const organizationId = organizationForApproval(input.identity, input.organizationId);
  const rows = await supabaseServerRequest<ApprovalRow[]>(`action_approval_requests?select=*&id=eq.${encodeURIComponent(input.approvalRequestId)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`);
  const row = rows[0];
  if (!row) throw new Error("Approval request was not found inside the current organization boundary.");
  const runtimeStatus = status(row.status, row.expires_at);
  if (runtimeStatus !== "pending") throw new Error(`Approval request is already ${runtimeStatus}.`);
  const tool = assertLeoToolAllowed(input.identity, row.action_key);
  if (tool.approval === "admin" && input.identity.scope !== "super_admin") throw new Error("This action requires Super Admin approval.");
  if (tool.approval === "none") throw new Error("This action does not require approval.");
  const actor = input.identity.userId || input.identity.email || input.identity.scope;
  const notes = `${String(input.notes || "").trim().slice(0, 800)}${input.notes ? " | " : ""}Reviewed by ${actor}`.slice(0, 1000);
  const updated = await supabaseServerRequest<ApprovalRow[]>(`action_approval_requests?id=eq.${encodeURIComponent(row.id)}&organization_id=eq.${encodeURIComponent(organizationId)}&status=eq.pending`, { method: "PATCH", body: JSON.stringify({ status: input.decision, reviewed_at: new Date().toISOString(), reviewer_notes: notes }) });
  if (!updated[0]) throw new Error("Approval review did not update a pending request.");
  return { ...updated[0], runtimeStatus: status(updated[0].status, updated[0].expires_at) };
}
