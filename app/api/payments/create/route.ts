import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { getPublicPlan } from "@/lib/payments/catalog";
import { currencyForRegion, resolveBillingRegionFromHeaders, type BillingRegion } from "@/lib/payments/region";
import { flutterwaveRequest } from "@/lib/payments/flutterwave";
import { getClientSession } from "@/lib/client-auth";
import { calculatePrepaidPrice, isPrepaidTerm } from "@/lib/payments/terms";

export const dynamic = "force-dynamic";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CheckoutSession = {
  id: string;
  tx_ref: string;
  plan_slug: string;
  billing_type: "setup" | "subscription";
  billing_region: "NG" | "INTERNATIONAL";
  currency: "NGN" | "USD";
  amount: number;
  recurring_amount: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
};

type FlutterwavePaymentResponse = { status: string; message: string; data?: { id?: number; link?: string } };
type NowPaymentsInvoiceResponse = { id?: string | number; invoice_url?: string; order_id?: string };

function resolveRequestedRegion(headers: Headers, requested: unknown): BillingRegion {
  const detected = resolveBillingRegionFromHeaders(headers);
  if (detected === "NG" && requested === "INTERNATIONAL") return "INTERNATIONAL";
  return detected;
}

async function createNowPaymentsInvoice(input: {
  amount: number;
  txRef: string;
  description: string;
  siteUrl: string;
}) {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) throw new Error("Crypto payment provider is not configured.");

  const response = await fetch("https://api.nowpayments.io/v1/invoice", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      price_amount: input.amount,
      price_currency: "usd",
      order_id: input.txRef,
      order_description: input.description,
      ipn_callback_url: `${input.siteUrl}/api/payments/nowpayments/ipn`,
      success_url: `${input.siteUrl}/checkout/crypto-return?tx_ref=${encodeURIComponent(input.txRef)}`,
      cancel_url: `${input.siteUrl}/pricing?payment=cancelled&provider=crypto`,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as NowPaymentsInvoiceResponse & { message?: string };
  if (!response.ok || !payload.invoice_url) {
    throw new Error(payload.message || "NOWPayments did not return a crypto checkout link.");
  }
  return payload;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const planSlug = typeof body?.planSlug === "string" ? body.planSlug.trim() : "";
    const billingType = body?.billingType === "subscription" ? "subscription" : "setup";
    const prepaidTerm = isPrepaidTerm(body?.term) ? body.term : null;
    const paymentMethod = body?.paymentMethod === "crypto" ? "crypto" : "card";
    const clientSession = await getClientSession();
    const customerName = typeof body?.customer?.name === "string" && body.customer.name.trim()
      ? body.customer.name.trim()
      : clientSession?.organizationSlug || "Fluxknight Client";
    const customerPhone = typeof body?.customer?.phone === "string" ? body.customer.phone.trim() : null;
    const customerEmail = clientSession?.email || (typeof body?.customer?.email === "string" ? body.customer.email.trim().toLowerCase() : "");

    if (!planSlug || !emailPattern.test(customerEmail)) {
      return NextResponse.json({ error: "Plan and a valid customer email are required." }, { status: 400 });
    }

    const region = resolveRequestedRegion(request.headers, body?.billingRegion);
    const currency = currencyForRegion(region);
    const plan = await getPublicPlan(planSlug, region);
    if (!plan) return NextResponse.json({ error: currency === "USD" ? "This international price is not configured yet." : "That plan is unavailable." }, { status: 409 });
    if (plan.custom) return NextResponse.json({ error: "Business+ requires an evaluation before payment." }, { status: 409 });
    if (paymentMethod === "crypto" && region !== "INTERNATIONAL") {
      return NextResponse.json({ error: "Crypto checkout is available on international pricing only." }, { status: 409 });
    }

    const paymentPlanId = Number((plan.metadata?.flutterwave_payment_plans as Record<string, unknown> | undefined)?.[currency.toLowerCase()]);
    if (billingType === "subscription" && !paymentPlanId && paymentMethod !== "crypto") {
      return NextResponse.json({ error: "Recurring billing is not configured for this plan yet. Complete payment-plan provisioning first." }, { status: 409 });
    }

    const termPrice = prepaidTerm ? calculatePrepaidPrice(plan.installationFee, plan.recurringFee, prepaidTerm) : null;
    const txRef = `FK-${plan.slug}-${crypto.randomUUID()}`;
    const amount = termPrice?.total ?? plan.installationFee;
    const recurringAmount = plan.recurringFee;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.FLUXKNIGHT_APP_URL || "https://www.fluxknight.space").replace(/\/$/, "");
    const provider = paymentMethod === "crypto" ? "nowpayments" : "flutterwave";

    const inserted = await supabaseRest<CheckoutSession[]>("checkout_sessions", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: txRef,
        plan_slug: plan.slug,
        billing_type: billingType,
        billing_region: region,
        currency,
        amount,
        recurring_amount: recurringAmount,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        organization_id: clientSession?.organizationId || null,
        provider,
        metadata: {
          source: clientSession ? "fluxknight_client_marketplace" : "fluxknight_public_pricing",
          currency_locked: true,
          organization_id: clientSession?.organizationId || null,
          prepaid_term: prepaidTerm,
          prepaid_months: termPrice?.months ?? null,
          discount_percent: termPrice?.discountPercent ?? 0,
          undiscounted_total: termPrice?.subtotal ?? plan.installationFee,
          discount_amount: termPrice?.discount ?? 0,
          payment_method: paymentMethod,
          requested_billing_region: body?.billingRegion ?? null,
        },
      }),
    });

    const session = inserted[0];
    if (!session) throw new Error("Unable to create checkout session.");

    const description = termPrice
      ? `${plan.name} · ${termPrice.label} prepaid · ${termPrice.discountPercent}% discount`
      : `${plan.name} setup and deployment`;

    try {
      if (paymentMethod === "crypto") {
        const invoice = await createNowPaymentsInvoice({ amount, txRef, description, siteUrl });
        await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, {
          method: "PATCH",
          body: JSON.stringify({ checkout_url: invoice.invoice_url, provider_payload: invoice }),
        });
        return NextResponse.json({
          checkoutUrl: invoice.invoice_url,
          txRef,
          region,
          currency,
          currencyLocked: true,
          authenticated: Boolean(clientSession),
          provider: "nowpayments",
          term: termPrice,
        });
      }

      const payload: Record<string, unknown> = {
        tx_ref: txRef,
        amount,
        currency,
        redirect_url: `${siteUrl}/api/payments/callback`,
        customer: { email: customerEmail, name: customerName, phonenumber: customerPhone || undefined },
        payment_options: currency === "NGN" && billingType === "setup" ? "card, banktransfer, ussd" : "card",
        configurations: { session_duration: 30, max_retry_attempt: 5 },
        customizations: { title: "Fluxknight AI Automation", description },
        meta: {
          fluxknight_session_id: session.id,
          plan_slug: plan.slug,
          billing_type: billingType,
          billing_region: region,
          organization_id: clientSession?.organizationId || null,
          prepaid_term: prepaidTerm,
          prepaid_months: termPrice?.months ?? null,
          discount_percent: termPrice?.discountPercent ?? 0,
        },
      };
      if (billingType === "subscription") payload.payment_plan = paymentPlanId;

      const response = await flutterwaveRequest<FlutterwavePaymentResponse>("/payments", { method: "POST", body: JSON.stringify(payload) });
      const checkoutUrl = response.data?.link;
      if (!checkoutUrl) throw new Error("Flutterwave did not return a checkout link.");
      await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, { method: "PATCH", body: JSON.stringify({ checkout_url: checkoutUrl, provider_payload: response }) });
      return NextResponse.json({ checkoutUrl, txRef, region, currency, currencyLocked: true, authenticated: Boolean(clientSession), provider: "flutterwave", term: termPrice });
    } catch (error) {
      await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, { method: "PATCH", body: JSON.stringify({ status: "failed", provider_payload: { error: String(error) } }) }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("[payments/create]", error);
    const message = error instanceof Error && error.message === "Crypto payment provider is not configured."
      ? error.message
      : "Unable to initialize payment.";
    return NextResponse.json({ error: message }, { status: message.includes("not configured") ? 503 : 500 });
  }
}
