import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { flutterwaveRequest, isValidFlutterwaveWebhook } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const validSignature = isValidFlutterwaveWebhook(rawBody, request.headers);

  if (!validSignature) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const eventType = String(payload?.event || payload?.type || "unknown");
  const data = payload?.data || {};
  const externalEventId = String(payload?.id || data?.id || data?.tx_ref || `event-${Date.now()}`);

  try {
    const existing = await supabaseRest<any[]>(
      `payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalEventId)}&limit=1`,
    );
    if (existing.length) return NextResponse.json({ received: true, duplicate: true });

    await supabaseRest("payment_webhook_events", {
      method: "POST",
      body: JSON.stringify({
        provider: "flutterwave",
        external_event_id: externalEventId,
        event_type: eventType,
        signature_valid: true,
        payload,
      }),
    });

    if (eventType !== "charge.completed" || !data?.tx_ref || !data?.id) {
      await supabaseRest(`payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalEventId)}`, {
        method: "PATCH",
        body: JSON.stringify({ processed_at: new Date().toISOString() }),
      }).catch(() => undefined);
      return NextResponse.json({ received: true });
    }

    const sessions = await supabaseRest<any[]>(`checkout_sessions?tx_ref=eq.${encodeURIComponent(String(data.tx_ref))}&limit=1`);
    const session = sessions[0];

    if (!session) {
      await supabaseRest(`payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalEventId)}`, {
        method: "PATCH",
        body: JSON.stringify({ processed_at: new Date().toISOString(), processing_error: "Checkout session not found." }),
      }).catch(() => undefined);
      return NextResponse.json({ received: true });
    }

    const verification = await flutterwaveRequest<any>(`/transactions/${encodeURIComponent(String(data.id))}/verify`);
    const verified = verification?.data;
    const validPayment = Boolean(
      verified?.status === "successful" &&
      verified?.tx_ref === session.tx_ref &&
      verified?.currency === session.currency &&
      Number(verified?.amount) >= Number(session.amount),
    );

    await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(String(data.tx_ref))}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: validPayment ? "successful" : "verification_failed",
        provider_transaction_id: verified?.id ? String(verified.id) : String(data.id),
        provider_reference: verified?.flw_ref || data?.flw_ref || null,
        provider_payload: verification,
        paid_at: validPayment ? new Date().toISOString() : null,
      }),
    });

    await supabaseRest(`payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalEventId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        processed_at: new Date().toISOString(),
        processing_error: validPayment ? null : "Flutterwave verification did not match the locked checkout session.",
      }),
    }).catch(() => undefined);

    return NextResponse.json({ received: true, verified: validPayment });
  } catch (error) {
    console.error("[payments/flutterwave/webhook]", error);
    await supabaseRest(`payment_webhook_events?provider=eq.flutterwave&external_event_id=eq.${encodeURIComponent(externalEventId)}`, {
      method: "PATCH",
      body: JSON.stringify({ processing_error: String(error) }),
    }).catch(() => undefined);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
