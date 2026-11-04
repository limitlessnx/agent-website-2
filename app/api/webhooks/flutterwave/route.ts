import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { flutterwaveRequest, isValidFlutterwaveWebhook } from "@/lib/payments/flutterwave";
import { activatePaidTrialSubscription } from "@/lib/payments/activate-paid-trial";

export const dynamic = "force-dynamic";

type CheckoutSession = {
  id: string;
  tx_ref: string;
  plan_slug: string;
  billing_type: string;
  billing_region: "NG" | "INTERNATIONAL";
  currency: string;
  amount: number;
  organization_id: string | null;
};

type Subscription = {
  id: string;
  organization_id: string;
  plan_id: string;
  provider_subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  metadata: Record<string, unknown> | null;
};

type BillingPlan = {
  id: string;
  slug: string;
  currency: string;
  recurring_fee: number;
  metadata: Record<string, unknown> | null;
};

type VerificationResponse = {
  status: string;
  data?: {
    id: number;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
    created_at?: string;
    flw_ref?: string;
    customer?: { id?: number | string; email?: string };
  };
};

type WebhookEvent = {
  event?: string;
  "event.type"?: string;
  id?: string;
  data?: {
    id?: number;
    tx_ref?: string;
    status?: string;
    amount?: number;
    currency?: string;
    customer?: { email?: string; id?: number | string };
    plan?: { id?: number | string; amount?: number; currency?: string; date_created?: string };
    date_created?: string;
  };
};

const isoNow = () => new Date().toISOString();

async function updateWallet(subscriptionId: string) {
  await supabaseRest("rpc/sync_flux_credit_wallet_from_subscription", {
    method: "POST",
    body: JSON.stringify({ target_subscription_id: subscriptionId }),
  });
}

async function findRecurringSubscription(input: {
  email: string;
  amount: number;
  currency: string;
  planId?: string;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email || !Number.isFinite(input.amount) || input.amount <= 0) return null;

  const subscriptions = await supabaseRest<Subscription[]>(
    `organization_subscriptions?select=id,organization_id,plan_id,provider_subscription_id,status,current_period_end,metadata&provider=eq.flutterwave&status=in.(active,past_due,grace_period)&metadata->>provider_customer_email=ilike.${encodeURIComponent(email)}&limit=100`,
  );
  if (!subscriptions.length) return null;

  // charge.completed omits subscription and plan IDs. Resolve Flutterwave's
  // subscription list, then match the unique provider subscription ID we stored.
  const providerResult = await flutterwaveRequest<{
    status: string;
    data?: Array<{
      id: number | string;
      amount?: number;
      customer?: { customer_email?: string; email?: string };
      customer_email?: string;
      plan?: number | string | { id?: number | string };
    }>;
  }>(`/subscriptions?email=${encodeURIComponent(email)}`);
  const providerSubscriptions = (providerResult.data || []).filter((item) => {
    const providerEmail = String(item.customer?.customer_email || item.customer?.email || item.customer_email || "").trim().toLowerCase();
    const providerPlanId = typeof item.plan === "object" ? String(item.plan?.id || "") : String(item.plan || "");
    return providerEmail === email && Boolean(providerPlanId);
  });
  if (!providerSubscriptions.length) return null;

  const planIds = [...new Set(subscriptions.map((item) => item.plan_id))];
  const plans = await supabaseRest<BillingPlan[]>(
    `billing_plans?select=id,slug,currency,recurring_fee,metadata&id=in.(${planIds.map(encodeURIComponent).join(",")})`,
  );

  const matches = subscriptions.flatMap((subscription) => {
    if (!subscription.provider_subscription_id) return [];
    const providerSubscription = providerSubscriptions.find(
      (item) => String(item.id) === String(subscription.provider_subscription_id),
    );
    if (!providerSubscription) return [];
    const plan = plans.find((candidate) => candidate.id === subscription.plan_id);
    if (!plan) return [];
    const billingCurrency = String(subscription.metadata?.billing_currency || plan.currency).toUpperCase();
    const international = plan.metadata?.international as { recurring_fee?: number } | undefined;
    const configuredAmount = billingCurrency === "USD" ? Number(international?.recurring_fee) : Number(plan.recurring_fee);
    const providerPlanId = typeof providerSubscription.plan === "object"
      ? String(providerSubscription.plan?.id || "")
      : String(providerSubscription.plan || "");
    const storedPlanId = String(subscription.metadata?.flutterwave_payment_plan_id || "");
    const providerAmount = Number(providerSubscription.amount);
    if (
      billingCurrency !== input.currency.toUpperCase() ||
      configuredAmount !== Number(input.amount) ||
      !storedPlanId ||
      providerPlanId !== storedPlanId ||
      (Number.isFinite(providerAmount) && providerAmount > 0 && providerAmount !== configuredAmount)
    ) return [];
    return [{ subscription, plan }];
  });
  return matches.length === 1 ? matches[0] : null;
}

async function processCharge(event: WebhookEvent, eventType: string) {
  const data = event.data || {};
  if (!data.id || !data.tx_ref) throw new Error("Charge event is missing its transaction ID or reference.");

  const sessions = await supabaseRest<CheckoutSession[]>(
    `checkout_sessions?tx_ref=eq.${encodeURIComponent(data.tx_ref)}&limit=1`,
  );
  const session = sessions[0];
  const verification = await flutterwaveRequest<VerificationResponse>(
    `/transactions/${encodeURIComponent(String(data.id))}/verify`,
  );
  const payment = verification.data;
  if (!payment || payment.tx_ref !== data.tx_ref || payment.currency !== data.currency) {
    throw new Error("Verified charge does not match the signed webhook payload.");
  }

  if (session) {
    if (session.billing_type !== "subscription") return { ignored: true };
    if (payment.status !== "successful" || Number(payment.amount) < Number(session.amount)) {
      await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(session.tx_ref)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "verification_failed", provider_payload: verification }),
      });
      return { failed: true };
    }
    if (session.organization_id && session.billing_region && session.plan_slug) {
      await activatePaidTrialSubscription(
        {
          id: session.id,
          tx_ref: session.tx_ref,
          plan_slug: session.plan_slug,
          billing_region: session.billing_region,
          organization_id: session.organization_id,
        },
        payment,
      );
    }
    await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(session.tx_ref)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "successful",
        provider_transaction_id: String(payment.id || data.id),
        provider_reference: payment.flw_ref || null,
        provider_payload: verification,
        paid_at: payment.created_at || isoNow(),
      }),
    });
    return { checkout: true, activated: Boolean(session.organization_id) };
  }

  const email = payment.customer?.email || data.customer?.email || "";
  const match = await findRecurringSubscription({
    email,
    amount: Number(payment.amount),
    currency: payment.currency,
  });
  if (!match) throw new Error("Recurring charge could not be matched to exactly one subscription; no tenant access was changed.");

  const subscription = match.subscription;
  const now = new Date(payment.created_at || isoNow());
  if (payment.status === "successful") {
    const priorTransactionIds = Array.isArray(subscription.metadata?.processed_flutterwave_transaction_ids)
      ? subscription.metadata!.processed_flutterwave_transaction_ids as string[]
      : [];
    const transactionId = String(payment.id || data.id);
    if (priorTransactionIds.includes(transactionId)) return { duplicate: true };

    const currentEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : now;
    const periodStart = currentEnd > now ? currentEnd : now;
    const nextEnd = new Date(periodStart);
    const day = nextEnd.getUTCDate();
    nextEnd.setUTCDate(1);
    nextEnd.setUTCMonth(nextEnd.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(nextEnd.getUTCFullYear(), nextEnd.getUTCMonth() + 1, 0)).getUTCDate();
    nextEnd.setUTCDate(Math.min(day, lastDay));

    const updated = await supabaseRest<Subscription[]>(
      `organization_subscriptions?id=eq.${encodeURIComponent(subscription.id)}&status=in.(active,past_due,grace_period)`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "active",
          current_period_start: periodStart.toISOString(),
          current_period_end: nextEnd.toISOString(),
          grace_period_end: null,
          metadata: {
            ...(subscription.metadata || {}),
            provider_customer_email: email.toLowerCase(),
            provider_transaction_id: transactionId,
            provider_reference: payment.flw_ref || null,
            processed_flutterwave_transaction_ids: [...priorTransactionIds, transactionId].slice(-24),
            last_renewal_paid_at: now.toISOString(),
            last_renewal_status: "successful",
          },
          updated_at: isoNow(),
        }),
      },
    );
    if (!updated.length) throw new Error("Subscription changed while applying renewal; retry the webhook.");
    await updateWallet(subscription.id);
    return { renewed: true, subscriptionId: subscription.id };
  }

  if (payment.status === "failed" || eventType === "charge.failed") {
    const graceEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const updated = await supabaseRest<Subscription[]>(
      `organization_subscriptions?id=eq.${encodeURIComponent(subscription.id)}&status=in.(active,past_due,grace_period)`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "grace_period",
          grace_period_end: graceEnd.toISOString(),
          metadata: {
            ...(subscription.metadata || {}),
            last_renewal_failed_at: isoNow(),
            last_renewal_status: "failed",
            last_failed_transaction_id: String(payment.id || data.id),
          },
          updated_at: isoNow(),
        }),
      },
    );
    if (!updated.length) throw new Error("Subscription changed while applying failed renewal; retry the webhook.");
    await updateWallet(subscription.id);
    return { pastDue: true, subscriptionId: subscription.id };
  }

  return { ignored: true };
}

async function processCancellation(event: WebhookEvent) {
  const data = event.data || {};
  const email = data.customer?.email?.trim().toLowerCase() || "";
  const planId = data.plan?.id ? String(data.plan.id) : "";
  if (!email || !planId) throw new Error("Cancellation event is missing customer email or payment plan ID.");

  const providerResult = await flutterwaveRequest<{
    status: string;
    data?: Array<{
      id: number | string;
      customer?: { customer_email?: string; email?: string };
      plan?: number | string | { id?: number | string };
    }>;
  }>(`/subscriptions?email=${encodeURIComponent(email)}&plan=${encodeURIComponent(planId)}`);
  const providerMatches = (providerResult.data || []).filter((item) => {
    const providerEmail = String(item.customer?.customer_email || item.customer?.email || "").trim().toLowerCase();
    const providerPlanId = typeof item.plan === "object" ? String(item.plan?.id || "") : String(item.plan || "");
    return providerEmail === email && providerPlanId === planId;
  });
  if (providerMatches.length !== 1) {
    throw new Error("Flutterwave did not return exactly one matching subscription for cancellation.");
  }
  const providerSubscriptionId = String(providerMatches[0].id);
  const candidates = await supabaseRest<Subscription[]>(
    `organization_subscriptions?select=id,organization_id,plan_id,provider_subscription_id,status,current_period_end,metadata&provider=eq.flutterwave&provider_subscription_id=eq.${encodeURIComponent(providerSubscriptionId)}&status=in.(active,past_due,grace_period)&metadata->>provider_customer_email=ilike.${encodeURIComponent(email)}&metadata->>flutterwave_payment_plan_id=eq.${encodeURIComponent(planId)}&limit=10`,
  );
  if (candidates.length !== 1) {
    throw new Error("Cancellation could not be matched to exactly one stored provider subscription ID; no tenant access was changed.");
  }

  const subscription = candidates[0];
  const updated = await supabaseRest<Subscription[]>(
    `organization_subscriptions?id=eq.${encodeURIComponent(subscription.id)}&status=in.(active,past_due,grace_period)`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: "cancelled",
        grace_period_end: null,
        metadata: {
          ...(subscription.metadata || {}),
          cancelled_at: isoNow(),
          cancellation_source: "flutterwave",
        },
        updated_at: isoNow(),
      }),
    },
  );
  if (!updated.length) throw new Error("Subscription changed while applying cancellation; retry the webhook.");
  await updateWallet(subscription.id);
  return { cancelled: true, subscriptionId: subscription.id };
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!isValidFlutterwaveWebhook(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid Flutterwave signature." }, { status: 401 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const eventType = event.event || event["event.type"] || "";
  const data = event.data || {};
  if (!["charge.completed", "charge.failed", "subscription.cancelled"].includes(eventType)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  // Hash the full signed cancellation payload: Flutterwave's cancellation
  // sample does not expose a stable subscription ID in the webhook itself.
  // Exact webhook retries dedupe, while later re-subscriptions with changed
  // payloads do not collide merely because email and plan are the same.
  const externalId = eventType === "subscription.cancelled"
    ? `subscription.cancelled:${createHash("sha256").update(rawBody).digest("hex")}`
    : `${eventType}:${String(data.id || "")}`;
  if (externalId.endsWith(":") || !externalId) {
    return NextResponse.json({ error: "Webhook event is missing its idempotency fields." }, { status: 400 });
  }

  try {
    const inserted = await supabaseRest<Array<{ id: string; processed_at: string | null }>>(
      "payment_webhook_events?on_conflict=provider,external_event_id",
      {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({
          provider: "flutterwave",
          external_event_id: externalId,
          event_type: eventType,
          signature_valid: true,
          payload: event,
        }),
      },
    );

    let eventRow = inserted[0];
    if (!eventRow) {
      const existing = await supabaseRest<Array<{ id: string; processed_at: string | null; processing_error: string | null }>>(
        `payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalId)}&limit=1`,
      );
      eventRow = existing[0];
      if (!eventRow) throw new Error("Unable to persist webhook event.");
      if (eventRow.processed_at) return NextResponse.json({ received: true, duplicate: true });
    }

    const result = eventType === "subscription.cancelled"
      ? await processCancellation(event)
      : await processCharge(event, eventType);

    await supabaseRest(`payment_webhook_events?id=eq.${encodeURIComponent(eventRow.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ processed_at: isoNow(), processing_error: null }),
    });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook processing error";
    try {
      await supabaseRest(`payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalId)}`, {
        method: "PATCH",
        body: JSON.stringify({ processing_error: message }),
      });
    } catch (logError) {
      console.error("[payments/flutterwave-webhook-log]", logError);
    }
    console.error("[payments/flutterwave-webhook]", error);
    return NextResponse.json({ error: "Webhook processing failed; provider may retry." }, { status: 500 });
  }
}
