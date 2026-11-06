import { randomUUID } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LeoIdentity } from "@/lib/leo-core";
import { verifyLeoExecutionEnvelope, type LeoExecutionEnvelope } from "@/lib/leo-execution-envelope";
import { currentCrmIdentity, validateCrmBindings } from "../authorization";
import { approvalToken, crmAction, crmTriggerEnabled, CRM_FOLLOWUP_TASK, CRM_FOLLOWUP_TOOL, digest, executionResult, principal, tokenDigest, type CrmExecution } from "../contract";
import { loadExecution, transition } from "../store";

export async function issueCrmApproval(identity: LeoIdentity, args: Record<string, unknown>, sessionId: string) {
  if (!crmTriggerEnabled()) throw new Error("Trigger.dev CRM follow-ups are not enabled.");
  if (!sessionId || sessionId.length > 512) throw new Error("A sessionId is required for CRM approval.");
  const organizationId = identity.scope === "tenant" ? identity.organizationId! : String(args.organization_id || "");
  if (args.organization_id && args.organization_id !== organizationId) throw new Error("Cross-tenant CRM target blocked.");
  const current = await currentCrmIdentity(identity, organizationId);
  const action = crmAction(args, organizationId);
  await validateCrmBindings(action);
  const id = randomUUID(), token = approvalToken(), expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const { error } = await createAdminClient().from("leo_crm_approvals").insert({ id, organization_id: organizationId,
    principal: principal(current), session_id: sessionId, channel: identity.channel,
    action_digest: digest(action), token_digest: tokenDigest(token), expires_at: expiresAt });
  if (error) throw error;
  return { ok: false, status: "confirmation_required", toolKey: CRM_FOLLOWUP_TOOL, approval: "confirm",
    approvalId: id, approvalToken: token, expiresAt, arguments: action,
    message: "Confirm this exact CRM follow-up before it is queued. Provider acceptance does not prove delivery." };
}

export async function dispatchCrmFollowup(envelope: LeoExecutionEnvelope) {
  if (!crmTriggerEnabled()) throw new Error("Trigger.dev CRM follow-ups are not enabled.");
  const organizationId = String(envelope.arguments.organization_id || "");
  const current = await currentCrmIdentity({ ...envelope.identity, channel: envelope.channel,
    userId: envelope.identity.userId || undefined, email: envelope.identity.email || undefined,
    organizationId: envelope.identity.organizationId || undefined, membershipId: envelope.identity.membershipId || undefined }, organizationId);
  const verified = verifyLeoExecutionEnvelope(envelope, { permissions: current.permissions });
  if (envelope.toolKey !== CRM_FOLLOWUP_TOOL || !envelope.approvalGranted || !envelope.sessionId) throw new Error("CRM approval required.");
  const { _crm_approval: proof, ...args } = verified.envelope.arguments;
  const material = proof as { approvalId?: string; token?: string; principal?: string } | undefined;
  if (!material?.approvalId || !material.token || material.approvalId !== envelope.requestId || material.principal !== principal(current)) throw new Error("Server-issued CRM approval required.");
  const action = crmAction(args, organizationId);
  await validateCrmBindings(action);
  const { data, error } = await createAdminClient().rpc("accept_leo_crm_execution", {
    p_approval_id: material.approvalId, p_token_digest: tokenDigest(material.token),
    p_organization_id: organizationId, p_principal: principal(current), p_session_id: envelope.sessionId,
    p_channel: envelope.channel, p_action_digest: digest(action), p_arguments: action, p_identity: current,
  });
  if (error) throw error;
  let row = data as CrmExecution;
  if (row.status !== "pending_dispatch") return executionResult(row);
  try {
    // The database key survives Trigger's finite deduplication TTL and request retries.
    const run = await tasks.trigger(CRM_FOLLOWUP_TASK, { executionId: row.id }, { idempotencyKey: `leo-crm:${row.id}`, idempotencyKeyTTL: "24h" });
    row = await transition(row.id, ["pending_dispatch"], { status: "queued", provider_run_id: run.id, error: null }) || row;
    // Worker may already have advanced the row; never overwrite its result.
    return executionResult(await loadExecution(row.id));
  } catch {
    // The broker may have accepted the run. Keep the same durable ID and retry key.
    return { ...executionResult(row), ok: false, status: "enqueue_unknown", error: "Enqueue outcome is unknown. Retry this approval to reconcile the same execution; do not create a new action." };
  }
}
