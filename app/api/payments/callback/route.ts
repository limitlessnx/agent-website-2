import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { flutterwaveRequest } from "@/lib/payments/flutterwave";
import { getClientSession } from "@/lib/client-auth";

export const dynamic = "force-dynamic";

type Session = {
  id: string;
  tx_ref: string;
  amount: number;
  currency: string;
  status: string;
  billing_type?: string;
  organization_id?: string | null;
  customer_email: string;
  metadata?: Record<string, unknown> | null;
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
    const sessions = await supabaseRest<Session[]>(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}&select=id,tx_ref,amount,currency,status,billing_type,organization_id,customer_email,metadata&limit=1`);
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

      await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "successful",
          organization_id: clientSession?.organizationId || session.organization_id || null,
          provider_transaction_id: payment?.id ? String(payment.id) : transactionId,
          provider_reference: payment?.flw_ref || null,
          provider_payload: verification,
          paid_at: new Date().toISOString(),
        }),
      });

      const evaluationSessionId = typeof session.metadata?.evaluation_session_id === "string" ? session.metadata.evaluation_session_id : "";
      if (evaluationSessionId) {
        try {
          const evaluationRows = await supabaseRest<Array<{ id: string; context: Record<string, unknown> | null; evaluation: Record<string, unknown> | null }>>(
            `ai_business_evaluation_sessions?id=eq.${encodeURIComponent(evaluationSessionId)}&select=id,context,evaluation&limit=1`,
          );
          const evaluationSession = evaluationRows[0];
          if (evaluationSession) {
            await supabaseRest(`ai_business_evaluation_sessions?id=eq.${encodeURIComponent(evaluationSessionId)}`, {
              method: "PATCH",
              body: JSON.stringify({
                status: "paid",
                context: {
                  ...(evaluationSession.context || {}),
                  payment: { status: "successful", tx_ref: txRef, organization_id: clientSession?.organizationId || session.organization_id || null },
                },
                evaluation: evaluationSession.evaluation ? { ...evaluationSession.evaluation, paymentStatus: "paid", paymentReference: txRef } : evaluationSession.evaluation,
                updated_at: new Date().toISOString(),
              }),
            });
          }
        } catch (evaluationError) {
          console.error("[payments/callback] evaluation handoff update failed", evaluationError);
        }
      }

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
        const onboarding = new URL("/onboarding", url.origin);
        onboarding.searchParams.set("tx_ref", txRef);
        return NextResponse.redirect(onboarding);
      }

      const login = new URL("/account/login", url.origin);
      login.searchParams.set("tx_ref", txRef);
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
