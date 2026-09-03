import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fluxknightPortalUrl, sendFluxknightLifecycleEvent } from "@/lib/resend-events";

function validSignature(raw: string, received: string | null, secret: string) {
  if (!received) return false;
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

function firstName(value: string, email: string) {
  return value.trim().split(/\s+/)[0] || email.split("@")[0] || "there";
}

function planLabel(value: string | null | undefined) {
  if (!value) return "Fluxknight plan";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function dateOrNull(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function subscriptionCode(data: any) {
  return text(data?.subscription?.subscription_code || data?.subscription_code);
}

function customerCode(data: any) {
  return text(data?.customer?.customer_code || data?.customer_code);
}

function organizationIdFromPayload(data: any) {
  return text(
    data?.metadata?.organization_id ||
      data?.customer?.metadata?.organization_id ||
      data?.subscription?.metadata?.organization_id,
  );
}

async function findLocalSubscription(admin: ReturnType<typeof createAdminClient>, data: any) {
  const code = subscriptionCode(data);
  const customer = customerCode(data);
  const organizationId = organizationIdFromPayload(data);

  if (code) {
    const { data: subscription, error } = await admin
      .from("organization_subscriptions")
      .select("id,organization_id,plan_id,status,current_period_start,current_period_end,grace_period_end,metadata,provider_customer_id,provider_subscription_id")
      .eq("provider", "paystack")
      .eq("provider_subscription_id", code)
      .maybeSingle();
    if (error) throw error;
    if (subscription) return subscription;
  }

  if (customer) {
    const { data: subscription, error } = await admin
      .from("organization_subscriptions")
      .select("id,organization_id,plan_id,status,current_period_start,current_period_end,grace_period_end,metadata,provider_customer_id,provider_subscription_id")
      .eq("provider", "paystack")
      .eq("provider_customer_id", customer)
      .in("status", ["pending", "trialing", "active", "past_due", "grace_period"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (subscription) return subscription;
  }

  if (organizationId) {
    const { data: subscription, error } = await admin
      .from("organization_subscriptions")
      .select("id,organization_id,plan_id,status,current_period_start,current_period_end,grace_period_end,metadata,provider_customer_id,provider_subscription_id")
      .eq("organization_id", organizationId)
      .in("status", ["pending", "trialing", "active", "past_due", "grace_period"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (subscription) return subscription;
  }

  return null;
}

async function subscriptionRecipient(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  fallbackEmail = "",
  fallbackName = "",
) {
  const { data: membership, error } = await admin
    .from("organization_memberships")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  let email = fallbackEmail.trim().toLowerCase();
  let fullName = fallbackName.trim();
  let userId: string | null = membership?.user_id || null;

  if (userId) {
    const userResult = await admin.auth.admin.getUserById(userId);
    const user = userResult.data?.user;
    email = text(user?.email || email).toLowerCase();
    fullName = text(user?.user_metadata?.full_name || fullName);
  }

  return { userId, email, firstName: email ? firstName(fullName, email) : "there" };
}

async function planContext(admin: ReturnType<typeof createAdminClient>, planId: string) {
  const { data, error } = await admin
    .from("billing_plans")
    .select("name,recurring_fee,currency,billing_interval")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  return {
    name: data?.name || "Fluxknight plan",
    amount: text(data?.recurring_fee || "0"),
    currency: text(data?.currency || "NGN"),
    interval: text(data?.billing_interval || "monthly"),
  };
}

async function processSubscriptionEvent(admin: ReturnType<typeof createAdminClient>, event: any) {
  const type = text(event?.event);
  if (![
    "subscription.create",
    "invoice.create",
    "invoice.payment_failed",
    "invoice.update",
    "subscription.not_renew",
    "subscription.disable",
  ].includes(type)) return;

  const data = event?.data || {};
  const subscription = await findLocalSubscription(admin, data);
  if (!subscription) {
    console.warn("Paystack subscription event has no local Fluxknight subscription", {
      event: type,
      subscriptionCode: subscriptionCode(data),
      customerCode: customerCode(data),
    });
    return;
  }

  const code = subscriptionCode(data) || subscription.provider_subscription_id;
  const customer = customerCode(data) || subscription.provider_customer_id;
  const fallbackEmail = text(data?.customer?.email);
  const fallbackName = text(data?.customer?.first_name || data?.customer?.name);
  const recipient = await subscriptionRecipient(admin, subscription.organization_id, fallbackEmail, fallbackName);
  const plan = await planContext(admin, subscription.plan_id);
  const portal = fluxknightPortalUrl();
  const nextPaymentDate = dateOrNull(data?.subscription?.next_payment_date || data?.next_payment_date);
  const periodStart = dateOrNull(data?.period_start || data?.paid_at || data?.created_at);
  const periodEnd = nextPaymentDate || dateOrNull(data?.period_end);
  const now = new Date().toISOString();

  if (type === "subscription.create") {
    const { error } = await admin
      .from("organization_subscriptions")
      .update({
        provider: "paystack",
        provider_customer_id: customer || null,
        provider_subscription_id: code || null,
        status: "active",
        current_period_start: periodStart || now,
        current_period_end: periodEnd,
        grace_period_end: null,
        metadata: {
          ...(subscription.metadata || {}),
          paystack_email_token: text(data?.email_token),
          paystack_status: text(data?.status),
          paystack_next_payment_date: nextPaymentDate,
        },
        updated_at: now,
      })
      .eq("id", subscription.id);
    if (error) throw error;
    return;
  }

  if (type === "invoice.create") {
    if (periodEnd) {
      const { error } = await admin
        .from("organization_subscriptions")
        .update({ current_period_end: periodEnd, updated_at: now })
        .eq("id", subscription.id);
      if (error) throw error;
    }
    return;
  }

  if (type === "invoice.payment_failed") {
    const gracePeriodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin
      .from("organization_subscriptions")
      .update({
        status: "grace_period",
        grace_period_end: gracePeriodEnd,
        metadata: {
          ...(subscription.metadata || {}),
          last_failed_invoice: text(data?.invoice_code),
          last_failed_at: now,
        },
        updated_at: now,
      })
      .eq("id", subscription.id);
    if (error) throw error;

    if (recipient.email) {
      await sendFluxknightLifecycleEvent({
        eventKey: `subscription-renewal-failed:${subscription.id}:${text(data?.invoice_code) || now.slice(0, 10)}`,
        event: "fluxknight.subscription.renewal_failed",
        email: recipient.email,
        userId: recipient.userId,
        organizationId: subscription.organization_id,
        payload: {
          first_name: recipient.firstName,
          plan_name: plan.name,
          amount: text(Number(data?.amount || 0) / 100 || plan.amount),
          currency: text(data?.currency || plan.currency),
          grace_period_end: new Date(gracePeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
          billing_url: portal,
        },
      });
    }
    return;
  }

  if (type === "invoice.update" && (data?.paid === true || text(data?.status).toLowerCase() === "success")) {
    const effectiveEnd = periodEnd || subscription.current_period_end;
    const { error } = await admin
      .from("organization_subscriptions")
      .update({
        status: "active",
        current_period_start: periodStart || now,
        current_period_end: effectiveEnd,
        grace_period_end: null,
        metadata: {
          ...(subscription.metadata || {}),
          last_paid_invoice: text(data?.invoice_code),
          last_renewed_at: now,
        },
        updated_at: now,
      })
      .eq("id", subscription.id);
    if (error) throw error;

    if (recipient.email) {
      await sendFluxknightLifecycleEvent({
        eventKey: `subscription-renewal-succeeded:${subscription.id}:${text(data?.invoice_code) || now.slice(0, 10)}`,
        event: "fluxknight.subscription.renewal_succeeded",
        email: recipient.email,
        userId: recipient.userId,
        organizationId: subscription.organization_id,
        payload: {
          first_name: recipient.firstName,
          plan_name: plan.name,
          amount: text(Number(data?.amount || 0) / 100 || plan.amount),
          currency: text(data?.currency || plan.currency),
          period_end: effectiveEnd ? new Date(effectiveEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "the next billing date",
          billing_url: portal,
        },
      });
    }
    return;
  }

  if (type === "subscription.not_renew") {
    const accessUntil = periodEnd || subscription.current_period_end;
    const { error } = await admin
      .from("organization_subscriptions")
      .update({
        metadata: { ...(subscription.metadata || {}), cancel_at_period_end: true, cancellation_scheduled_at: now },
        updated_at: now,
      })
      .eq("id", subscription.id);
    if (error) throw error;

    if (recipient.email) {
      await sendFluxknightLifecycleEvent({
        eventKey: `subscription-cancellation-scheduled:${subscription.id}:${accessUntil || now.slice(0, 10)}`,
        event: "fluxknight.subscription.cancellation_scheduled",
        email: recipient.email,
        userId: recipient.userId,
        organizationId: subscription.organization_id,
        payload: {
          first_name: recipient.firstName,
          plan_name: plan.name,
          access_until: accessUntil ? new Date(accessUntil).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "the end of your current billing period",
          billing_url: portal,
        },
      });
    }
    return;
  }

  if (type === "subscription.disable") {
    const { error } = await admin
      .from("organization_subscriptions")
      .update({
        status: "cancelled",
        grace_period_end: null,
        metadata: {
          ...(subscription.metadata || {}),
          cancel_at_period_end: false,
          cancelled_at: now,
          paystack_status: text(data?.status),
        },
        updated_at: now,
      })
      .eq("id", subscription.id);
    if (error) throw error;

    if (recipient.email) {
      await sendFluxknightLifecycleEvent({
        eventKey: `subscription-cancelled:${subscription.id}:${now.slice(0, 10)}`,
        event: "fluxknight.subscription.cancelled",
        email: recipient.email,
        userId: recipient.userId,
        organizationId: subscription.organization_id,
        payload: {
          first_name: recipient.firstName,
          plan_name: plan.name,
          reactivate_url: portal,
        },
      });
    }
  }
}

export async function POST(request: Request) {
  try {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });

    const raw = await request.text();
    if (!validSignature(raw, request.headers.get("x-paystack-signature"), secret)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }

    const event = JSON.parse(raw);
    const reference = event?.data?.reference as string | undefined;
    const eventId = String(event?.data?.id || event?.data?.invoice_code || event?.data?.subscription_code || `${event.event}:${reference || "unknown"}`);
    const admin = createAdminClient();

    const { error: eventError } = await admin.from("payment_webhook_events").upsert({ provider: "paystack", external_event_id: eventId, event_type: String(event.event || "unknown"), signature_valid: true, payload: event }, { onConflict: "provider,external_event_id", ignoreDuplicates: true });
    if (eventError) throw eventError;

    if (event.event === "charge.success" && reference) {
      const { data: payment, error } = await admin
        .from("payment_attempts")
        .update({ status: "paid", paid_at: new Date().toISOString(), provider_payload: event.data, updated_at: new Date().toISOString() })
        .eq("provider", "paystack")
        .eq("provider_reference", reference)
        .neq("status", "paid")
        .select("id,organization_id,quote_id,amount,currency,created_by")
        .maybeSingle();
      if (error) throw error;

      if (payment) {
        await admin.from("organization_quotes").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", payment.quote_id).eq("organization_id", payment.organization_id);
        const { data: selections, error: selectionError } = await admin
          .from("organization_agent_selections")
          .update({ status: "paid", updated_at: new Date().toISOString() })
          .eq("organization_id", payment.organization_id)
          .in("status", ["selected", "configured", "quoted", "payment_pending"])
          .select("id");
        if (selectionError) throw selectionError;

        const jobs = [
          { organization_id: payment.organization_id, payment_attempt_id: payment.id, job_type: "activate_subscription", payload: { quote_id: payment.quote_id } },
          { organization_id: payment.organization_id, payment_attempt_id: payment.id, job_type: "create_crm_defaults", payload: {} },
          { organization_id: payment.organization_id, payment_attempt_id: payment.id, job_type: "create_channel_placeholders", payload: {} },
          ...(selections || []).map((selection) => ({ organization_id: payment.organization_id, payment_attempt_id: payment.id, agent_selection_id: selection.id, job_type: "provision_agent", payload: {} })),
        ];
        const { error: jobError } = await admin.from("provisioning_jobs").insert(jobs);
        if (jobError) throw jobError;

        const [{ data: quote }, { data: organization }, userResult] = await Promise.all([
          admin.from("organization_quotes").select("quote_type,metadata").eq("id", payment.quote_id).maybeSingle(),
          admin.from("organizations").select("name").eq("id", payment.organization_id).maybeSingle(),
          payment.created_by ? admin.auth.admin.getUserById(payment.created_by) : Promise.resolve({ data: { user: null }, error: null }),
        ]);

        const user = userResult.data?.user;
        const customerEmail = String(user?.email || event?.data?.customer?.email || "").trim().toLowerCase();
        if (customerEmail) {
          const metadata = user?.user_metadata || {};
          const fullName = String(metadata.full_name || event?.data?.customer?.first_name || "").trim();
          const quoteMetadata = (quote?.metadata || {}) as Record<string, unknown>;
          const explicitPlan = String(quoteMetadata.plan_name || quoteMetadata.plan || "").trim();

          await sendFluxknightLifecycleEvent({
            eventKey: `payment-success:${payment.id}`,
            event: "fluxknight.payment.succeeded",
            email: customerEmail,
            userId: payment.created_by || null,
            organizationId: payment.organization_id,
            paymentAttemptId: payment.id,
            payload: {
              first_name: firstName(fullName, customerEmail),
              plan_name: explicitPlan || planLabel(quote?.quote_type),
              amount: String(payment.amount),
              currency: String(payment.currency || ""),
              dashboard_url: fluxknightPortalUrl(),
              workspace_name: organization?.name || "your Fluxknight workspace",
            },
          });
        }
      }
    }

    await processSubscriptionEvent(admin, event);

    await admin.from("payment_webhook_events").update({ processed_at: new Date().toISOString() }).eq("provider", "paystack").eq("external_event_id", eventId);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
