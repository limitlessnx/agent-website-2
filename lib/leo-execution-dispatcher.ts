import type { LeoExecutionEnvelope } from "@/lib/leo-execution-envelope";
import { executeLeoEnvelopeViaN8n, type LeoN8nExecutionResult } from "@/lib/leo-n8n-executor";

/**
 * Provider-neutral result consumed by the Leo tool gateway.
 * Keep this shape stable while concrete execution providers are migrated.
 */
export type LeoDispatchResult = {
  ok: boolean;
  requestId: string;
  toolKey: string;
  status: string;
  executionId?: string | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  workflow?: string | null;
};

export interface LeoExecutionProvider {
  readonly id: string;
  dispatch(envelope: LeoExecutionEnvelope): Promise<LeoDispatchResult>;
}

/**
 * Temporary compatibility adapter. This intentionally preserves the existing
 * signed-envelope n8n protocol; it does not imply the migration is complete.
 */
export const legacyN8nLeoProvider: LeoExecutionProvider = {
  id: "legacy_n8n",
  async dispatch(envelope) {
    const result: LeoN8nExecutionResult = await executeLeoEnvelopeViaN8n(envelope);
    return result;
  },
};

/**
 * Single provider-neutral boundary for the privileged Leo tool route.
 * Provider selection remains explicit at the call site until a Trigger.dev
 * adapter has a tested action contract and equivalent audit/idempotency rules.
 */
export async function dispatchLeoExecution(
  envelope: LeoExecutionEnvelope,
  provider: LeoExecutionProvider = legacyN8nLeoProvider,
): Promise<LeoDispatchResult> {
  if (!provider || typeof provider.dispatch !== "function" || !provider.id.trim()) {
    throw new Error("A valid Leo execution provider is required.");
  }
  if (!envelope.requestId?.trim() || !envelope.toolKey?.trim()) {
    throw new Error("Leo dispatch requires a request ID and canonical tool key.");
  }
  return provider.dispatch(envelope);
}
