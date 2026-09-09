import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateFluxCredits,
  calculateUsagePercent,
  getFluxPlanDefinition,
  getRequiredPlanForFeature,
  getThresholdLevel,
  planIncludesFeature,
  type FluxCreditAction,
  type FluxFeatureKey,
  type FluxPlanCode,
} from "@/lib/fluxknight-plans";

export const BASIC_FREE_TRIAL_DAYS = 14;
export const BASIC_FREE_TRIAL_CREDITS = 250;
const BASIC_FREE_TRIAL_ACTIONS = new Set<FluxCreditAction>(["web_ai", "whatsapp_ai"]);

export type FluxWalletSummary = {
  organizationId: string;
  planCode: FluxPlanCode;
  planName: string;
  monthlyCredits: number;
  balance: number;
  used: number;
  percentUsed: number;
  renewalDate: string | null;
  trialEndsAt: string | null;
  trialCreditLimit: number | null;
  threshold: 70 | 90 | 100 | null;
  chargeableAiPaused: boolean;
  canTopUp: boolean;
  canRollover: boolean;
  customerMessage: string | null;
};

export type FluxInternalUsageSummary = FluxWalletSummary & {
  bonusCredits: number;
  topUpCredits: number;
  providerCostCents: number;
  customerValueCents: number;
  grossMarginCents: number;
  usageByAction: Record<string, number>;
  providerCostBySource: Record<string, number>;
};

type SubscriptionRow = {
  id: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at?: string | null;
  metadata: Record<string, unknown> | null;
  billing_plans?: { slug: string | null; name: string | null; metadata: Record<string, unknown> | null } | null;
};

type WalletRow = {
  organization_id: string;
  plan_code: string;
  monthly_allowance: number;
  balance: number;
  bonus_balance: number;
  top_up_balance: number;
  trial_credit_limit: number | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  status: string;
};

type LedgerRow = {
  action_key: string;
  credit_delta: number;
  provider_cost_cents: number | null;
  customer_value_cents: number | null;
  source: string | null;
};

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function planFromSubscription(subscription: SubscriptionRow | null | undefined) {
  const metadataPlan = String(subscription?.metadata?.plan_code || subscription?.billing_plans?.metadata?.plan_code || "");
  const slug = subscription?.billing_plans?.slug || subscription?.billing_plans?.name || metadataPlan;
  return getFluxPlanDefinition(metadataPlan || slug);
}

function requireWalletRow(value: unknown): WalletRow {
  const wallet = Array.isArray(value) ? value[0] : value;
  if (!wallet || typeof wallet !== "object") throw new Error("Flux credit wallet was not returned.");
  return wallet as WalletRow;
}

function isFreeTrialWallet(wallet: Pick<WalletRow, "trial_ends_at" | "trial_credit_limit">) {
  return Boolean(wallet.trial_ends_at || wallet.trial_credit_limit !== null);
}

export async function getActiveFluxSubscription(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_subscriptions")
    .select("id,status,current_period_end,trial_ends_at,metadata,billing_plans(slug,name,metadata)")
    .eq("organization_id", organizationId)
    .in("status", ["trialing", "active", "past_due", "grace_period"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>();
  if (error) throw error;
  return data;
}

export async function ensureFluxWallet(organizationId: string): Promise<WalletRow> {
  const admin = createAdminClient();
  const subscription = await getActiveFluxSubscription(organizationId);
  const plan = planFromSubscription(subscription);
  const configuredMonthlyCredits = numberValue(subscription?.metadata?.monthly_credits, plan.monthlyCredits);
  const monthlyCredits = plan.configurableMonthlyCredits ? Math.max(25000, configuredMonthlyCredits) : plan.monthlyCredits;
  const isTrial = subscription?.status === "trialing";
  const configuredTrialLimit = numberValue(subscription?.metadata?.trial_credit_limit, BASIC_FREE_TRIAL_CREDITS);
  const trialCreditLimit = isTrial ? Math.min(BASIC_FREE_TRIAL_CREDITS, Math.max(0, configuredTrialLimit)) : null;

  const { data, error } = await admin.rpc("ensure_flux_credit_wallet", {
    target_organization_id: organizationId,
    target_plan_code: plan.code,
    target_monthly_allowance: isTrial ? trialCreditLimit : monthlyCredits,
    target_trial_credit_limit: trialCreditLimit,
    target_trial_ends_at: isTrial ? subscription?.trial_ends_at || null : null,
    target_current_period_end: subscription?.current_period_end || null,
  });
  if (error) throw error;
  return requireWalletRow(data);
}

function toWalletSummary(wallet: WalletRow): FluxWalletSummary {
  const plan = getFluxPlanDefinition(wallet.plan_code);
  const balance = Math.max(0, numberValue(wallet.balance));
  const allowance = numberValue(wallet.monthly_allowance, plan.monthlyCredits);
  const percentUsed = calculateUsagePercent(balance, allowance);
  const threshold = getThresholdLevel(percentUsed);
  const trialExpired = wallet.trial_ends_at ? new Date(wallet.trial_ends_at).getTime() <= Date.now() : false;
  const trial = isFreeTrialWallet(wallet);
  const chargeableAiPaused = wallet.status === "paused" || percentUsed >= 100 || trialExpired;
  return {
    organizationId: wallet.organization_id,
    planCode: plan.code,
    planName: plan.name,
    monthlyCredits: allowance,
    balance,
    used: Math.max(0, allowance - balance),
    percentUsed,
    renewalDate: wallet.current_period_end,
    trialEndsAt: wallet.trial_ends_at,
    trialCreditLimit: wallet.trial_credit_limit,
    threshold,
    chargeableAiPaused,
    canTopUp: !trial,
    canRollover: !trial,
    customerMessage: chargeableAiPaused
      ? trial
        ? "Your free trial has ended or its Flux Credits are exhausted. Customer-facing AI is paused until you upgrade. Your workspace and data remain available."
        : "Chargeable AI is paused. Your dashboard, data, billing and human operations remain available. New customer-facing AI messages should be handed to your team."
      : threshold === 90
        ? trial
          ? "Your free-trial credits are nearly exhausted. Upgrade to keep customer-facing AI active."
          : "Credits are nearly used. Add credits or upgrade before chargeable AI pauses."
        : threshold === 70
          ? trial
            ? "You have used most of your free-trial credits."
            : "Credits are being used faster than usual this cycle."
          : null,
  };
}

export async function getFluxWalletSummary(organizationId: string): Promise<FluxWalletSummary> {
  return toWalletSummary(await ensureFluxWallet(organizationId));
}

export async function getFluxInternalUsageSummary(organizationId: string): Promise<FluxInternalUsageSummary> {
  const admin = createAdminClient();
  const wallet = await ensureFluxWallet(organizationId);
  const { data, error } = await admin
    .from("flux_credit_ledger")
    .select("action_key,credit_delta,provider_cost_cents,customer_value_cents,source")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(5000)
    .returns<LedgerRow[]>();
  if (error) throw error;

  const usageByAction: Record<string, number> = {};
  const providerCostBySource: Record<string, number> = {};
  let providerCostCents = 0;
  let customerValueCents = 0;

  for (const row of data || []) {
    if (row.credit_delta < 0) usageByAction[row.action_key] = (usageByAction[row.action_key] || 0) + Math.abs(row.credit_delta);
    providerCostCents += numberValue(row.provider_cost_cents);
    customerValueCents += numberValue(row.customer_value_cents);
    const source = row.source || "internal";
    providerCostBySource[source] = (providerCostBySource[source] || 0) + numberValue(row.provider_cost_cents);
  }

  return {
    ...toWalletSummary(wallet),
    bonusCredits: numberValue(wallet.bonus_balance),
    topUpCredits: numberValue(wallet.top_up_balance),
    providerCostCents,
    customerValueCents,
    grossMarginCents: customerValueCents - providerCostCents,
    usageByAction,
    providerCostBySource,
  };
}

export async function assertFluxFeatureAccess(organizationId: string, feature: FluxFeatureKey) {
  const wallet = await ensureFluxWallet(organizationId);
  if (isFreeTrialWallet(wallet) && feature !== "core_ai_support") {
    const error = new Error("This feature is not included in the Basic free trial. Upgrade to unlock it.");
    error.name = "FluxTrialFeatureGateError";
    throw error;
  }
  if (!planIncludesFeature(wallet.plan_code, feature)) {
    const requiredPlan = getRequiredPlanForFeature(feature);
    const error = new Error(`${requiredPlan.name} is required for this feature.`);
    error.name = "FluxFeatureGateError";
    throw error;
  }
  return toWalletSummary(wallet);
}

export async function assertFluxCreditsAvailable(organizationId: string, action: FluxCreditAction, quantity = 1) {
  const credits = calculateFluxCredits(action, quantity);
  const wallet = await ensureFluxWallet(organizationId);
  const summary = toWalletSummary(wallet);
  if (isFreeTrialWallet(wallet) && !BASIC_FREE_TRIAL_ACTIONS.has(action)) {
    const error = new Error("The Basic free trial includes Web AI and WhatsApp AI only. Upgrade to use this action.");
    error.name = "FluxTrialFeatureGateError";
    throw error;
  }
  if (summary.chargeableAiPaused || summary.balance < credits) {
    const error = new Error(summary.trialEndsAt
      ? "Your free trial has ended or its Flux Credits are exhausted. Upgrade to resume customer-facing AI."
      : "Flux Credits exhausted. Chargeable AI must hand off to a human operator.");
    error.name = "FluxCreditLimitError";
    throw error;
  }
  return { credits, wallet: summary };
}

export async function reserveFluxCredits(input: {
  organizationId: string;
  action: FluxCreditAction;
  quantity?: number;
  source?: string;
  provider?: string;
  providerCostCents?: number;
  providerUsage?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const { credits } = await assertFluxCreditsAvailable(input.organizationId, input.action, input.quantity || 1);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_flux_credit_usage", {
    target_organization_id: input.organizationId,
    target_action_key: input.action,
    target_credit_amount: credits,
    target_source: input.source || "app",
    target_provider: input.provider || null,
    target_provider_cost_cents: input.providerCostCents || 0,
    target_provider_usage: input.providerUsage || {},
    target_metadata: input.metadata || {},
  });
  if (error) throw error;
  return { credits, wallet: toWalletSummary(requireWalletRow(data)) };
}

export async function adjustFluxCredits(input: {
  organizationId: string;
  amount: number;
  reason: string;
  adminEmail: string;
  type?: "bonus" | "top_up" | "adjustment";
}) {
  const amount = Math.trunc(input.amount);
  if (!amount) throw new Error("Credit adjustment amount must be non-zero.");
  if (input.type === "top_up") {
    const wallet = await getFluxWalletSummary(input.organizationId);
    if (!wallet.canTopUp) throw new Error("Top-ups are not available during the Basic free trial.");
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("adjust_flux_credit_wallet", {
    target_organization_id: input.organizationId,
    target_credit_amount: amount,
    target_adjustment_type: input.type || "adjustment",
    target_reason: input.reason,
    target_admin_email: input.adminEmail,
  });
  if (error) throw error;
  return toWalletSummary(requireWalletRow(data));
}
