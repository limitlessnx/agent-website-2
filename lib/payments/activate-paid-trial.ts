import { supabaseRest } from "@/lib/supabase-server-rest";
import { getPublicPlan } from "@/lib/payments/catalog";
import type { BillingRegion } from "@/lib/payments/region";

type PaidCheckoutSession = {
  id: string;
  plan_slug: string;
  billing_region: BillingRegion;
  organization_id: string | null;
  tx_ref: string;
};

type VerifiedPayment = {
  id?: number;
  tx_ref: string;
  status: string;
  amount: number;
  currency: string;
  flw_ref?: string;
  customer?: { id?: number | string };
};

type CurrentSubscription = {
  id: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  metadata: Record<string, unknown> | null;
};

function addOneMonth(from: Date) {
  const next = new Date(from);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

/**
 * Converts an existing Basic free-trial subscription into its paid monthly plan.
 * The existing organization and all tenant data remain untouched.
 * Safe to retry: a checkout reference is stored on the subscription as the idempotency key.
 */
export async function activatePaidTrialSubscription(
  session: PaidCheckoutSession,
  payment: VerifiedPayment,
) {
  if (!session.organization_id) return { upgraded: false, reason: "no_existing_organization" };
  if (payment.status !== "successful" || payment.tx_ref !== session.tx_ref) {
    throw new Error("Payment is not verified for this checkout session.");
  }

  const plan = await getPublicPlan(session.plan_slug, session.billing_region);
  if (!plan || plan.custom) throw new Error("The paid billing plan could not be resolved.");

  const rows = await supabaseRest<CurrentSubscription[]>(
    `organization_subscriptions?select=id,plan_id,status,trial_ends_at,metadata&organization_id=eq.${encodeURIComponent(session.organization_id)}&status=in.(trialing,active,pending)&order=updated_at.desc&limit=1`,
  );
  const current = rows[0];
  if (!current) throw new Error("The existing organization has no current trial subscription to upgrade.");

  const metadata = current.metadata || {};
  if (metadata.paid_checkout_session_id === session.id) {
    return { upgraded: true, alreadyApplied: true, subscriptionId: current.id };
  }
  if (current.status !== "trialing" || metadata.trial_type !== "basic_free_trial") {
    throw new Error("The existing subscription is not an eligible Basic free trial. No organization changes were made.");
  }

  const now = new Date();
  const periodEnd = addOneMonth(now);
  const updated = await supabaseRest<CurrentSubscription[]>(
    `organization_subscriptions?id=eq.${encodeURIComponent(current.id)}&status=eq.trialing`,
    {
      method: "PATCH",
      body: JSON.stringify({
        plan_id: plan.id,
        provider: "flutterwave",
        provider_customer_id: payment.customer?.id ? String(payment.customer.id) : null,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        trial_ends_at: null,
        grace_period_end: null,
        metadata: {
          ...metadata,
          plan_code: plan.metadata.plan_code,
          monthly_credits: plan.metadata.monthly_credits,
          free_trial: false,
          trial_converted: true,
          paid_checkout_session_id: session.id,
          paid_tx_ref: session.tx_ref,
          provider_transaction_id: payment.id ? String(payment.id) : null,
          provider_reference: payment.flw_ref || null,
          billing_interval: "monthly",
          billing_currency: payment.currency,
          paid_at: now.toISOString(),
        },
        updated_at: now.toISOString(),
      }),
    },
  );

  if (!updated.length) {
    const latest = await supabaseRest<CurrentSubscription[]>(
      `organization_subscriptions?select=id,status,metadata&organization_id=eq.${encodeURIComponent(session.organization_id)}&limit=1`,
    );
    if (latest[0]?.metadata?.paid_checkout_session_id === session.id) {
      return { upgraded: true, alreadyApplied: true, subscriptionId: latest[0].id };
    }
    throw new Error("Trial subscription changed during payment activation. Retry the verified payment event.");
  }

  await supabaseRest("rpc/sync_flux_credit_wallet_from_subscription", {
    method: "POST",
    body: JSON.stringify({ target_subscription_id: current.id }),
  });

  return { upgraded: true, alreadyApplied: false, subscriptionId: current.id };
}
