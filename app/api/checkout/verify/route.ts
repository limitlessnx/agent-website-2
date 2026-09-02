import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fluxknightPortalUrl, sendFluxknightLifecycleEvent } from "@/lib/resend-events";

function firstName(value: string, email: string) {
  return value.trim().split(/\s+/)[0] || email.split("@")[0] || "there";
}

function portalRedirect(request: NextRequest, outcome: "success" | "failed" | "pending", reference: string) {
  const url = new URL(fluxknightPortalUrl(), request.url);
  url.searchParams.set("payment", outcome);
  url.searchParams.set("reference", reference);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get("reference")?.trim();
  if (!reference) return NextResponse.json({ error: "Payment reference is required." }, { status: 400 });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Payment provider is not configured." }, { status: 503 });

  const admin = createAdminClient();

  try {
    const { data: payment, error: paymentError } = await admin
      .from("payment_attempts")
      .select("id,organization_id,quote_id,provider_reference,amount,currency,status,created_by")
      .eq("provider", "paystack")
      .eq("provider_reference", reference)
      .maybeSingle();

    if (paymentError) throw paymentError;
    if (!payment) return NextResponse.json({ error: "Payment attempt not found." }, { status: 404 });

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
    });
    const verified = await verifyResponse.json().catch(() => ({}));

    if (!verifyResponse.ok || !verified?.status || !verified?.data) {
      console.error("Paystack transaction verification failed", { reference, status: verifyResponse.status });
      return portalRedirect(request, "pending", reference);
    }

    const providerStatus = String(verified.data.status || "").toLowerCase();

    if (providerStatus === "success") {
      return portalRedirect(request, "success", reference);
    }

    if (providerStatus === "failed") {
      await admin
        .from("payment_attempts")
        .update({ status: "failed", provider_payload: verified.data, updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .in("status", ["initialized", "pending"]);

      const userResult = payment.created_by
        ? await admin.auth.admin.getUserById(payment.created_by)
        : { data: { user: null }, error: null };
      const user = userResult.data?.user;
      const email = String(user?.email || verified.data?.customer?.email || "").trim().toLowerCase();

      if (email) {
        const fullName = String(user?.user_metadata?.full_name || verified.data?.customer?.first_name || "").trim();
        await sendFluxknightLifecycleEvent({
          eventKey: `payment-failed:${payment.id}`,
          event: "fluxknight.payment.failed",
          email,
          userId: payment.created_by || null,
          organizationId: payment.organization_id,
          paymentAttemptId: payment.id,
          payload: {
            first_name: firstName(fullName, email),
            amount: String(payment.amount),
            currency: String(payment.currency || ""),
            reason: "The payment provider reported that this transaction was not completed.",
            retry_url: fluxknightPortalUrl(),
          },
        });
      }

      return portalRedirect(request, "failed", reference);
    }

    if (providerStatus === "abandoned") {
      await admin
        .from("payment_attempts")
        .update({ status: "cancelled", provider_payload: verified.data, updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .in("status", ["initialized", "pending"]);
      return portalRedirect(request, "pending", reference);
    }

    return portalRedirect(request, "pending", reference);
  } catch (error) {
    console.error("Paystack payment verification callback failed", error);
    return portalRedirect(request, "pending", reference);
  }
}
