import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { queuePaidAutomationProvisioning } from "@/lib/automation-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";

function validSignature(raw: string, received: string | null, secret: string) {
  if (!received) return false;
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
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
    const eventId = String(event?.data?.id || `${event.event}:${reference || "unknown"}`);
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
        .select("id,organization_id,quote_id")
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

        await queuePaidAutomationProvisioning({
          id: payment.id,
          organization_id: payment.organization_id,
          quote_id: payment.quote_id,
        });
      }
    }

    await admin.from("payment_webhook_events").update({ processed_at: new Date().toISOString() }).eq("provider", "paystack").eq("external_event_id", eventId);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
