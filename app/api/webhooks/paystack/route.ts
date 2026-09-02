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

    await admin.from("payment_webhook_events").update({ processed_at: new Date().toISOString() }).eq("provider", "paystack").eq("external_event_id", eventId);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack webhook failed", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
