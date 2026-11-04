import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { flutterwaveRequest } from "@/lib/payments/flutterwave";
import { getClientSession } from "@/lib/client-auth";
import { activatePaidTrialSubscription } from "@/lib/payments/activate-paid-trial";

export const dynamic = "force-dynamic";

type Session = {
  id: string;
  tx_ref: string;
  amount: number;
  currency: string;
  status: string;
  billing_type?: string;
  billing_region?: "NG" | "INTERNATIONAL";
  plan_slug?: string;
  organization_id?: string | null;
  customer_email: string;
};

type VerificationResponse = {
  status: string;
  data?: {
    id: number;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
    charged_amount?: number;
    flw_ref?: string;
    customer?: { id?: number | string; email?: string };
  };
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const txRef = url.searchParams.get("tx_ref") || "";
  const transactionId = url.searchParams.get("transaction_id") || "";
  const providerStatus = url.searchParams.get("status") || "";
  const destination = new URL("/pricing", url.origin);

  if (!txRef || !transactionId || providerStatus === "cancelled") {
    destination.searchParams.set("payment", providerStatus === "cancelled" ? "cancelled" : "invalid");
    return NextResponse.redirect(destination);
  }

  try {
    const sessions = await supabaseRest<Session[]>(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}&limit=1`);
    const session = sessions[0];
    if (!session) {
      destination.searchParams.set("payment", "not_found");
      return NextResponse.redirect(destination);
    }

    const verification = await flutterwaveRequest<VerificationResponse>(`/transactions/${encodeURIComponent(transactionId)}/verify`);
    const payment = verification.data;
    const valid = Boolean(
      payment &&
      payment.status === "successful" &&
      payment.tx_ref === session.tx_ref &&
      payment.currency === session.currency &&
      Number(payment.amount) >= Number(session.amount),
    );

    if (valid) {
      const clientSession = await getClientSession();
      const sameCustomer = clientSession && clientSession.email.toLowerCase() === session.customer_email.toLowerCase();

      if (clientSession && !sameCustomer) {
        destination.searchParams.set("payment", "account_mismatch");
        destination.searchParams.set("tx_ref", txRef);
        return NextResponse.redirect(destination);
      }

      if (session.organization_id && clientSession && session.organization_id !== clientSession.organizationId) {
        destination.searchParams.set("payment", "account_mismatch");
        destination.searchParams.set("tx_ref", txRef);
        return NextResponse.redirect(destination);
      }
      const organizationId = session.organization_id || null;
      if (session.billing_type === "subscription" && organizationId && session.billing_region && session.plan_slug) {
        await activatePaidTrialSubscription(
          { id: session.id, tx_ref: session.tx_ref, plan_slug: session.plan_slug, billing_region: session.billing_region, organization_id: organizationId },
          payment!,
        );
      }

      await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "successful",
          organization_id: organizationId,
          provider_transaction_id: payment?.id ? String(payment.id) : transactionId,
          provider_reference: payment?.flw_ref || null,
          provider_payload: verification,
          paid_at: new Date().toISOString(),
        }),
      });

      if (session.billing_type === "top_up") {
        await supabaseRest("rpc/apply_flux_credit_topup_from_checkout", {
          method: "POST",
          body: JSON.stringify({ target_checkout_session_id: session.id }),
        });
        if (clientSession) {
          const billing = new URL("/portal/billing", url.origin);
          billing.searchParams.set("topup", "success");
          billing.searchParams.set("tx_ref", txRef);
          return NextResponse.redirect(billing);
        }
        const login = new URL("/account/login", url.origin);
        login.searchParams.set("tx_ref", txRef);
        login.searchParams.set("next", "/portal/billing");
        return NextResponse.redirect(login);
      }

      if (clientSession) {
        const destinationPath = session.organization_id ? "/portal" : "/onboarding";
        const next = new URL(destinationPath, url.origin);
        next.searchParams.set("payment", "success");
        next.searchParams.set("tx_ref", txRef);
        return NextResponse.redirect(next);
      }

      const login = new URL("/account/login", url.origin);
      login.searchParams.set("tx_ref", txRef);
      login.searchParams.set("payment", "success");
      login.searchParams.set("next", "/onboarding");
      return NextResponse.redirect(login);
    }

    await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "verification_failed",
        provider_transaction_id: payment?.id ? String(payment.id) : transactionId,
        provider_reference: payment?.flw_ref || null,
        provider_payload: verification,
      }),
    });

    destination.searchParams.set("payment", "failed");
    destination.searchParams.set("tx_ref", txRef);
    return NextResponse.redirect(destination);
  } catch (error) {
    console.error("[payments/callback]", error);
    destination.searchParams.set("payment", "verification_error");
    destination.searchParams.set("tx_ref", txRef);
    return NextResponse.redirect(destination);
  }
}
