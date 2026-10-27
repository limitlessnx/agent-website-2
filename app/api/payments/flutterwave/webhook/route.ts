import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { flutterwaveRequest, isValidFlutterwaveWebhook } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!isValidFlutterwaveWebhook(rawBody, request.headers)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }); }

  const eventType = String(payload?.event || payload?.type || "unknown");
  const data = payload?.data || {};
  const externalEventId = String(payload?.id || data?.id || data?.tx_ref || `event-${Date.now()}`);

  try {
    const existing = await supabaseRest<any[]>(`payment_webhook_events?select=id,processed_at&provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalEventId)}&limit=1`);
    const existingEvent = existing[0];

    // Never automatically reprocess a previously received event. Failed events
    // are recorded for an authorized operator to inspect and retry manually.
    if (existingEvent) return NextResponse.json({ received: true, duplicate: true });

    if (!existingEvent) {
      await supabaseRest("payment_webhook_events", {
        method: "POST",
        body: JSON.stringify({ provider: "flutterwave", external_event_id: externalEventId, event_type: eventType, signature_valid: true, payload }),
      });
    }

    if (eventType !== "charge.completed" || !data?.tx_ref || !data?.id) {
      await supabaseRest(`payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalEventId)}`, {
        method: "PATCH",
        body: JSON.stringify({ processed_at: new Date().toISOString(), processing_error: null }),
      });
      return NextResponse.json({ received: true });
    }

    const sessions = await supabaseRest<any[]>(`checkout_sessions?tx_ref=eq.${encodeURIComponent(String(data.tx_ref))}&limit=1`);
    const session = sessions[0];
    if (!session) {
      // Acknowledge to the provider to prevent automatic redelivery. An
      // authorized operator must reconcile/retry this event manually.
      await supabaseRest(`payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalEventId)}`, {
        method: "PATCH",
        body: JSON.stringify({ processed_at: new Date().toISOString(), processing_error: "Checkout session not found; manual reconciliation required." }),
      }).catch(() => undefined);
      return NextResponse.json({ received: true, manual_review_required: true });
    }

    const verification = await flutterwaveRequest<any>(`/transactions/${encodeURIComponent(String(data.id))}/verify`);
    const verified = verification?.data;
    const verifiedStatus = String(verified?.status || "").toLowerCase();
    const validPayment = Boolean((verifiedStatus === "successful" || verifiedStatus === "succeeded") && verified?.tx_ref === session.tx_ref && verified?.currency === session.currency && Number(verified?.amount) >= Number(session.amount));

    await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(String(data.tx_ref))}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: validPayment ? "successful" : "verification_failed",
        provider_transaction_id: verified?.id ? String(verified.id) : String(data.id),
        provider_reference: verified?.flw_ref || data?.reference || null,
        provider_payload: verification,
        paid_at: validPayment ? new Date().toISOString() : null,
      }),
    });

    if (validPayment && session.billing_type === "top_up") {
      // This RPC is idempotent by checkout session; safe to retry if a later
      // event-log update fails after the credits have already been applied.
      await supabaseRest("rpc/apply_flux_credit_topup_from_checkout", {
        method: "POST",
        body: JSON.stringify({ target_checkout_session_id: session.id }),
      });
    }

    await supabaseRest(`payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalEventId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        processed_at: new Date().toISOString(),
        processing_error: validPayment ? null : "Flutterwave verification did not match the locked checkout session.",
      }),
    });
    return NextResponse.json({ received: true, verified: validPayment });
  } catch (error) {
    console.error("[payments/flutterwave/webhook]", error);
    // Mark the event handled for delivery purposes so the provider does not
    // automatically retry. Preserve the error for manual operator recovery.
    await supabaseRest(`payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalEventId)}`, {
      method: "PATCH",
      body: JSON.stringify({ processed_at: new Date().toISOString(), processing_error: error instanceof Error ? error.message : "Processing failed; manual retry required." }),
    }).catch(() => undefined);
    return NextResponse.json({ received: true, manual_review_required: true });
  }
}
