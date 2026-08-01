import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function validSignature(raw: string, received: string | null, secret: string) {
  if (!received) return false;
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });

  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-paystack-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const event = JSON.parse(raw);
  const reference = event?.data?.reference as string | undefined;
  const eventId = String(event?.data?.id || `${event.event}:${reference || "unknown"}`);
  const admin = createAdminClient();

  const { error: eventError } = await admin.from("payment_webhook_events").upsert({
    provider: "paystack",
    external_event_id: eventId,
    event_type: String(event.event || "unknown"),
    signature_valid: true,
    payload: event,
  }, { onConflict: "provider,external_event_id", ignoreDuplicates: true });
  if (eventError) throw eventError;

  if (event.event === "charge.success" && reference) {
    const { data: payment, error } = await admin
      .from("payment_attempts")
      .update({ status: "paid", paid_at: new Date().toISOString(), provider_payload: event.data, updated_at: new Date().toISOString() })
      .eq("provider", "paystack")
      .eq("provider_reference", reference)
      .neq("status", "paid")
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (payment?.id) {
      const { error: rpcError } = await admin.schema("private").rpc("queue_paid_quote_provisioning", { target_payment_id: payment.id });
      if (rpcError) throw rpcError;
    }
  }

  await admin.from("payment_webhook_events").update({ processed_at: new Date().toISOString() }).eq("provider", "paystack").eq("external_event_id", eventId);
  return NextResponse.json({ received: true });
}
