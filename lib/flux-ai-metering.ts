import { NextResponse } from "next/server";
import { assertFluxCreditsAvailable, assertFluxFeatureAccess, reserveFluxCredits } from "@/lib/flux-credits";
import { calculateModeledProviderCostCents, type FluxCreditAction, type FluxFeatureKey } from "@/lib/fluxknight-plans";

type ProviderUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  [key: string]: unknown;
};

export const FLUX_AI_HUMAN_HANDOFF_MESSAGE =
  "Chargeable AI is paused. Your dashboard, data, billing and human operations remain available. New customer-facing AI messages should be handed to your team.";

export function isFluxAiControlError(error: unknown) {
  return error instanceof Error && (error.name === "FluxFeatureGateError" || error.name === "FluxCreditLimitError");
}

export function fluxAiControlResponse(error: unknown) {
  const featureLocked = error instanceof Error && error.name === "FluxFeatureGateError";
  const message = error instanceof Error ? error.message : FLUX_AI_HUMAN_HANDOFF_MESSAGE;
  return NextResponse.json(
    {
      error: message,
      customerMessage: featureLocked ? message : FLUX_AI_HUMAN_HANDOFF_MESSAGE,
      upgradeRequired: featureLocked,
      handoffRequired: !featureLocked,
      chargeableAiPaused: !featureLocked,
    },
    { status: 402 },
  );
}

export async function preflightChargeableFluxAi(input: {
  organizationId: string;
  feature: FluxFeatureKey;
  action: FluxCreditAction;
  quantity?: number;
}) {
  await assertFluxFeatureAccess(input.organizationId, input.feature);
  return assertFluxCreditsAvailable(input.organizationId, input.action, input.quantity || 1);
}

export async function recordChargeableFluxAiUsage(input: {
  organizationId: string;
  action: FluxCreditAction;
  quantity?: number;
  source: string;
  provider?: string;
  model?: string | null;
  providerCostCents?: number;
  providerUsage?: ProviderUsage;
  metadata?: Record<string, unknown>;
}) {
  const quantity = input.quantity || 1;
  const providerUsage = input.providerUsage || {};
  return reserveFluxCredits({
    organizationId: input.organizationId,
    action: input.action,
    quantity,
    source: input.source,
    provider: input.provider || undefined,
    providerCostCents: input.providerCostCents ?? calculateModeledProviderCostCents(input.action, quantity),
    providerUsage,
    metadata: {
      ...(input.metadata || {}),
      model: input.model || null,
      input_tokens: providerUsage.inputTokens || null,
      output_tokens: providerUsage.outputTokens || null,
      total_tokens: providerUsage.totalTokens || null,
    },
  });
}
