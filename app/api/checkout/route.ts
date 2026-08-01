import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const provider = body.provider === "stripe" ? "stripe" : "paystack";
    if (provider !== "paystack") return NextResponse.json({ error: "Stripe is not enabled yet." }, { status: 400 });
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return NextResponse.json({ error: "Payment provider is not configured." }, { status: 503 });

    const admin = createAdminClient();
    const { data: selections, error: selectionError } = await admin
      .from("organization_agent_selections")
      .select("id,agent_key,display_name,setup_price,monthly_price,currency,status")
      .eq("organization_id", session.organizationId)
      .in("status", ["selected", "configured", "quoted", "payment_pending"]);
    if (selectionError) throw selectionError;
    if (!selections?.length) return NextResponse.json({ error: "Select at least one agent before checkout." }, { status: 400 });

    const setupTotal = selections.reduce((sum, item) => sum + Number(item.setup_price), 0);
    const monthlyTotal = selections.reduce((sum, item) => sum + Number(item.monthly_price), 0);
    const currency = selections[0].currency || "NGN";
    const amount = setupTotal + monthlyTotal;
    const reference = `flux_${randomUUID().replaceAll("-", "")}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    const { data: quote, error: quoteError } = await admin
      .from("organization_quotes")
      .insert({ organization_id: session.organizationId, quote_type: "standard", status: "payment_pending", setup_total: setupTotal, monthly_total: monthlyTotal, currency })
      .select("id")
      .single();
    if (quoteError) throw quoteError;

    const quoteItems = selections.map((item) => ({ organization_id: session.organizationId, quote_id: quote.id, agent_selection_id: item.id, item_type: "agent", item_key: item.agent_key, description: item.display_name, quantity: 1, setup_price: item.setup_price, monthly_price: item.monthly_price }));
    const { error: itemError } = await admin.from("organization_quote_items").insert(quoteItems);
    if (itemError) throw itemError;

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: session.email, amount: Math.round(amount * 100), currency, reference, callback_url: `${appUrl}/portal/payment/success?reference=${reference}`, metadata: { organization_id: session.organizationId, quote_id: quote.id, user_id: session.userId } }),
    });
    const initialized = await paystackResponse.json();
    if (!paystackResponse.ok || !initialized.status) throw new Error(initialized.message || "Unable to initialize payment.");

    const { error: paymentError } = await admin.from("payment_attempts").insert({ organization_id: session.organizationId, quote_id: quote.id, provider: "paystack", provider_reference: reference, amount, currency, status: "pending", checkout_url: initialized.data.authorization_url, provider_payload: initialized.data, created_by: session.userId });
    if (paymentError) throw paymentError;

    await admin.from("organization_agent_selections").update({ status: "payment_pending" }).eq("organization_id", session.organizationId).in("id", selections.map((item) => item.id));
    return NextResponse.json({ checkout_url: initialized.data.authorization_url, reference, quote_id: quote.id });
  } catch (error) {
    console.error("Checkout initialization failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout failed." }, { status: 500 });
  }
}
