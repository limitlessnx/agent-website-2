import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { flutterwaveRequest } from "@/lib/payments/flutterwave";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("payment_webhook_events")
      .select("id,external_event_id,event_type,processed_at,processing_error,created_at,payload")
      .eq("provider", "flutterwave")
      .not("processing_error", "is", null)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw error;

    return NextResponse.json({
      events: (data || []).map((event) => ({
        id: event.id,
        externalEventId: event.external_event_id,
        eventType: event.event_type,
        processedAt: event.processed_at,
        processingError: event.processing_error,
        createdAt: event.created_at,
        transactionReference: event.payload?.data?.tx_ref || null,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load failed webhook events." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const eventId = String(body.eventId || "").trim();
  if (!eventId) return NextResponse.json({ error: "A webhook event ID is required." }, { status: 400 });

  const admin = createAdminClient();
  const { data: event, error: eventError } = await admin
    .from("payment_webhook_events")
    .select("id,external_event_id,event_type,payload,processing_error")
    .eq("id", eventId)
    .eq("provider", "flutterwave")
    .maybeSingle();
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
  if (!event) return NextResponse.json({ error: "Flutterwave webhook event not found." }, { status: 404 });
  if (!event.processing_error) return NextResponse.json({ error: "This event has no recorded failure to retry." }, { status: 409 });
  if (event.event_type !== "charge.completed") {
    return NextResponse.json({ error: "Manual replay is currently limited to charge.completed events; reconcile other event types manually." }, { status: 400 });
  }

  const payload = event.payload as { data?: { id?: string | number; tx_ref?: string; reference?: string } } | null;
  const data = payload?.data;
  if (!data?.id || !data?.tx_ref) {
    return NextResponse.json({ error: "The stored event lacks a transaction ID or checkout reference; manual reconciliation is required." }, { status: 400 });
  }

  try {
    const { data: checkout, error: checkoutError } = await admin
      .from("checkout_sessions")
      .select("id,tx_ref,billing_type,status,currency,amount")
      .eq("tx_ref", String(data.tx_ref))
      .maybeSingle();
    if (checkoutError) throw checkoutError;
    if (!checkout) throw new Error("Checkout session not found; reconcile the payment reference manually.");
    if (checkout.billing_type !== "top_up") {
      throw new Error("Manual replay is restricted to Flux Credit top-ups; reconcile this checkout type manually.");
    }

    const verification = await flutterwaveRequest<{ data?: Record<string, unknown> }>(`/transactions/${encodeURIComponent(String(data.id))}/verify`);
    const verified = verification?.data;
    const status = String(verified?.status || "").toLowerCase();
    const validPayment = Boolean(
      (status === "successful" || status === "succeeded") &&
      verified?.tx_ref === checkout.tx_ref &&
      verified?.currency === checkout.currency &&
      Number(verified?.amount) >= Number(checkout.amount)
    );
    if (!validPayment) {
      throw new Error("Flutterwave verification did not match the locked checkout session; no credits were applied.");
    }

    const { error: checkoutUpdateError } = await admin
      .from("checkout_sessions")
      .update({
        status: "successful",
        provider_transaction_id: verified?.id ? String(verified.id) : String(data.id),
        provider_reference: verified?.flw_ref || data.reference || null,
        provider_payload: verification,
        paid_at: new Date().toISOString(),
      })
      .eq("id", checkout.id);
    if (checkoutUpdateError) throw checkoutUpdateError;

    const { data: creditResult, error: creditError } = await admin.rpc("apply_flux_credit_topup_from_checkout", {
      target_checkout_session_id: checkout.id,
    });
    if (creditError) throw creditError;

    const { error: eventUpdateError } = await admin
      .from("payment_webhook_events")
      .update({ processed_at: new Date().toISOString(), processing_error: null })
      .eq("id", event.id);
    if (eventUpdateError) throw eventUpdateError;

    return NextResponse.json({ ok: true, eventId: event.id, creditResult, replayedBy: session.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual replay failed.";
    await admin.from("payment_webhook_events").update({ processing_error: message }).eq("id", event.id);
    return NextResponse.json({ error: message, manual_review_required: true }, { status: 422 });
  }
}
