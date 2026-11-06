import type { LeoExecutionEnvelope } from "@/lib/leo-execution-envelope";
import { executeLeoEnvelopeViaN8n, type LeoN8nExecutionResult } from "@/lib/leo-n8n-executor";
import { crmTriggerEnabled, CRM_FOLLOWUP_TOOL } from "./contract";
import { dispatchCrmFollowup } from "./providers/trigger-crm";

export type LeoDispatchResult = LeoN8nExecutionResult;
export interface LeoExecutionProvider { readonly id: string; dispatch(envelope: LeoExecutionEnvelope): Promise<LeoDispatchResult>; }
export const legacyN8nLeoProvider: LeoExecutionProvider = { id: "legacy_n8n", dispatch: executeLeoEnvelopeViaN8n };
const crmProvider: LeoExecutionProvider = { id: "trigger_dev", dispatch: dispatchCrmFollowup };
export async function dispatchLeoExecution(envelope: LeoExecutionEnvelope, provider?: LeoExecutionProvider): Promise<LeoDispatchResult> {
  if (!envelope.requestId?.trim() || !envelope.toolKey?.trim()) throw new Error("Leo dispatch requires request ID and canonical tool key.");
  // Real-estate proof and domain-specific operations stay on their current adapter.
  const selected = provider || (crmTriggerEnabled() && envelope.toolKey === CRM_FOLLOWUP_TOOL && !envelope.arguments._real_estate_approval ? crmProvider : legacyN8nLeoProvider);
  if (!selected.id?.trim() || typeof selected.dispatch !== "function") throw new Error("A valid Leo execution provider is required.");
  return selected.dispatch(envelope);
}
