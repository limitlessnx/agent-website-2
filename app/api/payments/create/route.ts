import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { getPublicPlan } from "@/lib/payments/catalog";
import { currencyForRegion, resolveBillingRegionFromHeaders } from "@/lib/payments/region";
import { flutterwaveRequest } from "@/lib/payments/flutterwave";
import { getClientSession } from "@/lib/client-auth";

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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const planSlug = typeof body?.planSlug === "string" ? body.planSlug.trim() : "";
    const billingType = body?.billingType === "subscription" ? "subscription" : "setup";
    const clientSession = await getClientSession();
    const customerName = typeof body?.customer?.name === "string" && body.customer.name.trim()
      ? body.customer.name.trim()
      : clientSession?.organizationSlug || "Fluxknight Client";
    const customerPhone = typeof body?.customer?.phone === "string" ? body.customer.phone.trim() : null;
    const customerEmail = clientSession?.email || (typeof body?.customer?.email === "string" ? body.customer.email.trim().toLowerCase() : "");

    if (!planSlug || !emailPattern.test(customerEmail)) {
      return NextResponse.json({ error: "Plan and a valid customer email are required." }, { status: 400 });
    }

    const region = resolveBillingRegionFromHeaders(request.headers);
    const currency = currencyForRegion(region);
    const plan = await getPublicPlan(planSlug, region);
    if (!plan) return NextResponse.json({ error: currency === "USD" ? "This international price is not configured yet." : "That plan is unavailable." }, { status: 409 });
    if (plan.custom) return NextResponse.json({ error: "Custom AI Operations requires an evaluation before payment." }, { status: 409 });

    const paymentPlanId = Number((plan.metadata?.flutterwave_payment_plans as Record<string, unknown> | undefined)?.[currency.toLowerCase()]);
    if (billingType === "subscription" && !paymentPlanId) {
      return NextResponse.json({ error: "Recurring billing is not configured for this plan yet. Complete payment-plan provisioning first." }, { status: 409 });
    }

    const txRef = `FK-${plan.slug}-${crypto.randomUUID()}`;
    const amount = plan.installationFee;
    const recurringAmount = plan.recurringFee;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.FLUXKNIGHT_APP_URL || "https://www.fluxknight.space").replace(/\/$/, "");

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
        provider: "flutterwave",
        metadata: { source: clientSession ? "fluxknight_client_marketplace" : "fluxknight_public_pricing", currency_locked: true, organization_id: clientSession?.organizationId || null },
      }),
    });

    const session = inserted[0];
    if (!session) throw new Error("Unable to create checkout session.");

    const payload: Record<string, unknown> = {
      tx_ref: txRef,
      amount,
      currency,
      redirect_url: `${siteUrl}/api/payments/callback`,
      customer: { email: customerEmail, name: customerName, phonenumber: customerPhone || undefined },
      payment_options: currency === "NGN" && billingType === "setup" ? "card, banktransfer, ussd" : "card",
      configurations: { session_duration: 30, max_retry_attempt: 5 },
      customizations: { title: "Fluxknight AI Automation", description: `${plan.name} setup and deployment` },
      meta: { fluxknight_session_id: session.id, plan_slug: plan.slug, billing_type: billingType, billing_region: region, organization_id: clientSession?.organizationId || null },
    };
    if (billingType === "subscription") payload.payment_plan = paymentPlanId;

    try {
      const response = await flutterwaveRequest<FlutterwavePaymentResponse>("/payments", { method: "POST", body: JSON.stringify(payload) });
      const checkoutUrl = response.data?.link;
      if (!checkoutUrl) throw new Error("Flutterwave did not return a checkout link.");
      await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, { method: "PATCH", body: JSON.stringify({ checkout_url: checkoutUrl, provider_payload: response }) });
      return NextResponse.json({ checkoutUrl, txRef, region, currency, currencyLocked: true, authenticated: Boolean(clientSession) });
    } catch (error) {
      await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, { method: "PATCH", body: JSON.stringify({ status: "failed", provider_payload: { error: String(error) } }) }).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    console.error("[payments/create]", error);
    return NextResponse.json({ error: "Unable to initialize payment." }, { status: 500 });
  }
}
