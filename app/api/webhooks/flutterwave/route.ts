import { createHash, randomUUID } from "node:crypto";
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
  customer_email: string;
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

async function processCharge(event: WebhookEvent, eventId: string, claimToken: string) {
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
  if (!payment || String(payment.id) !== String(data.id) || payment.tx_ref !== data.tx_ref || payment.currency !== data.currency) {
    throw new Error("Verified charge does not match the signed webhook payload.");
  }

  if (session) {
    if (!["subscription", "top_up"].includes(session.billing_type)) return { ignored: true };
    if (!payment.customer?.email || payment.customer.email.trim().toLowerCase() !== session.customer_email.trim().toLowerCase()) {
      throw new Error("Verified payment customer does not match the stored checkout.");
    }
    if (payment.currency !== session.currency) {
      throw new Error("Verified payment currency does not match the stored checkout.");
    }
    if (payment.status !== "successful" || Number(payment.amount) < Number(session.amount)) {
      await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(session.tx_ref)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "verification_failed", provider_payload: verification }),
      });
      return { failed: true };
    }
    if (session.billing_type === "subscription" && session.organization_id && session.billing_region && session.plan_slug) {
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
    if (session.billing_type === "top_up") {
      await supabaseRest("rpc/apply_flux_credit_topup_from_checkout", {
        method: "POST", body: JSON.stringify({ target_checkout_session_id: session.id }),
      });
    }
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
  // The database locks the subscription, records the transaction permanently,
  // and syncs the wallet in the same transaction. A lost HTTP response is safe.
  return supabaseRest("rpc/apply_flutterwave_renewal", {
    method: "POST",
    body: JSON.stringify({
      target_subscription_id: subscription.id,
      expected_provider_subscription_id: subscription.provider_subscription_id,
      target_event_id: eventId,
      claim_token: claimToken,
      transaction_id: String(payment.id),
      payment_status: payment.status,
      paid_at: payment.created_at || null,
      payment_amount: Number(payment.amount),
      payment_currency: payment.currency,
      customer_email: email.trim().toLowerCase(),
      provider_reference: payment.flw_ref || null,
    }),
  });

}

async function processCancellation(event: WebhookEvent, eventId: string, claimToken: string) {
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
    `organization_subscriptions?select=id,organization_id,plan_id,provider_subscription_id,status,current_period_end,metadata&provider=eq.flutterwave&provider_subscription_id=eq.${encodeURIComponent(providerSubscriptionId)}&status=in.(active,past_due,grace_period,cancelled)&metadata->>provider_customer_email=ilike.${encodeURIComponent(email)}&metadata->>flutterwave_payment_plan_id=eq.${encodeURIComponent(planId)}&limit=10`,
  );
  if (candidates.length !== 1) {
    throw new Error("Cancellation could not be matched to exactly one stored provider subscription ID; no tenant access was changed.");
  }

  const subscription = candidates[0];
  return supabaseRest("rpc/cancel_flutterwave_subscription", {
    method: "POST",
    body: JSON.stringify({ target_subscription_id: subscription.id, expected_provider_subscription_id: providerSubscriptionId, target_event_id: eventId, claim_token: claimToken }),
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!isValidFlutterwaveWebhook(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid Flutterwave signature." }, { status: 401 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody) as WebhookEvent;
    if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("Invalid event");
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

  const claimToken = randomUUID();
  let eventId: string | undefined;
  try {
    const claim = await supabaseRest<{ id: string; state: "claimed" | "busy" | "processed" }>(
      "rpc/claim_flutterwave_webhook",
      { method: "POST", body: JSON.stringify({ external_id: externalId, event_type: eventType, event_payload: event, claim_token: claimToken }) },
    );
    if (claim.state === "processed") return NextResponse.json({ received: true, duplicate: true });
    if (claim.state !== "claimed") {
      return NextResponse.json({ received: false, retry: true }, { status: 503, headers: { "Retry-After": "10" } });
    }
    eventId = claim.id;

    const result = eventType === "subscription.cancelled"
      ? await processCancellation(event, eventId, claimToken)
      : await processCharge(event, eventId, claimToken);

    const completed = await supabaseRest<Array<{ id: string }>>(`payment_webhook_events?id=eq.${encodeURIComponent(eventId)}&processing_token=eq.${claimToken}&processed_at=is.null`, {
      method: "PATCH",
      body: JSON.stringify({ processed_at: isoNow(), processing_error: null, processing_token: null, processing_started_at: null }),
    });
    if (completed.length !== 1) throw new Error("Webhook lease was reclaimed; retry the event.");
    return NextResponse.json({ received: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook processing error";
    try {
      if (eventId) await supabaseRest(`payment_webhook_events?id=eq.${encodeURIComponent(eventId)}&processing_token=eq.${claimToken}&processed_at=is.null`, {
        method: "PATCH",
        body: JSON.stringify({ processing_error: message, processing_token: null, processing_started_at: null }),
      });
    } catch (logError) {
      console.error("[payments/flutterwave-webhook-log]", logError);
    }
    console.error("[payments/flutterwave-webhook]", error);
    return NextResponse.json({ error: "Webhook processing failed; provider may retry." }, { status: 500 });
  }
}
