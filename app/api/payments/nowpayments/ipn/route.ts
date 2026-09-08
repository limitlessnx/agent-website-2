import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseRest } from "@/lib/supabase-server-rest";

export const dynamic = "force-dynamic";

type NowPaymentsIpn = {
  payment_id?: number | string;
  invoice_id?: number | string;
  payment_status?: string;
  order_id?: string;
  price_amount?: number;
  price_currency?: string;
  actually_paid?: number;
  pay_currency?: string;
  [key: string]: unknown;
};

type CheckoutSession = {
  tx_ref: string;
  status: string;
  amount: number;
  currency: string;
  provider: string;
};

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObject((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }
  return value;
}

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) return NextResponse.json({ error: "IPN verification is not configured." }, { status: 503 });

  const signature = request.headers.get("x-nowpayments-sig")?.trim().toLowerCase() || "";
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 401 });

  let payload: NowPaymentsIpn;
  try {
    payload = (await request.json()) as NowPaymentsIpn;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const canonical = JSON.stringify(sortObject(payload));
  const expected = crypto.createHmac("sha512", secret.trim()).update(canonical).digest("hex");
  if (!secureEqual(expected, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const txRef = typeof payload.order_id === "string" ? payload.order_id : "";
  if (!txRef) return NextResponse.json({ ok: true, ignored: true });

  const rows = await supabaseRest<CheckoutSession[]>(
    `checkout_sessions?select=tx_ref,status,amount,currency,provider&tx_ref=eq.${encodeURIComponent(txRef)}&limit=1`,
  ).catch(() => []);
  const session = rows[0];
  if (!session || session.provider !== "nowpayments") return NextResponse.json({ ok: true, ignored: true });

  const paymentStatus = String(payload.payment_status || "").toLowerCase();
  const successful = paymentStatus === "finished";
  const terminalFailure = ["failed", "refunded", "expired"].includes(paymentStatus);
  const nextStatus = successful ? "successful" : terminalFailure ? paymentStatus : "pending";

  await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: nextStatus,
      provider_transaction_id: payload.payment_id ? String(payload.payment_id) : payload.invoice_id ? String(payload.invoice_id) : null,
      provider_payload: payload,
      ...(successful ? { paid_at: new Date().toISOString() } : {}),
    }),
  });

  return NextResponse.json({ ok: true, status: paymentStatus });
}
