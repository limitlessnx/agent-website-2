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

type VerificationResponse = {
  status: string;
  data?: {
    id: number;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
    flw_ref?: string;
    customer?: { id?: number | string };
  };
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!isValidFlutterwaveWebhook(rawBody, request.headers)) {
    return NextResponse.json({ error: "Invalid Flutterwave signature." }, { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody) as {
      event?: string;
      "event.type"?: string;
      data?: { id?: number; tx_ref?: string; status?: string };
    };
    const transactionId = event.data?.id;
    const txRef = event.data?.tx_ref;
    const eventType = event.event || event["event.type"] || "";

    if (!transactionId || !txRef || (eventType && eventType !== "charge.completed")) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const sessions = await supabaseRest<CheckoutSession[]>(
      `checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}&limit=1`,
    );
    const session = sessions[0];
    if (!session) return NextResponse.json({ error: "Checkout session not found." }, { status: 404 });
    if (session.billing_type !== "subscription") return NextResponse.json({ received: true, ignored: true });

    const verification = await flutterwaveRequest<VerificationResponse>(
      `/transactions/${encodeURIComponent(String(transactionId))}/verify`,
    );
    const payment = verification.data;
    const valid = Boolean(
      payment &&
      payment.status === "successful" &&
      payment.tx_ref === session.tx_ref &&
      payment.currency === session.currency &&
      Number(payment.amount) >= Number(session.amount),
    );
    if (!valid || !payment) {
      return NextResponse.json({ error: "Flutterwave transaction verification failed." }, { status: 409 });
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

    await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "successful",
        provider_transaction_id: String(payment.id || transactionId),
        provider_reference: payment.flw_ref || null,
        provider_payload: verification,
        paid_at: new Date().toISOString(),
      }),
    });

    return NextResponse.json({ received: true, activated: Boolean(session.organization_id) });
  } catch (error) {
    console.error("[payments/flutterwave-webhook]", error);
    return NextResponse.json({ error: "Webhook processing failed; provider may retry." }, { status: 500 });
  }
}
