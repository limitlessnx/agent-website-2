import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { reserveFluxCreditCapacity, finishFluxCreditCapacity } from "@/lib/flux-credits";
import { calculateModeledProviderCostCents, type FluxCreditAction, type FluxFeatureKey } from "@/lib/fluxknight-plans";

type Description<T> = { accepted: boolean | "unknown"; provider?: string; model?: string | null; reference?: string | null; usage?: Record<string, unknown>; cache?: T };
type Input = { organizationId: string; feature: FluxFeatureKey; action: FluxCreditAction; source: string; operationId: string; request: unknown; quantity?: number; failure: "ai" | "delivery" };
export class FluxAiOperationError extends Error {
  readonly name = "FluxAiOperationError";
  readonly doNotRedispatch = true;
  readonly retrySafe = false;
  constructor(readonly billingStatus: string, readonly reservationId?: string, readonly providerCompleted = false, readonly providerMessageId?: string) {
    super("This operation has existing or uncertain billing evidence (" + billingStatus + "). Do not redispatch it; refresh its recorded result or request review.");
  }
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical((value as Record<string, unknown>)[k])).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

/** Reuses the existing wallet/hold/settlement system. No communications or provider retries occur here. */
export async function withFluxAiOperation<T>(input: Input, run: () => Promise<T>, describe: (result: T) => Description<T>): Promise<T> {
  if (!input.operationId.trim() || input.operationId.length > 512) throw new Error("A stable scoped billing operation identifier is required.");
  const key = "flux-op:" + input.source + ":" + digest(input.operationId);
  const fingerprint = digest(canonical({ organizationId: input.organizationId, source: input.source, action: input.action, quantity: input.quantity ?? 1, operationId: input.operationId, request: input.request }));
  const admin = createAdminClient();
  async function prior() {
    const result = await admin.from("flux_credit_reservations").select("id,status,request_fingerprint,metadata").eq("organization_id", input.organizationId).eq("idempotency_key", key).maybeSingle();
    if (result.error) throw new FluxAiOperationError("evidence_unavailable");
    return result.data;
  }
  function replay(row: NonNullable<Awaited<ReturnType<typeof prior>>>): T {
    if (row.request_fingerprint !== fingerprint) throw new FluxAiOperationError("input_conflict", row.id);
    if (row.status === "settled" && typeof row.metadata?.operation_cache_json === "string") {
      try { return JSON.parse(row.metadata.operation_cache_json) as T; } catch { /* Fail closed; never invoke a provider to recreate a lost result. */ }
    }
    throw new FluxAiOperationError(String(row.status), row.id, row.status === "settled");
  }
  const previous = await prior();
  if (previous) return replay(previous);
  let reservation;
  try {
    reservation = await reserveFluxCreditCapacity({ ...input, idempotencyKey: key, requestFingerprint: fingerprint });
  } catch (error) {
    const existing = await prior();
    if (existing) return replay(existing);
    throw error;
  }
  if (!reservation.created || reservation.status !== "held") {
    const existing = await prior();
    if (existing) return replay(existing);
    throw new FluxAiOperationError("evidence_unavailable", reservation.id);
  }
  let result: T;
  try { result = await run(); }
  catch (error) {
    const status = Number((error as { status?: unknown } | null)?.status || 0);
    const rejected = input.failure === "ai" || status >= 400 && status < 500;
    try { await finishFluxCreditCapacity({ organizationId: input.organizationId, reservationId: reservation.id, outcome: rejected ? "released" : "needs_attention", reason: rejected ? "provider_failed" : "provider_outcome_unknown" }); }
    catch { throw new FluxAiOperationError("reconciliation_unavailable", reservation.id); }
    if (!rejected) throw new FluxAiOperationError("needs_attention", reservation.id);
    throw error;
  }
  let description: Description<T>;
  try { description = describe(result); }
  catch { throw new FluxAiOperationError("completion_evidence_unavailable", reservation.id, true); }
  if (description.accepted !== true) {
    const outcome = description.accepted === false ? "released" : "needs_attention";
    try { await finishFluxCreditCapacity({ organizationId: input.organizationId, reservationId: reservation.id, outcome, reason: outcome === "released" ? "provider_rejected" : "provider_outcome_unknown" }); }
    catch { throw new FluxAiOperationError("reconciliation_unavailable", reservation.id); }
    if (outcome === "needs_attention") throw new FluxAiOperationError(outcome, reservation.id, false, description.reference || undefined);
    return result;
  }
  const completion = JSON.stringify({ version: 1, reservation_id: reservation.id, organization_id: input.organizationId, fingerprint, action: input.action, source: input.source, credits: reservation.reserved_credits, provider: description.provider || "unknown", model: description.model || null, reference: description.reference || null, usage: description.usage || {}, provider_cost_cents: calculateModeledProviderCostCents(input.action, input.quantity ?? 1), provider_completed: true });
  let cached: string | null = null;
  if (description.cache !== undefined) { try { const value = JSON.stringify(description.cache); if (value.length <= 65536) cached = value; } catch { /* Oversized/non-JSON results remain explicitly non-replayable. */ } }
  try {
    // Persist observed completion before settlement, so a lost response/crash retains reviewable evidence.
    const recorded = await finishFluxCreditCapacity({ organizationId: input.organizationId, reservationId: reservation.id, outcome: "needs_attention", reason: "provider_completed_accounting_pending", metadata: { operation_completion_json: completion, operation_completion_sha256: digest(completion), operation_cache_json: cached } });
    if (recorded.status === "released") throw new Error("Reservation was released during completion.");
    const finished = await finishFluxCreditCapacity({ organizationId: input.organizationId, reservationId: reservation.id, outcome: "settled", provider: description.provider, providerCostCents: calculateModeledProviderCostCents(input.action, input.quantity ?? 1), providerUsage: description.usage, metadata: { model: description.model || null, provider_response_id: description.reference || null } });
    if (finished.status !== "settled") throw new FluxAiOperationError(finished.status, reservation.id, true, description.reference || undefined);
  } catch (error) {
    if (error instanceof FluxAiOperationError) throw error;
    throw new FluxAiOperationError("reconciliation_unavailable", reservation.id, true, description.reference || undefined);
  }
  return result;
}
