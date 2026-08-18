import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { flutterwaveRequest } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

type Session = {
  id: string;
  tx_ref: string;
  amount: number;
  currency: string;
  status: string;
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

    await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: valid ? "successful" : "verification_failed",
        provider_transaction_id: payment?.id ? String(payment.id) : transactionId,
        provider_reference: payment?.flw_ref || null,
        provider_payload: verification,
        paid_at: valid ? new Date().toISOString() : null,
      }),
    });

    destination.searchParams.set("payment", valid ? "success" : "failed");
    destination.searchParams.set("tx_ref", txRef);
    return NextResponse.redirect(destination);
  } catch (error) {
    console.error("[payments/callback]", error);
    destination.searchParams.set("payment", "verification_error");
    destination.searchParams.set("tx_ref", txRef);
    return NextResponse.redirect(destination);
  }
}
