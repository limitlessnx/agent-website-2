import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { calculateFluxCredits, calculateModeledProviderCostCents, type FluxCreditAction, type FluxFeatureKey } from "@/lib/fluxknight-plans";
import { createAdminClient } from "@/lib/supabase/admin";

export type CommunicationWorkflow = "outbound_email_crm_v5" | "voice_receptionist_v6";
export const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const rec = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const finite = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const date = (value: unknown) => { const raw = text(value); const n = Date.parse(raw); return raw && Number.isFinite(n) ? new Date(n).toISOString() : null; };
export class CommunicationOutcomeError extends Error {
  constructor(readonly code: string, readonly status = 409) { super(code); }
}
export function normalizeCommunicationOutcome(workflow: CommunicationWorkflow, raw: unknown) {
  const body = rec(raw), input = { ...rec(body.input) }, decision = { ...rec(body.decision) }, usage = rec(body.provider_usage);
  for (const key of ["email", "recipient_email", "full_name", "caller_phone", "transcript", "latest_transcript", "call_id", "provider", "campaign_name"]) if (key in input) input[key] = text(input[key]) || null;
  for (const key of ["action", "subject", "message", "reason", "lead_stage", "call_status", "reply_text", "summary", "intent", "priority", "department", "sentiment", "crm_notes", "follow_up_reason", "handoff_reason", "reply_classification"]) if (key in decision) decision[key] = text(decision[key]) || null;
  if (input.customer && typeof input.customer === "object" && !Array.isArray(input.customer)) {
    const customer = { ...rec(input.customer) };
    for (const key of ["name", "full_name", "email", "phone"]) if (key in customer) customer[key] = text(customer[key]) || null;
    input.customer = customer;
  }
  for (const key of ["organization_id", "agent_id", "execution_id"]) if (!uuid.test(text(body[key]))) throw new CommunicationOutcomeError("invalid_outcome_identity", 400);
  for (const key of ["customer_id", "lead_id", "conversation_id"]) if (text(body[key]) && !uuid.test(text(body[key]))) throw new CommunicationOutcomeError("invalid_outcome_identity", 400);
  if (!text(body.customer_key) || text(body.customer_key).length > 512 || !text(body.idempotency_key) || text(body.idempotency_key).length > 512) throw new CommunicationOutcomeError("invalid_outcome_identity", 400);
  const next = { ...body, organization_id: text(body.organization_id).toLowerCase(), agent_id: text(body.agent_id).toLowerCase(), execution_id: text(body.execution_id).toLowerCase(), customer_key: text(body.customer_key), idempotency_key: text(body.idempotency_key),
    campaign_id: text(body.campaign_id) || null, provider: text(body.provider) || null, model: text(body.model) || null,
    input, provider_usage: usage, event_type: text(body.event_type) || (workflow === "voice_receptionist_v6" ? "voice.transcript_received" : ""),
    sequence_step: finite(body.sequence_step, 1) || 1,
    decision: { ...decision, next_send_at: date(decision.next_send_at), follow_up_at: date(decision.follow_up_at), qualification_score: Math.max(0, Math.min(100, finite(decision.qualification_score))), next_step: finite(decision.next_step) || (finite(body.sequence_step, 1) || 1) + 1 },
  };
  // No guessed measured duration: preserve the existing terminal-event minimum unit.
  const callStatus = text(decision.call_status).toLowerCase();
  const terminalCall = ["completed", "ended", "finished", "hangup", "hung_up"].includes(callStatus) || ["voice.call_ended", "voice.completed", "call.ended"].includes(next.event_type.toLowerCase());
  const durationSeconds = finite(usage.duration_seconds ?? usage.durationSeconds ?? input.duration_seconds ?? input.durationSeconds ?? body.duration_seconds ?? body.durationSeconds);
  const durationMinutes = finite(usage.duration_minutes ?? usage.durationMinutes ?? input.duration_minutes ?? input.durationMinutes ?? body.duration_minutes ?? body.durationMinutes);
  const billableMinutes = Math.max(1, durationSeconds > 0 ? Math.ceil(durationSeconds / 60) : durationMinutes > 0 ? Math.ceil(durationMinutes) : 1);
  const followUp = next.sequence_step > 1 || next.event_type.toLowerCase().includes("follow");
  const feature: FluxFeatureKey = workflow === "voice_receptionist_v6" ? "leo_voice" : followUp ? "email_follow_up" : "email_automation";
  const action: FluxCreditAction = workflow === "voice_receptionist_v6" ? "leo_voice_minute" : followUp ? "email_follow_up" : "ai_email";
  const quantity = workflow === "voice_receptionist_v6" ? billableMinutes : 1;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) throw new CommunicationOutcomeError("invalid_outcome_quantity", 400);
  return { body: next, feature, billing: { action, quantity, credits: workflow === "voice_receptionist_v6" && !terminalCall ? 0 : calculateFluxCredits(action, quantity), preflight_credits: calculateFluxCredits(action, workflow === "voice_receptionist_v6" && !terminalCall ? 1 : quantity), provider_cost_cents: calculateModeledProviderCostCents(action, quantity), terminal_call: terminalCall, duration_seconds: durationSeconds > 0 ? durationSeconds : null, duration_evidence: durationSeconds > 0 ? "reported_seconds" : durationMinutes > 0 ? "reported_minutes" : "legacy_minimum_unit" } };
}

/** Internal persistence only. It does not call providers, dispatch actions, or replay model requests. */
export async function persistCommunicationOutcome(workflow: CommunicationWorkflow, raw: unknown) {
  const normalized = normalizeCommunicationOutcome(workflow, raw);
  const admin = createAdminClient();
  const execution = await admin.from("runtime_executions").select("id").eq("id", normalized.body.execution_id).eq("organization_id", normalized.body.organization_id).eq("agent_id", normalized.body.agent_id).maybeSingle();
  if (execution.error) throw new CommunicationOutcomeError("outcome_evidence_unavailable");
  if (!execution.data) throw new CommunicationOutcomeError("outcome_scope_mismatch", 404);
  const organization = await admin.from("organizations").select("id").eq("id", normalized.body.organization_id).eq("status", "active").maybeSingle();
  if (organization.error) throw new CommunicationOutcomeError("outcome_evidence_unavailable");
  if (!organization.data) throw new CommunicationOutcomeError("outcome_scope_mismatch", 404);
  let wallet: Awaited<ReturnType<typeof assertFluxFeatureAccess>>;
  try { wallet = await assertFluxFeatureAccess(normalized.body.organization_id, normalized.feature); }
  catch (error) {
    if (error instanceof Error && ["FluxFeatureGateError", "FluxTrialFeatureGateError"].includes(error.name)) throw new CommunicationOutcomeError("outcome_feature_not_available", 403);
    throw new CommunicationOutcomeError("outcome_evidence_unavailable");
  }
  const { data, error } = await admin.rpc("persist_runtime_communication_outcome", {
    p_organization_id: normalized.body.organization_id, p_agent_id: normalized.body.agent_id, p_execution_id: normalized.body.execution_id,
    p_workflow: workflow, p_body: normalized.body, p_billing: { ...normalized.billing, plan_code: wallet.planCode },
  });
  if (error || !data) {
    const message = String(error?.message || "");
    const allowed = ["outcome_input_conflict", "legacy_outcome_requires_review", "outcome_evidence_unavailable", "outcome_scope_mismatch", "outcome_billing_changed", "outcome_wallet_unavailable"];
    throw new CommunicationOutcomeError(allowed.find(code => message.includes(code)) || "outcome_persistence_unavailable", message.includes("outcome_scope_mismatch") ? 404 : 409);
  }
  if (data.ok !== true || data.organization_id !== normalized.body.organization_id || data.agent_id !== normalized.body.agent_id || data.execution_id !== normalized.body.execution_id) throw new CommunicationOutcomeError("outcome_evidence_unavailable");
  return data as Record<string, unknown>;
}
