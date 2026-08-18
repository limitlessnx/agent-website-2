import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server-rest";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const txRef = new URL(request.url).searchParams.get("tx_ref")?.trim() || "";
  if (!txRef) return NextResponse.json({ error: "tx_ref is required." }, { status: 400 });

  try {
    const rows = await supabaseRest<any[]>(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}&select=tx_ref,plan_slug,billing_type,billing_region,currency,amount,status,created_at,paid_at&limit=1`);
    const session = rows[0];
    if (!session) return NextResponse.json({ error: "Payment session not found." }, { status: 404 });

    return NextResponse.json({
      txRef: session.tx_ref,
      planSlug: session.plan_slug,
      billingType: session.billing_type,
      region: session.billing_region,
      currency: session.currency,
      amount: session.amount,
      status: session.status,
      paidAt: session.paid_at,
      currencyLocked: true,
    });
  } catch (error) {
    console.error("[payments/status]", error);
    return NextResponse.json({ error: "Unable to read payment status." }, { status: 500 });
  }
}
